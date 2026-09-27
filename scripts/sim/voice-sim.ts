// Voice-call simulations: ElevenLabs' simulator plays each persona against a temp copy of the call agent
// running the real per-call prompt, with the in-call tools mocked. Then Opus judges each call.
// Usage: npx tsx --env-file=.env.local scripts/sim/voice-sim.ts [personaId...]
import fs from "fs";
import { buildFirstMessage, buildVoicePrompt } from "../../src/lib/prompts";
import { initialState } from "../../src/lib/types";
import { VOICE_PERSONAS } from "./personas.mjs";
import { judge } from "./judge.mjs";
import { report } from "./cost.mjs";

const H = { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "content-type": "application/json" };
const api = async (m: string, p: string, b?: unknown) => {
  const r = await fetch("https://api.elevenlabs.io/v1/convai" + p, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${m} ${p} ${r.status} ${t.slice(0, 400)}`);
  return t ? JSON.parse(t) : {};
};

const state = { ...initialState(), agentName: "Jeff" };
const thread = "you: what do you want to call me?\nuser: jeff\nyou: jeff it is. save my contact so you'll know it's me when i call.\nyou: want to do a quick call?\nuser: sure\nyou: calling you now.";

type Turn = { role: string; message?: string; tool_calls?: { tool_name: string; params_as_json?: string }[] };

async function run(p: { id: string; prompt: string }) {
  const base = await api("GET", `/agents/${process.env.ELEVENLABS_AGENT_ID}`);
  const cfg = base.conversation_config;
  cfg.agent.prompt.prompt = buildVoicePrompt(state, thread, "web");
  cfg.agent.first_message = buildFirstMessage(state);
  delete cfg.agent.prompt.tools;
  const tmp = await api("POST", "/agents/create", { name: `tmp-sim-${p.id}`, conversation_config: cfg });
  try {
    const res = await api("POST", `/agents/${tmp.agent_id}/simulate-conversation`, {
      simulation_specification: {
        simulated_user_config: { prompt: { prompt: p.prompt + " Speak like a real person on the phone. Keep replies short.", llm: "gpt-4.1-mini" }, first_message: "hello?" },
        tool_mock_config: {
          send_google_link: { default_return_value: "Delivered. The 'Connect with Google' card is now in their text thread, and a banner with a Connect button is showing at the top of their call screen right now." },
          save_user_name: { default_return_value: "Saved." },
          save_help_need: { default_return_value: "Saved." },
          get_status: { default_return_value: JSON.stringify({ google: "not connected yet", note: "google_link_delivered_to_thread is true only if send_google_link succeeded earlier in this call" }) },
        },
      },
      new_turns_limit: 22,
    });
    const turns: Turn[] = res.simulated_conversation ?? [];
    const transcript = turns
      .map((t) => {
        const tools = (t.tool_calls ?? []).map((c) => `⚙ ${c.tool_name}(${c.params_as_json ?? ""})`).join(" ");
        const msg = (t.message ?? "").replace(/\s+/g, " ").trim();
        return msg || tools ? `${t.role === "agent" ? "AGENT" : "USER"}: ${msg} ${tools}`.trim() : "";
      })
      .filter(Boolean)
      .join("\n");
    const agentTurns = turns.filter((t) => t.role === "agent" && t.message?.trim()).map((t) => t.message!.split(/\s+/).length);
    const longest = Math.max(0, ...agentTurns);
    const linkSends = turns.flatMap((t) => t.tool_calls ?? []).filter((c) => c.tool_name === "send_google_link").length;
    const verdict = await judge("voice phone call", p.prompt, transcript, `Metrics: longest agent turn ${longest} words; send_google_link calls: ${linkSends}.`);
    return { persona: p.id, transcript, longest, linkSends, verdict };
  } finally {
    await api("DELETE", `/agents/${tmp.agent_id}`).catch(() => {});
  }
}

(async () => {
  const only = process.argv.slice(2);
  const personas = (VOICE_PERSONAS as { id: string; prompt: string }[]).filter((p) => !only.length || only.includes(p.id));
  const results: unknown[] = [];
  await Promise.all(personas.map(async (p) => {
    try {
      const r = await run(p);
      results.push(r);
      const v = r.verdict ?? { naturalness: 0, not_a_form: 0, edge_case_handling: 0, goal_progress: 0, violations: [] };
      console.log(`✓ ${p.id.padEnd(20)} nat=${v.naturalness} form=${v.not_a_form} edge=${v.edge_case_handling} goal=${v.goal_progress} violations=${v.violations.length} longest=${r.longest}w links=${r.linkSends}`);
    } catch (e) { console.log(`✗ ${p.id}: ${(e as Error).message.slice(0, 200)}`); }
  }));
  const out = process.env.SIM_OUT || "sim-voice-results.json";
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log(`wrote ${out}`);
  console.log(report());
})();
