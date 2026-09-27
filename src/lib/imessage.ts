// iMessage channel: per-phone state in Redis, text agent via Sendblue, real calls via Twilio + ElevenLabs.
import crypto from "crypto";
import { redis, withLock } from "./db";
import { runTextAgent, inboxDigest } from "./agent";
import { sendMedia, sendText, sendTyping } from "./sendblue";
import { placeCall, twilioConfigured } from "./twilio";
import { freshAccessToken, seal, unseal, type GoogleSession, googleConfigured } from "./session";
import { initialState, type AgentEvent, type AgentReply, type ChatItem, type OnboardingState } from "./types";

export const APP = () => process.env.APP_URL || "https://persona-onboarding-riyad.vercel.app";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uid = () => crypto.randomBytes(9).toString("base64url");
const typingDelay = (t: string) => Math.min(2200, 600 + t.length * 22);
const clean = (s: string | null | undefined, max = 30) => (s ? s.trim().replace(/^["']|["']$/g, "").slice(0, max) || undefined : undefined);
const cap = (s?: string) => (s ? s.replace(/(^|[\s-])(\p{Ll})/gu, (_m, a, b) => a + b.toUpperCase()) : s);

export interface CallRecord {
  id: string;
  sid?: string;
  status: "ringing" | "active" | "done";
  answeredAt?: number;
  machine?: boolean;
}
export interface ImUser {
  phone: string;
  state: OnboardingState;
  items: ChatItem[];
  call?: CallRecord;
  lastActivity: number;
  nudgedAt?: number;
}

const key = (phone: string) => `u:${phone}`;

export async function load(phone: string): Promise<ImUser | null> {
  return (await redis.get<ImUser>(key(phone))) ?? null;
}

export async function update(phone: string, fn: (u: ImUser) => void | Promise<void>): Promise<ImUser> {
  return withLock(phone, async () => {
    const u = (await load(phone)) ?? { phone, state: initialState(), items: [], lastActivity: Date.now() };
    await fn(u);
    u.items = u.items.slice(-80);
    await redis.set(key(phone), u, { ex: 60 * 60 * 24 * 30 });
    return u;
  });
}

const item = (it: Omit<ChatItem, "id" | "at">): ChatItem => ({ ...it, id: uid(), at: Date.now() });

// ---------------------------------------------------------------- inbound

/** Record an inbound text; returns true if it's this person's first message ever. */
export async function recordInbound(phone: string, text: string, handle: string) {
  let first = false;
  await update(phone, (u) => {
    first = u.items.length === 0;
    u.items.push(item({ role: "user", kind: "text", text: text.slice(0, 2000) }));
    u.lastActivity = Date.now();
  });
  await redis.set(`last:${phone}`, handle, { ex: 600 });
  return first;
}

// ---------------------------------------------------------------- agent loop (one runner per phone)

const PRIORITY: Record<string, number> = { user_message: 0, nudge: 0, first_contact: 1 };
const prio = (e: AgentEvent) => PRIORITY[e.type] ?? 2;

export async function processEvent(phone: string, event: AgentEvent): Promise<void> {
  const runKey = `run:${phone}`;
  const pendKey = `pend:${phone}`;
  if (!(await redis.set(runKey, 1, { nx: true, ex: 120 }))) {
    const prev = await redis.get<AgentEvent>(pendKey);
    if (!prev || prio(event) >= prio(prev)) await redis.set(pendKey, event, { ex: 600 });
    return;
  }
  try {
    let ev: AgentEvent | null = event;
    while (ev) {
      await runOnce(phone, ev);
      ev = await redis.getdel<AgentEvent>(pendKey);
    }
  } finally {
    await redis.del(runKey);
  }
}

function channelNote() {
  return twilioConfigured() ? "" : " Calls are NOT available on this line yet: don't offer a call, collect everything over text.";
}

async function runOnce(phone: string, ev: AgentEvent) {
  const u = await load(phone);
  if (!u) return;
  if (ev.type === "nudge" && (u.state.graduated || u.call?.status === "active")) return;
  void sendTyping(phone);
  let reply: AgentReply | null = null;
  const state = { ...u.state, ...(channelNote() ? { declined: { ...u.state.declined, call: true } } : {}) };
  for (let i = 0; i < 2 && !reply; i++) {
    try {
      reply = await runTextAgent(state, u.items, ev, "imessage");
    } catch (e) {
      console.error("agent", e);
    }
  }
  if (!reply) {
    if (ev.type === "user_message" || ev.type === "first_contact") await say(phone, ["sorry, spaced out for a sec. say that again?"]);
    return;
  }
  await deliver(phone, reply, ev);
}

async function say(phone: string, messages: string[]) {
  for (let i = 0; i < messages.length; i++) {
    if (i > 0) {
      void sendTyping(phone);
      await sleep(typingDelay(messages[i]));
    }
    await sendText(phone, messages[i]);
    await update(phone, (u) => { u.items.push(item({ role: "agent", kind: "text", text: messages[i] })); });
  }
}

async function deliver(phone: string, reply: AgentReply, ev: AgentEvent) {
  const before = await load(phone);
  const hadName = !!before?.state.agentName;
  const up = reply.updates;
  const u = await update(phone, (x) => {
    x.state.agentName = cap(clean(up.agent_name)) ?? x.state.agentName;
    x.state.userName = cap(clean(up.user_name)) ?? x.state.userName;
    x.state.helpNeed = clean(up.help_need, 200) ?? x.state.helpNeed;
    x.state.declined = {
      call: x.state.declined.call || reply.declined_call,
      google: x.state.declined.google || reply.declined_google,
    };
  });
  const acts = new Set(reply.actions);
  if (!hadName && u.state.agentName) acts.add("send_contact_card");
  const wantCard = acts.has("send_contact_card") && !!u.state.agentName && !u.items.some((i) => i.kind === "contact_card" && i.text === u.state.agentName);

  const k = Math.max(0, reply.messages.findIndex((m) => /contact|save me/i.test(m))) + 1;
  await say(phone, reply.messages.slice(0, k));
  if (wantCard) {
    await sendContactCard(phone, u.state.agentName!);
  }
  if (reply.messages.length > k) {
    void sendTyping(phone);
    await sleep(900);
    await say(phone, reply.messages.slice(k));
  }

  const s = (await load(phone))!.state;
  if (acts.has("send_google_link") && s.google.status !== "connected") await sendGoogleLink(phone);
  if (acts.has("start_call") && twilioConfigured()) await startCall(phone);
  if (acts.has("graduate") && !s.graduated) await update(phone, (x) => { x.state.graduated = true; });
  if ((acts.has("send_inbox_summary") || ev.type === "google_connected" || ev.type === "call_ended") && s.google.status === "connected" && !s.summarySent) {
    await sleep(800);
    await inboxSummary(phone);
  }
}

// ---------------------------------------------------------------- actions

async function sendContactCard(phone: string, name: string) {
  const url = `${APP()}/api/vcard/${encodeURIComponent(name.replace(/[^\p{L}\p{N} ]/gu, "") || "Assistant")}.vcf`;
  await sendMedia(phone, url);
  await update(phone, (u) => { u.items.push(item({ role: "agent", kind: "contact_card", text: name })); });
}

export async function sendGoogleLink(phone: string) {
  const token = uid();
  await redis.set(`gt:${token}`, phone, { ex: 60 * 60 * 24 * 7 });
  await sendText(phone, `${APP()}/g/${token}`);
  await update(phone, (u) => {
    u.items.push(item({ role: "agent", kind: "google_link" }));
    if (u.state.google.status !== "connected") u.state.google = { ...u.state.google, status: "link_sent" };
  });
}

export async function inboxSummary(phone: string) {
  const u = await load(phone);
  if (!u || u.state.summarySent || u.state.google.status !== "connected") return;
  await update(phone, (x) => { x.state.summarySent = true; });
  void sendTyping(phone);
  if (u.state.google.demo) {
    await sleep(1200);
    await say(phone, ["(demo mode: real google sign-in isn't switched on yet, so i can't actually read an inbox here. with it on, your digest of what needs you lands right here.)"]);
    return;
  }
  const sess = unseal<GoogleSession>((await redis.get<string>(`g:${phone}`)) ?? undefined);
  const token = sess && (await freshAccessToken(sess));
  const out = token ? await inboxDigest(token, u.state).catch(() => ({ error: "x" })) : { error: "auth" };
  if (!Array.isArray(out) || !out.length) {
    await update(phone, (x) => { x.state.summarySent = false; });
    await say(phone, ["hm, gmail isn't letting me in just yet. ask me for an inbox rundown in a minute and i'll try again."]);
    return;
  }
  if (sess) await redis.set(`g:${phone}`, seal(sess), { ex: 60 * 60 * 24 * 30 });
  await say(phone, out);
  const st = (await load(phone))!.state;
  if (st.agentName && st.userName && st.helpNeed && !st.graduated) await update(phone, (x) => { x.state.graduated = true; });
}

export async function onGoogleConnected(phone: string, p: { email: string; name?: string; demo?: boolean; session?: GoogleSession }) {
  if (p.session) await redis.set(`g:${phone}`, seal(p.session), { ex: 60 * 60 * 24 * 30 });
  const u = await update(phone, (x) => {
    x.state.google = { status: "connected", email: p.email, name: p.name, demo: p.demo };
  });
  // on a live call the voice agent confirms via get_status; otherwise text them
  if (u.call?.status !== "active") await processEvent(phone, { type: "google_connected" });
}

// ---------------------------------------------------------------- calls

export async function startCall(phone: string) {
  const u = await load(phone);
  if (!u || (u.call && u.call.status !== "done")) return;
  const id = uid();
  await redis.set(`call:${id}`, phone, { ex: 60 * 60 * 6 });
  await update(phone, (x) => {
    x.call = { id, status: "ringing" };
    x.state.call = { ...x.state.call, status: "ringing" };
  });
  await sleep(1500);
  const res = await placeCall(phone, id, APP());
  if (!res) {
    await finishCall(phone, id, { log: "Call didn't go through", event: { type: "call_failed", reason: "the phone call couldn't be placed" }, status: "failed" });
    return;
  }
  await update(phone, (x) => { if (x.call?.id === id) x.call.sid = res.sid; });
}

export async function finishCall(
  phone: string,
  callId: string,
  o: { log: string; event: AgentEvent; status: OnboardingState["call"]["status"]; countIt?: boolean },
) {
  let already = false;
  await update(phone, (x) => {
    if (!x.call || x.call.id !== callId || x.call.status === "done") { already = true; return; }
    x.call.status = "done";
    x.state.call = {
      status: o.status,
      count: x.state.call.count + (o.countIt ? 1 : 0),
      lastEnd: o.event.type === "call_ended" ? o.event.reason : o.log.toLowerCase(),
    };
    x.items.push(item({ role: "system", kind: "call_log", text: o.log }));
    x.lastActivity = Date.now();
  });
  if (!already) await processEvent(phone, o.event);
}

export async function phoneForCall(callId: string | null) {
  return callId ? await redis.get<string>(`call:${callId}`) : null;
}

export const googleMode = () => (googleConfigured() ? "live" : "demo");
