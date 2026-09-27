// Simulates a voice call (text-only) against a temp copy of the agent with the real per-call prompt.
// Usage: npx tsx --env-file=.env.local scripts/simulate-call.ts "<simulated user persona>"
import { buildFirstMessage, buildVoicePrompt } from "../src/lib/prompts";
import { initialState } from "../src/lib/types";

const KEY = process.env.ELEVENLABS_API_KEY!;
const AGENT = process.env.ELEVENLABS_AGENT_ID!;
const H = { "xi-api-key": KEY, "content-type": "application/json" };
const api = async (m: string, p: string, b?: unknown) => {
  const r = await fetch("https://api.elevenlabs.io/v1/convai" + p, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${m} ${p} ${r.status} ${t.slice(0, 800)}`);
  return t ? JSON.parse(t) : {};
};

const state = { ...initialState(), agentName: "Jeff" };
const thread = "you: first things first, what do you want to call me?\nuser: jeff\nyou: jeff it is. save my contact so you'll know it's me when i call.\nyou: want to do a quick call?\nuser: sure\nyou: calling you now.";
const persona = process.argv[2] ||
  "You are Riyad, a busy startup founder, picking up a phone call from your new AI assistant 'Jeff'. Talk casually and briefly like a real person on the phone. Your name is Riyad. You want help staying on top of investor and recruiter emails. When the assistant says it sent you a link, say you don't see it. Then ask for it again. Then say 'oh wait, found it' and later say 'okay done, i connected it'. If it ever asks for your email address, get annoyed. End the call when it wraps up.";

(async () => {
  const base = await api("GET", `/agents/${AGENT}`);
  const cfg = base.conversation_config;
  cfg.agent.prompt.prompt = buildVoicePrompt(state, thread);
  cfg.agent.first_message = buildFirstMessage(state);
  delete cfg.agent.prompt.tools;
  const tmp = await api("POST", "/agents/create", { name: "tmp-sim", conversation_config: cfg });
  try {
    let sent = 0;
    const res = await api("POST", `/agents/${tmp.agent_id}/simulate-conversation`, {
      simulation_specification: {
        simulated_user_config: { prompt: { prompt: persona, llm: "gpt-4.1-mini" }, first_message: "hello?" },
        tool_mock_config: {
          send_google_link: { default_return_value: "Delivered. The 'Connect with Google' card is now in their text thread, and a banner with a Connect button is showing at the top of their call screen right now." },
          save_user_name: { default_return_value: "Saved." },
          save_help_need: { default_return_value: "Saved." },
          get_status: { default_return_value: JSON.stringify({ user_name: "Riyad", google: "link_sent", google_link_delivered_to_thread: true }) },
        },
      },
      new_turns_limit: 24,
    });
    for (const t of res.simulated_conversation ?? []) {
      const tools = (t.tool_calls ?? []).map((c: { tool_name: string; params_as_json?: string }) => `⚙ ${c.tool_name}(${c.params_as_json ?? ""})`).join(" ");
      if (tools.includes("send_google_link")) sent++;
      console.log(`${t.role === "agent" ? "JEFF" : "USER"}: ${t.message ?? ""} ${tools}`);
    }
    console.log(`\nsend_google_link calls: ${sent}`);
    console.log("analysis:", JSON.stringify(res.analysis?.transcript_summary ?? "").slice(0, 400));
  } finally {
    await api("DELETE", `/agents/${tmp.agent_id}`);
  }
})();
