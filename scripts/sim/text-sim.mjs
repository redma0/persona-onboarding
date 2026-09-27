// Multi-turn text onboarding simulations: an LLM plays each persona against the real /api/chat agent,
// with the app's client behavior (cards, calls, Google) emulated. Then Opus judges each transcript.
// Usage: node --env-file=.env.local scripts/sim/text-sim.mjs [personaId...]   (dev server on :3000)
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import fs from "fs";
import { TEXT_PERSONAS } from "./personas.mjs";
import { judge } from "./judge.mjs";

const client = new Anthropic();
const API = process.env.SIM_URL || "http://localhost:3000";
const INTRO = [
  "hey! i'm your new personal assistant",
  "you can text me or call me anytime and i can help with:\n📞 talking things through on a quick call\n💻 digging through the web for answers\n🛍️ finding and comparing stuff to buy\n✉️ sorting your email and calendar\n🚗 finding DoorDash or Uber options",
  "first things first, what should my name be?",
];
const GREETING = /^\s*(hi+|hey+|hello+|yo+|sup|hiya|what'?s? (a |this|up|persona)|what is (a |this)|who (are|is) (you|this))[\s\w'?,.!]*$/i;

const UserTurn = z.object({ messages: z.array(z.string()), done: z.boolean() });
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
    model: "claude-sonnet-5",
    max_tokens: 1500,
    output_config: { effort: "low", format: zodOutputFormat(UserTurn) },
    system: `You are role-playing a REAL person texting a new AI assistant app for the first time. Stay fully in character. Persona: ${p.desc}\nWrite 1-3 short text messages like a real person would (no quotes, no narration). Set done=true when you'd naturally stop texting (you got what you wanted, or you're bored/annoyed, or the assistant said you're all set and you have nothing to add).`,
    messages: [{ role: "user", content: `Conversation so far:\n${view(items) || "(empty, you text first: you just tapped 'text your new assistant')"}\n${note}\n\nYour next text(s):` }],
  });
  return res.parsed_output ?? { messages: ["ok"], done: true };
}

async function fakeCall(p, state, items) {
  const res = await client.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 1500,
    output_config: { effort: "low", format: zodOutputFormat(CallSummary) },
    system: "Write a realistic short phone-call transcript (6-10 lines) between an AI assistant (YOU) and a user (USER). The assistant greets them, asks their name, what they need help with, and offers to text a Google connect link. Stay true to the user's persona.",
    messages: [{ role: "user", content: `Assistant name: ${state.agentName ?? "your assistant"}. Known: ${JSON.stringify({ user_name: state.userName, help_need: state.helpNeed })}. User persona: ${p.desc}\nText thread so far:\n${view(items)}` }],
  });
  return res.parsed_output;
}

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
    const r = await fetch(`${API}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state, items, event }) });
    lastLatency = Date.now() - t;
    const d = await r.json();
    if (d.error) { add({ role: "agent", kind: "text", text: "sorry, spaced out for a sec there. say that again?" }); log.push("!! agent error"); return []; }
    const u = d.updates;
    const hadName = !!state.agentName;
    if (u.agent_name) state.agentName = u.agent_name;
    if (u.user_name) state.userName = u.user_name;
    if (u.help_need) state.helpNeed = u.help_need;
    state.declined = { call: state.declined.call || d.declined_call, google: state.declined.google || d.declined_google };
    for (const m of d.messages) add({ role: "agent", kind: "text", text: m });
    const acts = new Set(d.actions);
    if (!hadName && state.agentName) acts.add("send_contact_card");
    if (hadName && u.agent_name && !items.some((i) => i.kind === "contact_card" && i.text === state.agentName) && items.some((i) => i.kind === "contact_card")) acts.add("send_contact_card");
    if (acts.has("send_contact_card") && !items.some((i) => i.kind === "contact_card" && i.text === state.agentName)) add({ role: "agent", kind: "contact_card", text: state.agentName });
    if (acts.has("send_google_link") && state.google.status !== "connected") { add({ role: "agent", kind: "google_link" }); state.google.status = "link_sent"; }
    if (acts.has("graduate")) state.graduated = true;
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

  for (let turn = 0; turn < 12; turn++) {
    let note = "";
    const last = items[items.length - 1];
    if (last?.kind === "google_link" && p.google === "connect") note = "(If you're willing, you can say you tapped the Google card and connected. Only if it fits your persona.)";
    const u = await userSays(p, items, note);
    for (const m of u.messages) { add({ role: "user", kind: "text", text: m }); log.push(`USER: ${m}`); }
    const finishing = u.done && turn > 2;
    const firstUser = items.filter((i) => i.role === "user").length === u.messages.length;
    if (p.google === "connect" && state.google.status === "link_sent" && u.messages.some((m) => /connect|done|tapped|signed in|linked/i.test(m))) pendingConnect = true;

    let acts;
    if (firstUser && GREETING.test(u.messages.join(" ")) && u.messages.join(" ").length < 60) {
      for (const m of INTRO) add({ role: "agent", kind: "text", text: m });
      acts = [];
      log.push("   (scripted intro)");
    } else {
      acts = await agent(firstUser ? { type: "first_contact" } : { type: "user_message" });
    }
    if (pendingConnect) {
      pendingConnect = false;
      state.google = { status: "connected", email: "user@gmail.com", demo: true };
      acts = await agent({ type: "google_connected" });
      add({ role: "agent", kind: "text", text: "quick look at your inbox: 2 things actually need you · your landlord asked about the lease renewal (reply by friday) · a calendar invite from Priya for tuesday 3pm is waiting on a yes" });
      add({ role: "agent", kind: "text", text: "want me to draft a reply to your landlord?" });
      state.summarySent = true;
    }
    if (acts.includes("start_call")) await handleCall();
    if (finishing) break;
  }
  const transcript = items.map((i) => i.kind === "text" ? `${i.role === "user" ? "USER" : "AGENT"}: ${i.text}` : `  <${i.kind}${i.text ? `: ${i.text}` : ""}>`).join("\n");
  const verdict = await judge("text + simulated calls", p.desc, transcript);
  return { persona: p.id, desc: p.desc, state, transcript, log: log.join("\n"), verdict };
}

const only = process.argv.slice(2);
const personas = TEXT_PERSONAS.filter((p) => !only.length || only.includes(p.id));
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
