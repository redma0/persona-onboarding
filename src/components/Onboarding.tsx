"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import {
  type AgentEvent, type AgentReply, type ChatItem, type OnboardingState, VOICES, initialState,
} from "@/lib/types";
import { buildFirstMessage, buildVoicePrompt, describeState } from "@/lib/prompts";
import { blip, startRing, stopRing } from "@/lib/ringtone";
import { downloadVCard } from "@/lib/vcard";
import { Mist } from "./brand";
import { AgentAvatar, StartScreen } from "./persona-ui";
import { Bubble, CallLog, ContactCard, Divider, GoogleLinkCard, PhoneIcon, Typing } from "./ui";
import { ActiveCall, CallPill, IncomingCall } from "./Call";
import { SidePanel } from "./SidePanel";

const STORE = "persona-onboarding-v1";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 10);
const typingDelay = (t: string) => Math.min(1700, 380 + t.length * 17);
const clean = (s: string | null | undefined, max = 30) => (s ? s.trim().replace(/^["']|["']$/g, "").slice(0, max) || undefined : undefined);
const cap = (s?: string) => (s ? s.replace(/(^|[\s-])(\p{Ll})/gu, (m, a, b) => a + b.toUpperCase()) : s);
const stripTags = (t: string) => t.replace(/\[[^\]]{1,30}\]\s*/g, "").trim();

const INTRO = [
  "hey! i'm your new personal assistant",
  "you can text me or call me anytime and i can help with:\n📞 calling places on your behalf\n💻 browsing the web\n🛍️ shopping for you\n✉️ managing your email and calendar\n🚗 finding DoorDash or Uber options",
  "what do you want to call me?",
];
const FIRST_DRAFT = "Hey, what's a persona?";
const GREETING = /^\s*(hi+|hey+|hello+|yo+|sup|hiya|howdy|what'?s? (a |this|up|persona)|what is (a |this)|who (are|is) (you|this)|[?!.👋]+)[\s\w'?,.!👋]*$/i;

type CallUI = "none" | "incoming" | "active";

export default function OnboardingRoot({ googleConfigured }: { googleConfigured: boolean }) {
  return (
    <ConversationProvider>
      <Onboarding googleConfigured={googleConfigured} />
    </ConversationProvider>
  );
}

function Onboarding({ googleConfigured }: { googleConfigured: boolean }) {
  const convo = useConversation();

  // ---------- persistent state (refs mirror state so async callbacks never go stale) ----------
  const [hydrated, setHydrated] = useState(false);
  const [state, setStateRaw] = useState<OnboardingState>(initialState);
  const [items, setItemsRaw] = useState<ChatItem[]>([]);
  const stateRef = useRef(state);
  const itemsRef = useRef(items);

  const persist = () => {
    try { localStorage.setItem(STORE, JSON.stringify({ state: stateRef.current, items: itemsRef.current })); } catch {}
  };
  const patch = useCallback((fn: (s: OnboardingState) => OnboardingState) => {
    stateRef.current = fn(stateRef.current);
    setStateRaw(stateRef.current);
    persist();
  }, []);
  const addItem = useCallback((it: Omit<ChatItem, "id" | "at">) => {
    const item = { ...it, id: uid(), at: Date.now() };
    itemsRef.current = [...itemsRef.current, item];
    setItemsRaw(itemsRef.current);
    persist();
    return item;
  }, []);

  // ---------- ephemeral UI ----------
  const [typing, setTyping] = useState(false);
  const [entered, setEntered] = useState(false);
  const composer = useRef<HTMLTextAreaElement>(null);
  const [now0] = useState(() => Date.now());
  useEffect(() => { if (entered) setTimeout(() => composer.current?.focus(), 350); }, [entered]);
  const [draft, setDraft] = useState("");
  const [callUI, setCallUI] = useState<CallUI>("none");
  const callUIRef = useRef<CallUI>("none");
  const [connected, setConnected] = useState(false);
  const connectedRef = useRef(false);
  const [minimized, setMinimized] = useState(false);
  const [outgoing, setOutgoing] = useState(false);
  const [startedAt, setStartedAt] = useState<number>();
  const [caption, setCaption] = useState<{ who: "agent" | "user"; text: string }>();
  const [banner, setBanner] = useState(false);
  const [googleWaiting, setGoogleWaitingRaw] = useState(false);
  const googleWaitingRef = useRef(false);
  const setGoogleWaiting = (v: boolean) => { googleWaitingRef.current = v; setGoogleWaitingRaw(v); };
  const [contactSaved, setContactSaved] = useState(false);
  const call = useRef({ lines: [] as string[], startedAt: 0, finalized: true, cancelled: false, missTimer: 0 as unknown as ReturnType<typeof setTimeout> });
  const setCall = (v: CallUI) => { callUIRef.current = v; setCallUI(v); };

  // ---------- text agent (serialized; bursts of messages coalesce) ----------
  const busy = useRef(false);
  const pending = useRef<AgentEvent | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const failures = useRef(0);

  const say = useCallback(async (messages: string[], firstImmediate = true) => {
    for (let i = 0; i < messages.length; i++) {
      if (i > 0 || !firstImmediate) { setTyping(true); await sleep(typingDelay(messages[i])); }
      addItem({ role: "agent", kind: "text", text: messages[i] });
      setTyping(false);
      await sleep(120);
    }
  }, [addItem]);

  const graduate = useCallback(() => {
    if (stateRef.current.graduated) return;
    patch((s) => ({ ...s, graduated: true }));
    addItem({ role: "system", kind: "divider", text: "you're all set" });
  }, [patch, addItem]);

  const summarizing = useRef(false);
  const runInboxSummary = useCallback(async () => {
    const s = stateRef.current;
    if (s.summarySent || s.google.status !== "connected" || summarizing.current) return;
    summarizing.current = true;
    setTyping(true);
    try {
      const r = await fetch("/api/inbox", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ helpNeed: s.helpNeed, userName: s.userName, agentName: s.agentName }),
      });
      const d = await r.json().catch(() => ({}));
      if (d.demo) {
        await sleep(900);
        await say(["(demo mode: real google sign-in isn't switched on for this deployment, so i can't actually read an inbox here. with it on, your digest of what needs you lands right here.)"]);
      } else if (d.messages?.length) {
        await say(d.messages);
      } else {
        await say(["hm, gmail isn't letting me in just yet. ask me for an inbox rundown in a minute and i'll try again."]);
        return;
      }
      patch((x) => ({ ...x, summarySent: true }));
      const st = stateRef.current;
      if (st.agentName && st.userName && st.helpNeed) graduate();
    } finally {
      summarizing.current = false;
      setTyping(false);
    }
  }, [patch, say, graduate]);

  const ringRef = useRef<() => void>(() => {});

  const apply = useCallback(async (reply: AgentReply, ev: AgentEvent) => {
    const hadName = !!stateRef.current.agentName;
    const u = reply.updates;
    patch((s) => ({
      ...s,
      agentName: cap(clean(u.agent_name)) ?? s.agentName,
      userName: cap(clean(u.user_name)) ?? s.userName,
      helpNeed: clean(u.help_need, 200) ?? s.helpNeed,
      declined: {
        call: s.declined.call || reply.declined_call,
        google: s.declined.google || reply.declined_google,
      },
    }));
    const s0 = stateRef.current;
    const acts = new Set(reply.actions);
    if (!hadName && s0.agentName) acts.add("send_contact_card");
    const wantCard = acts.has("send_contact_card") && !!s0.agentName &&
      !itemsRef.current.some((i) => i.kind === "contact_card" && i.text === s0.agentName);
    // the card goes right after the bubble that mentions it (or the first bubble)
    const k = Math.max(0, reply.messages.findIndex((m) => /contact|save me/i.test(m))) + 1;
    await say(reply.messages.slice(0, k));
    if (wantCard) {
      await sleep(300);
      addItem({ role: "agent", kind: "contact_card", text: s0.agentName });
    }
    if (reply.messages.length > k) await say(reply.messages.slice(k), false);

    const s = stateRef.current;
    if (acts.has("send_google_link") && s.google.status !== "connected") {
      await sleep(250);
      addItem({ role: "agent", kind: "google_link" });
      patch((x) => ({ ...x, google: { ...x.google, status: "link_sent" } }));
    }
    if (acts.has("start_call") && callUIRef.current === "none") setTimeout(() => ringRef.current(), 1300);
    if (acts.has("graduate")) graduate();
    if (
      (acts.has("send_inbox_summary") || ev.type === "google_connected" || ev.type === "call_ended") &&
      stateRef.current.google.status === "connected" && !stateRef.current.summarySent && callUIRef.current === "none"
    ) {
      await sleep(600);
      await runInboxSummary();
    }
  }, [patch, say, addItem, graduate, runInboxSummary]);

  const runAgent = useCallback(async (ev: AgentEvent): Promise<void> => {
    if (busy.current) {
      if (!pending.current || pending.current.type === "user_message" || pending.current.type === "nudge") pending.current = ev;
      return;
    }
    busy.current = true;
    setTyping(true);
    try {
      let reply: AgentReply | null = null;
      for (let attempt = 0; attempt < 2 && !reply; attempt++) {
        try {
          const r = await fetch("/api/chat", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ state: stateRef.current, items: itemsRef.current, event: ev }),
          });
          if (r.ok) reply = await r.json();
        } catch {}
      }
      if (reply && !("error" in reply)) {
        failures.current = 0;
        await apply(reply, ev);
      } else if (ev.type !== "nudge" && failures.current++ < 1) {
        await say(["sorry, spaced out for a sec there. say that again?"]);
      }
    } finally {
      setTyping(false);
      busy.current = false;
      if (pending.current) {
        const next = pending.current;
        pending.current = null;
        void runAgent(next);
      }
    }
  }, [apply, say]);

  // ---------- calls ----------
  const threadText = () =>
    itemsRef.current.slice(-14).map((i) =>
      i.kind === "text" ? `${i.role === "user" ? "user" : "you"}: ${i.text}` : i.kind === "google_link" ? "(you texted the Connect with Google link)" : i.kind === "call_log" ? `(${i.text})` : "",
    ).filter(Boolean).join("\n");

  const finalizeCall = useCallback((reason: string) => {
    const c = call.current;
    if (c.finalized) return;
    c.finalized = true;
    blip("end");
    setCall("none");
    connectedRef.current = false;
    setConnected(false);
    setMinimized(false);
    setBanner(false);
    setCaption(undefined);
    const dur = c.startedAt ? Math.round((Date.now() - c.startedAt) / 1000) : 0;
    const name = stateRef.current.agentName || "Persona";
    patch((s) => ({ ...s, call: { status: "ended", count: s.call.count + 1, lastEnd: reason } }));
    addItem({ role: "system", kind: "call_log", text: dur ? `Call with ${name} · ${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, "0")}` : "Call ended" });
    void runAgent({ type: "call_ended", reason, durationSec: dur, transcript: c.lines.join("\n") });
  }, [patch, addItem, runAgent]);

  const failCall = useCallback((reason: string) => {
    const c = call.current;
    if (c.finalized) return;
    c.finalized = true;
    setCall("none");
    connectedRef.current = false;
    setConnected(false);
    patch((s) => ({ ...s, call: { ...s.call, status: "failed", lastEnd: reason } }));
    addItem({ role: "system", kind: "call_log", text: "Call didn't connect" });
    void runAgent({ type: "call_failed", reason });
  }, [patch, addItem, runAgent]);

  const clientTools = {
    send_google_link: () => {
      const s = stateRef.current;
      if (s.google.status === "connected") return `Already connected as ${s.google.email}. No need to send anything.`;
      addItem({ role: "agent", kind: "google_link" });
      patch((x) => ({ ...x, google: { ...x.google, status: "link_sent" } }));
      setBanner(true);
      return "Delivered. The 'Connect with Google' card is now in their text thread, and a banner with a Connect button is showing at the top of their call screen right now.";
    },
    save_user_name: ({ name }: { name?: string }) => {
      const n = cap(clean(name));
      if (!n) return "No name given.";
      patch((s) => ({ ...s, userName: n }));
      return `Saved: ${n}`;
    },
    save_help_need: ({ need }: { need?: string }) => {
      const n = clean(need, 200);
      if (!n) return "Nothing to save.";
      patch((s) => ({ ...s, helpNeed: n }));
      return "Saved.";
    },
    get_status: () => {
      const s = stateRef.current;
      const linkDelivered = itemsRef.current.some((i) => i.kind === "google_link");
      return `${describeState(s)}\ngoogle_link_delivered_to_thread: ${linkDelivered}\n${googleWaitingRef.current ? "user has the Google sign-in window open right now" : ""}`;
    },
  };

  const connect = useCallback(async (isOutgoing: boolean) => {
    stopRing();
    clearTimeout(call.current.missTimer);
    call.current = { ...call.current, lines: [], startedAt: 0, finalized: false, cancelled: false };
    setOutgoing(isOutgoing);
    setCall("active");
    setConnected(false);
    setMinimized(false);
    setCaption(undefined);
    patch((s) => ({ ...s, call: { ...s.call, status: "active" } }));

    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      mic.getTracks().forEach((t) => t.stop());
    } catch {
      return failCall("microphone permission was blocked or no mic is available");
    }
    if (call.current.cancelled) return;
    let token: string | undefined;
    try {
      const r = await fetch("/api/voice-token", { cache: "no-store" });
      token = (await r.json()).token;
    } catch {}
    if (!token) return failCall("couldn't reach the voice service");
    if (call.current.cancelled) return;

    const s = stateRef.current;
    convo.startSession({
      conversationToken: token,
      connectionType: "webrtc",
      overrides: {
        agent: { prompt: { prompt: buildVoicePrompt(s, threadText()) }, firstMessage: buildFirstMessage(s) },
        tts: { voiceId: s.voiceId },
      },
      clientTools,
      onConnect: () => {
        if (call.current.cancelled) { convo.endSession(); return; }
        connectedRef.current = true;
        setConnected(true);
        call.current.startedAt = Date.now();
        setStartedAt(call.current.startedAt);
        blip("connect");
      },
      onMessage: ({ message, role }) => {
        const who = role === "user" ? "user" : "agent";
        const text = stripTags(message);
        if (!text || /^[.\s…]+$/.test(text)) return;
        call.current.lines.push(`${who === "user" ? "USER" : "YOU"}: ${text}`);
        setCaption({ who, text });
      },
      onDisconnect: (d) => {
        if (d.reason === "user") return finalizeCall("the user hung up");
        if (d.reason === "agent") return finalizeCall("you (voice agent) ended the call after wrapping up");
        if (!connectedRef.current) return failCall(`connection error: ${d.message}`);
        finalizeCall("the connection dropped unexpectedly");
      },
      onError: (message) => {
        console.warn("voice error", message);
        if (!connectedRef.current) failCall("voice connection error");
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convo, patch, failCall, finalizeCall]);

  const hangUp = () => {
    if (connectedRef.current) {
      convo.endSession(); // onDisconnect → finalizeCall
      setTimeout(() => finalizeCall("the user hung up"), 1500); // safety net
    } else {
      call.current.cancelled = true;
      try { convo.endSession(); } catch {}
      finalizeCall("the user hung up before it connected");
    }
  };

  const ring = useCallback(() => {
    if (callUIRef.current !== "none") return;
    setCall("incoming");
    patch((s) => ({ ...s, call: { ...s.call, status: "ringing" } }));
    startRing();
    call.current.missTimer = setTimeout(() => {
      if (callUIRef.current !== "incoming") return;
      stopRing();
      setCall("none");
      patch((s) => ({ ...s, call: { ...s.call, status: "missed" } }));
      addItem({ role: "system", kind: "call_log", text: "Missed call" });
      void runAgent({ type: "call_missed" });
    }, 25000);
  }, [patch, addItem, runAgent]);
  useEffect(() => { ringRef.current = ring; }, [ring]);

  const decline = () => {
    stopRing();
    clearTimeout(call.current.missTimer);
    setCall("none");
    patch((s) => ({ ...s, call: { ...s.call, status: "declined" } }));
    addItem({ role: "system", kind: "call_log", text: "Declined call" });
    void runAgent({ type: "call_declined" });
  };

  // ---------- Google connect ----------
  const openGoogle = () => {
    setGoogleWaiting(true);
    const w = window.open("/api/google/start", "google-connect", "width=480,height=660");
    if (!w) window.open("/api/google/start", "_blank");
  };

  const onGoogleResult = useCallback((p: { ok: boolean; email?: string; name?: string; demo?: boolean }) => {
    setGoogleWaiting(false);
    const s = stateRef.current;
    if (!p.ok) {
      if (callUIRef.current === "active") convo.sendContextualUpdate("The user closed the Google sign-in without connecting.");
      return;
    }
    if (s.google.status === "connected" && s.google.email === p.email) return;
    patch((x) => ({ ...x, google: { status: "connected", email: p.email, name: p.name, demo: p.demo } }));
    setBanner(false);
    if (callUIRef.current === "active" && connectedRef.current) {
      convo.sendContextualUpdate(
        `Google just connected successfully (${p.email}${p.name ? `, name on the account: ${p.name}` : ""}). Acknowledge it briefly and naturally, then continue. If you don't know their name yet you can confirm it ("is it ${p.name ?? "..."}?").`,
      );
    } else {
      void runAgent({ type: "google_connected" });
    }
  }, [convo, patch, runAgent]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.origin === location.origin && e.data?.source === "google") onGoogleResult(e.data); };
    const onStorage = (e: StorageEvent) => { if (e.key === "google_result" && e.newValue) onGoogleResult(JSON.parse(e.newValue)); };
    let bc: BroadcastChannel | null = null;
    try { bc = new BroadcastChannel("google"); bc.onmessage = (e) => onGoogleResult(e.data); } catch {}
    window.addEventListener("message", onMsg);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener("message", onMsg); window.removeEventListener("storage", onStorage); bc?.close(); };
  }, [onGoogleResult]);

  // ---------- hydrate / intro / reload recovery ----------
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const d = JSON.parse(raw);
        stateRef.current = { ...initialState(), ...d.state };
        itemsRef.current = d.items ?? [];
        setStateRaw(stateRef.current);
        setItemsRaw(itemsRef.current);
      }
    } catch {}
    setHydrated(true);

    const s = stateRef.current;
    if (s.call.status === "active") {
      patch((x) => ({ ...x, call: { status: "ended", count: x.call.count + 1, lastEnd: "the page was reloaded mid-call, so the call dropped" } }));
      addItem({ role: "system", kind: "call_log", text: "Call dropped" });
      void runAgent({ type: "call_ended", reason: "the page was reloaded mid-call, so the call dropped", durationSec: 0, transcript: "" });
    } else if (s.call.status === "ringing") {
      patch((x) => ({ ...x, call: { ...x.call, status: "missed" } }));
      addItem({ role: "system", kind: "call_log", text: "Missed call" });
      void runAgent({ type: "call_missed" });
    }
  }, [patch, addItem, runAgent, say]);

  // ---------- gentle nudge if the user goes quiet mid-onboarding ----------
  const nudgedFor = useRef<string>("");
  useEffect(() => {
    const last = items[items.length - 1];
    if (!last || state.graduated || callUI !== "none" || typing || last.role === "user") return;
    if (nudgedFor.current === last.id) return;
    const t = setTimeout(() => {
      if (document.hidden) return;
      nudgedFor.current = itemsRef.current[itemsRef.current.length - 1]?.id ?? "";
      void runAgent({ type: "nudge" });
    }, 75000);
    return () => clearTimeout(t);
  }, [items, state.graduated, callUI, typing, runAgent]);

  // ---------- sending ----------
  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    addItem({ role: "user", kind: "text", text: text.slice(0, 2000) });
    if (callUIRef.current === "active" && connectedRef.current) {
      convo.sendContextualUpdate(`While on the call, the user also texted: "${text}". Respond to it naturally out loud if relevant.`);
      return;
    }
    const isFirst = !itemsRef.current.some((i, idx) => i.role === "user" && idx < itemsRef.current.length - 1);
    clearTimeout(debounce.current);
    if (isFirst && GREETING.test(text) && text.length < 60) {
      debounce.current = setTimeout(async () => {
        if (busy.current) return void runAgent({ type: "user_message" });
        busy.current = true;
        setTyping(true);
        await sleep(1100);
        await say(INTRO.slice(0, 1));
        await say(INTRO.slice(1), false);
        busy.current = false;
        if (pending.current) { const p = pending.current; pending.current = null; void runAgent(p); }
      }, 500);
      return;
    }
    debounce.current = setTimeout(() => void runAgent(isFirst ? { type: "first_contact" } : { type: "user_message" }), 650);
  };

  const reset = () => {
    try { convo.endSession(); } catch {}
    stopRing();
    localStorage.removeItem(STORE);
    localStorage.removeItem("google_result");
    location.reload();
  };

  // ---------- scroll ----------
  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [items.length, typing]);

  const lastLinkId = [...items].reverse().find((i) => i.kind === "google_link")?.id;
  const name = state.agentName;

  const started = entered || items.length > 0;

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-page">
      <div aria-hidden className="pointer-events-none select-none absolute -bottom-[5vw] left-1/2 -translate-x-1/2 whitespace-nowrap text-[22vw] font-semibold tracking-[-0.05em] text-ink/[0.035] leading-none hidden lg:block">Persona</div>
      <div className="relative min-h-dvh w-full flex items-center justify-center lg:gap-24 sm:p-6">
      <div className="relative w-full sm:w-auto sm:py-6">
        <Mist id="bg" sides className="hidden sm:block absolute -left-48 -right-28 -inset-y-6 w-[calc(100%+19rem)] h-[calc(100%+3rem)] [mask-image:radial-gradient(ellipse_closest-side,black_72%,transparent)]" />
      <div className="relative w-full h-dvh sm:w-[396px] sm:h-[min(852px,calc(100dvh-64px))] sm:rounded-[64px] sm:p-[11px] sm:bg-[linear-gradient(145deg,#f1f1f2_0%,#b9babd_22%,#e9e9eb_48%,#a4a5a9_78%,#d8d9db_100%)] sm:shadow-[0_50px_90px_-30px_rgba(0,0,0,0.45),inset_0_0_0_1px_rgba(255,255,255,0.6)]">
      <div className="font-ios relative w-full h-full sm:rounded-[54px] sm:ring-[3px] sm:ring-black bg-screen overflow-hidden flex flex-col">
        {/* status bar + dynamic island (desktop frame only) */}
        <div className="hidden sm:flex relative z-40 h-[50px] shrink-0 items-center justify-between px-8 pt-1 text-[15px] font-semibold text-ink">
          <span>9:41</span>
          <span className="absolute left-1/2 top-[11px] -translate-x-1/2 w-[112px] h-[32px] rounded-full bg-black" />
          <span className="flex items-center gap-1.5">
            <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="1" /><rect x="4.5" y="5" width="3" height="6" rx="1" /><rect x="9" y="2.5" width="3" height="8.5" rx="1" /><rect x="13.5" y="0" width="3" height="11" rx="1" /></svg>
            <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor"><path d="M7.5 2.2c2 0 3.9.8 5.3 2.1l1.1-1.1A9.1 9.1 0 007.5.6 9.1 9.1 0 001.1 3.2l1.1 1.1a7.5 7.5 0 015.3-2.1zm0 3.2c1.1 0 2.2.4 3 1.2l1.1-1.1a5.9 5.9 0 00-8.2 0l1.1 1.1c.8-.8 1.9-1.2 3-1.2zm0 3.2c-.4 0-.8.2-1.1.5l1.1 1.1 1.1-1.1c-.3-.3-.7-.5-1.1-.5z" /></svg>
            <svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x=".5" y=".5" width="21" height="11" rx="3.5" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="18" height="8" rx="2" fill="currentColor" /><path d="M23 4v4c.8-.3 1.3-1.1 1.3-2S23.8 4.3 23 4z" fill="currentColor" opacity=".45" /></svg>
          </span>
        </div>

        {!started && <StartScreen onContinue={() => { setEntered(true); setDraft(FIRST_DRAFT); }} />}

        {/* header */}
        <header className="relative z-10 pt-[max(env(safe-area-inset-top),10px)] sm:pt-1 pb-2 px-3 bg-screen/80 backdrop-blur-xl">
          <div className="flex items-start">
            <button
              onClick={() => confirm("Start the onboarding over?") && reset()}
              className="w-10 h-10 mt-1 grid place-items-center rounded-full bg-card text-ink/80 active:opacity-70"
              aria-label="Start over"
            >
              <svg width="11" height="18" viewBox="0 0 11 18" fill="none"><path d="M9 1.5L2 9l7 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <div className="flex-1 flex flex-col items-center">
              <AgentAvatar size={54} />
              <div className="-mt-1.5 relative rounded-full bg-screen/90 border border-hairline px-2.5 py-[3px] text-[12.5px] font-semibold flex items-center gap-1 shadow-sm">
                {name || "Persona"} <span className="text-muted font-normal text-[10px]">›</span>
              </div>
            </div>
            <button
              onClick={() => (callUI === "active" ? setMinimized(false) : callUI === "none" && connect(true))}
              className="w-10 h-10 mt-1 grid place-items-center rounded-full bg-card text-ink/80 active:opacity-70"
              aria-label="Call"
            >
              <PhoneIcon size={18} />
            </button>
          </div>
        </header>

        {callUI === "active" && minimized && <CallPill name={name} startedAt={connected ? startedAt : undefined} onClick={() => setMinimized(false)} />}

        {/* thread */}
        <div ref={scroller} className="flex-1 overflow-y-auto no-scrollbar px-3 pt-4 pb-3 flex flex-col gap-[3px]">
          <div className="text-center text-[11px] text-muted mb-3">
            <div className="font-medium">iMessage</div>
            <div>Today {hydrated ? new Date(items[0]?.at ?? now0).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}</div>
          </div>
          {items.map((it, idx) => {
            const next = items[idx + 1];
            const tail = !next || next.role !== it.role || next.kind !== "text";
            const gap = idx > 0 && items[idx - 1].role !== it.role ? "mt-2" : "";
            return (
              <div key={it.id} className={gap}>
                {it.kind === "text" && <Bubble item={it} tail={tail} />}
                {it.kind === "contact_card" && (
                  <ContactCard name={it.text!} saved={contactSaved} onSave={() => { downloadVCard(it.text!); setContactSaved(true); }} />
                )}
                {it.kind === "google_link" && (
                  <GoogleLinkCard
                    onConnect={openGoogle}
                    state={state.google.status === "connected" ? "connected" : googleWaiting && it.id === lastLinkId ? "waiting" : "idle"}
                  />
                )}
                {it.kind === "call_log" && <CallLog text={it.text!} />}
                {it.kind === "divider" && <Divider text={it.text!} />}
              </div>
            );
          })}
          {typing && <div className="mt-2"><Typing /></div>}
        </div>

        {/* composer */}
        <div className="px-3 pt-2 pb-[max(env(safe-area-inset-bottom),10px)] sm:pb-7 bg-screen flex items-end gap-2">
          <span className="w-9 h-9 shrink-0 grid place-items-center rounded-full bg-card text-muted mb-px text-[22px] leading-none">+</span>
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="flex items-end gap-2 rounded-[22px] border border-hairline pl-4 pr-1.5 py-1.5 bg-screen"
          >
            <textarea
              ref={composer}
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="iMessage"
              className="flex-1 resize-none bg-transparent outline-none text-[16px] leading-[1.35] py-1 max-h-28 placeholder:text-muted"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="w-8 h-8 shrink-0 grid place-items-center rounded-full bg-me text-white disabled:opacity-0 transition"
              aria-label="Send"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            </button>
          </form>
          </div>

        {callUI === "incoming" && <IncomingCall name={name} onAccept={() => connect(false)} onDecline={decline} />}
        {callUI === "active" && !minimized && (
          <ActiveCall
            name={name}
            connected={connected}
            startedAt={startedAt}
            caption={caption}
            outgoing={outgoing}
            onEnd={hangUp}
            onMinimize={() => setMinimized(true)}
            banner={banner}
            onBanner={() => { setBanner(false); openGoogle(); }}
            onDismissBanner={() => setBanner(false)}
          />
        )}
      </div>

      </div>
      </div>
      <SidePanel
        state={state}
        googleConfigured={googleConfigured}
        voices={VOICES}
        onVoice={(id) => patch((s) => ({ ...s, voiceId: id }))}
        onReset={reset}
        inCall={callUI !== "none"}
      />
      </div>
    </div>
  );
}
