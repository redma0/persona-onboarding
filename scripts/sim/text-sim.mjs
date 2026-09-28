// Multi-turn text onboarding simulations: an LLM plays each persona against the real /api/chat agent,
// with the app's client behavior (cards, calls, Google) emulated. Then Opus judges each transcript.
// Usage: node --env-file=.env.local scripts/sim/text-sim.mjs [personaId...]   (dev server on :3000)
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import fs from "fs";
import { TEXT_PERSONAS } from "./personas.mjs";
import { judge } from "./judge.mjs";
import { charge, overBudget, report, BUDGET } from "./cost.mjs";

// Cheap by default: Haiku plays the users; the agent under test is the real one (Opus 5.5, cached).
const USER_MODEL = process.env.SIM_USER_MODEL || "claude-haiku-4-5";
const AGENT_MODEL = "claude-opus-5-5";

const client = new Anthropic();
const API = process.env.SIM_URL || "http://localhost:3000";
const INTRO = [
  "it's me, your new assistant. i live in your texts and handle the annoying stuff",
  'people text me things like "find a dentist that takes my insurance" or "is anyone waiting on a reply from me?"',
  "i don't have a name yet though. what should i go by?",
];
const GREETING = /^\s*(hi+|hey+|hello+|yo+|sup|hiya|howdy)?[\s,!.]*((what'?s|what is|who'?s|who is) (a |an |this|that|up|persona|you)[\w\s]*)?[\s?!.👋]*$/i;

const UserTurn = z.object({ messages: z.array(z.string()), done: z.boolean(), connected_google: z.boolean().describe("true only if, in this turn, you actually tapped the Connect with Google card and approved it") });
const CallSummary = z.object({ transcript: z.string(), user_name: z.string().nullable(), help_need: z.string().nullable(), asked_for_link: z.boolean() });

const view = (items) => items.map((i) => {
  if (i.kind === "contact_card") return "[assistant sent a contact card]";
  if (i.kind === "google_link") return "[assistant sent a 'Connect with Google' card with a button]";
  if (i.kind === "call_log") return `[${i.text}]`;
  if (i.kind === "band_card") return "[assistant sent a link to Persona Band]";
  return `${i.role === "user" ? "ME" : "ASSISTANT"}: ${i.text}`;
}).join("\n");

async function userSays(p, items, note = "") {
  const res = await client.messages.parse({
    model: USER_MODEL,
    max_tokens: 1500,
    output_config: { format: zodOutputFormat(UserTurn) },
    system: `You are role-playing a REAL person texting a new AI assistant app for the first time. Stay fully in character. Persona: ${p.desc}\nWrite 1-3 short text messages like a real person would (no quotes, no narration). Set done=true when you'd naturally stop texting (you got what you wanted, or you're bored/annoyed, or the assistant said you're all set and you have nothing to add).`,
    messages: [{ role: "user", content: `Conversation so far:\n${view(items) || "(empty, you text first: you just tapped 'text your new assistant')"}\n${note}\n\nYour next text(s):` }],
  });
  charge("sim users", USER_MODEL, res.usage);
  return res.parsed_output ?? { messages: ["ok"], done: true };
}

async function fakeCall(p, state, items) {
  const res = await client.messages.parse({
    model: USER_MODEL,
    max_tokens: 1500,
    output_config: { format: zodOutputFormat(CallSummary) },
    system: "Write a realistic short phone-call transcript (6-10 lines) between an AI assistant (YOU) and a user (USER). The assistant greets them, asks their name, what they need help with, and offers to text a Google connect link. Stay true to the user's persona.",
    messages: [{ role: "user", content: `Assistant name: ${state.agentName ?? "your assistant"}. Known: ${JSON.stringify({ user_name: state.userName, help_need: state.helpNeed })}. User persona: ${p.desc}\nText thread so far:\n${view(items)}` }],
  });
  charge("sim users", USER_MODEL, res.usage);
  return res.parsed_output;
}

// mirror of src/lib/onboarding.ts (attempt tracking + graduation gate)
const MAX = 2;
const isDone = (s, k) => k === "agent_name" ? !!s.agentName : k === "user_name" ? !!s.userName : k === "help_need" ? !!s.helpNeed : k === "google" ? s.google.status === "connected" : s.call.count > 0 || ["ended", "declined", "missed", "failed"].includes(s.call.status);
const isBlocked = (s, k) => (k === "call" && s.declined.call) || (k === "google" && s.declined.google);
const openSteps = (s) => ["agent_name", "call", "user_name", "help_need", "google"].filter((k) => !isDone(s, k) && !isBlocked(s, k) && (s.attempts?.[k] ?? 0) < MAX);
function recordAsked(s, asked, skip) {
  const a = { ...(s.attempts ?? {}) };
  for (const k of new Set(asked)) a[k] = (a[k] ?? 0) + 1;
  if (skip) for (const k of openSteps(s)) if (k !== "agent_name") a[k] = MAX;
  s.attempts = a;
}
const canGraduate = (s) => !!s.agentName && openSteps(s).length === 0;

let n = 0;
const id = () => `i${n++}`;

async function simulate(p) {
  const state = { google: { status: "none" }, call: { status: "never", count: 0 }, graduated: false, voiceId: "x", declined: {} };
  const items = [];
  const add = (it) => items.push({ id: id(), at: Date.now(), ...it });
  const log = [];
  let pendingConnect = false;
  let lastLatency = 0;

  async function agent(event) {
    const t = Date.now();
    const r = await fetch(`${API}/api/chat`, { method: "POST", headers: { "content-type": "application/json", "x-sim-google": "1" }, body: JSON.stringify({ state, items, event }) });
    lastLatency = Date.now() - t;
    const d = await r.json();
    if (d.usage) { charge("agent", AGENT_MODEL, d.usage); log.push(`   (cache read ${d.usage.cacheRead} / uncached ${d.usage.input} tokens)`); }
    if (d.error) { add({ role: "agent", kind: "text", text: "sorry, spaced out for a sec there. say that again?" }); log.push("!! agent error"); return []; }
    const u = d.updates;
    const hadName = !!state.agentName;
    if (u.agent_name) state.agentName = u.agent_name;
    if (u.user_name) state.userName = u.user_name;
    if (u.help_need) state.helpNeed = u.help_need;
    state.declined = { call: state.declined.call || d.declined_call, google: state.declined.google || d.declined_google };
    recordAsked(state, d.asked ?? [], !!d.skip_setup);
    if (d.usage?.searches) add({ role: "system", kind: "call_log", text: `agent ran ${d.usage.searches} real web search(es) before replying` });
    for (const m of d.messages) add({ role: "agent", kind: "text", text: m });
    const acts = new Set(d.actions);
    if (!hadName && state.agentName) acts.add("send_contact_card");
    if (hadName && u.agent_name && !items.some((i) => i.kind === "contact_card" && i.text === state.agentName) && items.some((i) => i.kind === "contact_card")) acts.add("send_contact_card");
    if (acts.has("send_contact_card") && !items.some((i) => i.kind === "contact_card" && i.text === state.agentName)) add({ role: "agent", kind: "contact_card", text: state.agentName });
    const recentLink = items.slice(-8).some((i) => i.kind === "google_link");
    const userAskedLink = /link|resend|send (it|again)|can'?t find|don'?t see/i.test([...items].reverse().find((i) => i.role === "user")?.text ?? "");
    if (acts.has("send_google_link") && state.google.status !== "connected" && (!recentLink || userAskedLink)) { add({ role: "agent", kind: "google_link" }); state.google.status = "link_sent"; }
    if (!state.graduated && (canGraduate(state) || (acts.has("graduate") && d.skip_setup && state.agentName))) state.graduated = true;
    log.push(`   (${(lastLatency / 1000).toFixed(1)}s, actions=${[...acts].join(",") || "-"})`);
    return [...acts];
  }

  async function handleCall() {
    if (p.call === "decline") { add({ role: "system", kind: "call_log", text: "Declined call" }); state.call.status = "declined"; return agent({ type: "call_declined" }); }
    if (p.call === "missed") { add({ role: "system", kind: "call_log", text: "Missed call" }); state.call.status = "missed"; return agent({ type: "call_missed" }); }
    if (p.call === "mic_blocked") { add({ role: "system", kind: "call_log", text: "Call didn't connect" }); state.call.status = "failed"; return agent({ type: "call_failed", reason: "microphone permission was blocked or no mic is available" }); }
    if (p.call === "hangup_early") {
      add({ role: "system", kind: "call_log", text: "Call · 0:10" });
      state.call = { status: "ended", count: state.call.count + 1, lastEnd: "the user hung up" };
      return agent({ type: "call_ended", reason: "the user hung up", durationSec: 10, transcript: `YOU: hey! it's ${state.agentName ?? "me"}. thanks for picking up, first things first, what should i call you?\nUSER: hey sorry, super busy right now` });
    }
    const c = await fakeCall(p, state, items);
    if (c.user_name) state.userName = c.user_name;
    if (c.help_need) state.helpNeed = c.help_need;
    if (c.asked_for_link && state.google.status !== "connected") { add({ role: "agent", kind: "google_link" }); state.google.status = "link_sent"; }
    const dur = 95;
    add({ role: "system", kind: "call_log", text: `Call with ${state.agentName ?? "Persona"} · 1:35` });
    state.call = { status: "ended", count: state.call.count + 1, lastEnd: "you (voice agent) ended the call after wrapping up" };
    log.push(`   [call transcript]\n${c.transcript.split("\n").map((l) => "      " + l).join("\n")}`);
    return agent({ type: "call_ended", reason: "you (voice agent) ended the call after wrapping up", durationSec: dur, transcript: c.transcript });
  }

  const maxTurns = Number(process.env.SIM_TURNS || 10);
  for (let turn = 0; turn < maxTurns; turn++) {
    if (overBudget()) { log.push("!! stopped: budget reached"); break; }
    let note = "";
    const last = items[items.length - 1];
    if (last?.kind === "google_link" && p.google === "connect") note = "(If you're willing, you can say you tapped the Google card and connected. Only if it fits your persona.)";
    const u = await userSays(p, items, note);
    for (const m of u.messages) { add({ role: "user", kind: "text", text: m }); log.push(`USER: ${m}`); }
    const finishing = u.done && turn > 2;
    const firstUser = items.filter((i) => i.role === "user").length === u.messages.length;
    if (state.google.status === "link_sent" && u.connected_google) pendingConnect = true;

    if (pendingConnect) {
      // real app: the OAuth popup closes (and the app registers the connection) before the user comes back to type
      pendingConnect = false;
      state.google = { status: "connected", email: "user@gmail.com" };
      add({ role: "system", kind: "call_log", text: "app event: Google connected successfully" });
    }
    let acts;
    if (firstUser && GREETING.test(u.messages.join(" ")) && u.messages.join(" ").length < 60) {
      for (const m of INTRO) add({ role: "agent", kind: "text", text: m });
      recordAsked(state, ["agent_name"], false);
      acts = [];
      log.push("   (scripted intro)");
    } else {
      acts = await agent(firstUser ? { type: "first_contact" } : { type: "user_message" });
    }
    if (state.google.status === "connected" && !state.summarySent) {
      acts = [...acts, ...(await agent({ type: "google_connected" }))];
      add({ role: "system", kind: "call_log", text: "app sent the user a real inbox digest here, built from their actual Gmail (content omitted in this simulation)" });
      state.summarySent = true;
    }
    if (acts.includes("start_call")) await handleCall();
    if (finishing) break;
  }
  const transcript = items.map((i) => i.kind === "text" ? `${i.role === "user" ? "USER" : "AGENT"}${i.digest ? " [inbox digest generated from their real Gmail]" : ""}: ${i.text}` : `  <${i.kind}${i.text ? `: ${i.text}` : ""}>`).join("\n");
  const verdict = await judge("text + simulated calls", p.desc, transcript);
  return { persona: p.id, desc: p.desc, state, transcript, log: log.join("\n"), verdict };
}

const only = process.argv.slice(2);
const personas = TEXT_PERSONAS.filter((p) => !only.length || only.includes(p.id));
console.log(`budget $${BUDGET} · users=${USER_MODEL} · judge=${process.env.SIM_JUDGE_MODEL || "claude-sonnet-5"}`);
const results = [];
await Promise.all(personas.map(async (p) => {
  try {
    const r = await simulate(p);
    results.push(r);
    const v = r.verdict;
    console.log(`✓ ${p.id.padEnd(18)} nat=${v.naturalness} form=${v.not_a_form} edge=${v.edge_case_handling} goal=${v.goal_progress} violations=${v.violations.length}`);
  } catch (e) { console.log(`✗ ${p.id}: ${e.message}`); }
}));
const out = process.env.SIM_OUT || "sim-text-results.json";
fs.writeFileSync(out, JSON.stringify(results, null, 2));
console.log(`\nwrote ${out}`);
console.log(report());
