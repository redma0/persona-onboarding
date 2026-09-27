"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import {
  type AgentEvent, type AgentReply, type ChatItem, type OnboardingState, VOICES, initialState,
} from "@/lib/types";
import { buildFirstMessage, buildVoicePrompt, describeState } from "@/lib/prompts";
import { blip, startRing, stopRing } from "@/lib/ringtone";
import { downloadVCard } from "@/lib/vcard";
import { DynamicIsland, HomeIndicator, IBubble, ITyping, InputBar, NavBar, StatusBar, ThreadStamp } from "./ios";
import { StartScreen } from "./persona-ui";
import { ContactCard, GoogleLinkCard } from "./ui";
import { BandCard, BandSheet, QuickReplies } from "./band";
import { award, bandUnlocked, score } from "@/lib/engagement";
import { ActiveCall, CallPill, IncomingCall, useClock } from "./Call";
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
  const [bandSheet, setBandSheet] = useState(false);
  const composer = useRef<HTMLTextAreaElement>(null);
  const [now0] = useState(() => Date.now());
  // desktop: scale the whole phone so it keeps real iPhone proportions at any window height
  const [phoneScale, setPhoneScale] = useState<number | null>(null);
  useEffect(() => {
    const fit = () => setPhoneScale(window.innerWidth >= 640 ? Math.min(0.8, (window.innerHeight * 0.76) / 906) : null);
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
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
    patch((s) => award({ ...s, graduated: true }, "graduated"));
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
      patch((x) => award({ ...x, summarySent: true }, d.demo ? "message" : "digest"));
      const st = stateRef.current;
      if (st.agentName && st.userName && st.helpNeed) graduate();
    } finally {
      summarizing.current = false;
      setTyping(false);
    }
  }, [patch, say, graduate]);

  const ringRef = useRef<() => void>(() => {});
  const bandEventRef = useRef<(score: number) => void>(() => {});

  const apply = useCallback(async (reply: AgentReply, ev: AgentEvent) => {
    const hadName = !!stateRef.current.agentName;
    const u = reply.updates;
    patch((s) => {
      let n: OnboardingState = {
        ...s,
        agentName: cap(clean(u.agent_name)) ?? s.agentName,
        userName: cap(clean(u.user_name)) ?? s.userName,
        helpNeed: clean(u.help_need, 200) ?? s.helpNeed,
        declined: {
          call: s.declined.call || reply.declined_call,
          google: s.declined.google || reply.declined_google,
          band: s.declined.band || reply.declined_band,
        },
      };
      if (n.agentName && !s.agentName) n = award(n, "named_agent");
      if (n.userName && !s.userName) n = award(n, "user_name");
      if (n.helpNeed && !s.helpNeed) n = award(n, "help_need");
      if (reply.task_request && ev.type === "user_message") n = award(n, "task");
      return n;
    });
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
    // Band upsell: only sent in response to the app's own band_moment event (the gate lives here, not in the model)
    if (acts.has("send_band") && ev.type === "band_moment" && !stateRef.current.bandShown) {
      await sleep(400);
      addItem({ role: "agent", kind: "band_card" });
      patch((x) => ({ ...x, bandShown: true }));
    }
    if (ev.type === "user_message" && reply.band_moment && bandUnlocked(stateRef.current)) {
      bandEventRef.current(score(stateRef.current));
    }
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
    patch((s) => {
      let n: OnboardingState = { ...s, call: { status: "ended", count: s.call.count + 1, lastEnd: reason } };
      if (dur >= 20) n = award(n, "call_done");
      if (dur >= 60) n = award(n, "long_call");
      return n;
    });
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
  useEffect(() => { bandEventRef.current = (score) => void runAgent({ type: "band_moment", score }); }, [runAgent]);

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
    patch((x) => award({ ...x, google: { status: "connected", email: p.email, name: p.name, demo: p.demo } }, "google"));
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
  const send = (override?: string) => {
    const text = (override ?? draft).trim();
    if (!text) return;
    if (!override) setDraft("");
    addItem({ role: "user", kind: "text", text: text.slice(0, 2000) });
    patch((s) => award(s, "message"));
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
  const lastUserIdx = items.map((i) => i.role === "user" && i.kind === "text").lastIndexOf(true);
  const callClock = useClock(connected ? startedAt : undefined);
  const name = state.agentName;

  const started = entered || items.length > 0;

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-white">
      <div className="relative min-h-dvh w-full flex items-center justify-center lg:gap-[clamp(48px,8vw,140px)] sm:p-6">
      {/* left: phone inside a feathered misty photo, like yourpersona.com */}
      <div className="relative w-full sm:w-auto sm:grid sm:place-items-center" style={phoneScale ? { width: 435 * phoneScale * 2.1, height: 906 * phoneScale * 1.08 } : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/persona/photo.webp" alt="" aria-hidden className="hidden sm:block absolute inset-0 w-full h-full object-cover [mask-image:linear-gradient(to_right,transparent,black_18%,black_82%,transparent),linear-gradient(to_bottom,transparent,black_16%,black_80%,transparent)] [mask-composite:intersect] [-webkit-mask-composite:source-in] rounded-[40px] pointer-events-none" />
      {/* iPhone 17 Pro frame (Persona's own SVG); our screen sits in its 397x864 cutout */}
      <div className="relative w-full h-dvh sm:w-[435px] sm:h-[906px]" style={phoneScale ? { transform: `scale(${phoneScale})`, margin: `${(906 * phoneScale - 906) / 2}px ${(435 * phoneScale - 435) / 2}px` } : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/persona/iphone-17-pro-silver.svg" alt="" aria-hidden className="hidden sm:block absolute inset-0 w-full h-full z-[70] pointer-events-none select-none" />
        <div className="relative w-full h-full sm:absolute sm:left-[18.8px] sm:top-[20.8px] sm:w-[397.4px] sm:h-[864px] sm:rounded-[70px] overflow-hidden">
      <div className="font-ios relative w-full h-full bg-white overflow-hidden">
        <StatusBar tone={callUI !== "none" && !minimized ? "light" : "dark"} className="hidden sm:flex" />
        <div className="hidden sm:block"><DynamicIsland call={callUI === "active" && minimized ? (connected ? callClock : "…") : null} onClick={() => setMinimized(false)} /></div>

        {!started && <StartScreen onContinue={() => { setEntered(true); setDraft(FIRST_DRAFT); }} />}

        {started && <NavBar
          name={name}
          onBack={() => confirm("Start the onboarding over?") && reset()}
          onCall={() => (callUI === "active" ? setMinimized(false) : callUI === "none" && connect(true))}
        />}

        {callUI === "active" && minimized && <div className="sm:hidden"><CallPill name={name} startedAt={connected ? startedAt : undefined} onClick={() => setMinimized(false)} /></div>}

        {/* thread */}
        <div ref={scroller} className="absolute inset-0 overflow-y-auto no-scrollbar px-[16px] pt-[calc(max(env(safe-area-inset-top),14px)+96px)] sm:pt-[150px] pb-[96px] flex flex-col">
          <ThreadStamp top="iMessage" bottom={`Today ${hydrated ? new Date(items[0]?.at ?? now0).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}`} />
          {items.map((it, idx) => {
            const next = items[idx + 1];
            const prev = items[idx - 1];
            const tail = !next || next.role !== it.role || next.kind !== "text";
            const gap = !prev ? "" : prev.role !== it.role || prev.kind !== it.kind ? "mt-[10px]" : "mt-[2px]";
            const isLastUser = idx === lastUserIdx;
            return (
              <div key={it.id} className={gap}>
                {it.kind === "text" && <IBubble text={it.text || ""} me={it.role === "user"} tail={tail} />}
                {isLastUser && (
                  <div className="text-right text-[11px] leading-[13px] text-[#8e8e93] mt-[3px] mr-[4px] fade-in">
                    {items.slice(idx + 1).some((x) => x.role === "agent") || typing ? "Read" : "Delivered"}
                  </div>
                )}
                {it.kind === "contact_card" && (
                  <ContactCard name={it.text!} saved={contactSaved} onSave={() => { downloadVCard(it.text!); setContactSaved(true); }} />
                )}
                {it.kind === "google_link" && (
                  <GoogleLinkCard
                    onConnect={openGoogle}
                    state={state.google.status === "connected" ? "connected" : googleWaiting && it.id === lastLinkId ? "waiting" : "idle"}
                  />
                )}
                {it.kind === "band_card" && (
                  <>
                    <BandCard onOpen={() => setBandSheet(true)} />
                    {idx === items.length - 1 && !typing && (
                      <QuickReplies options={["Tell me more", "Not right now"]} onPick={(t) => send(t)} />
                    )}
                  </>
                )}
                {(it.kind === "call_log" || it.kind === "divider") && (
                  <ThreadStamp bottom={it.kind === "divider" ? "You're all set" : it.text!} />
                )}
              </div>
            );
          })}
          {typing && <div className="mt-[10px] mb-[4px]"><ITyping /></div>}
        </div>

        {started && <InputBar ref={composer} value={draft} onChange={setDraft} onSend={() => send()} />}
        <BandSheet open={bandSheet} onClose={() => setBandSheet(false)} />
        <HomeIndicator tone={callUI !== "none" && !minimized ? "light" : "dark"} />

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
      </div>
      <SidePanel
        state={state}
        googleConfigured={googleConfigured}
        voices={VOICES}
        onVoice={(id) => patch((s) => ({ ...s, voiceId: id }))}
        onReset={reset}
        commitment={score(state)}
        bandShown={!!state.bandShown}
      />
      </div>
    </div>
  );
}
