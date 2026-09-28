// Creates/updates the PHONE-call ElevenLabs agent (Twilio, real calls) with webhook tools.
// Usage: node --env-file=.env.local scripts/setup-phone-agent.mjs
const KEY = process.env.ELEVENLABS_API_KEY;
const APP = process.env.APP_URL;
const SECRET = process.env.VOICE_TOOL_SECRET;
const H = { "xi-api-key": KEY, "content-type": "application/json" };
async function api(method, path, body) {
  const res = await fetch("https://api.elevenlabs.io" + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

const phone = { type: "string", dynamic_variable: "user_phone" };
const TOOLS = [
  ["phone_send_google_link", "Texts the user the 'Connect with Google' link RIGHT NOW (as an iMessage). Call this BEFORE you say you've sent it. Returns whether it was delivered.", {}],
  ["phone_save_user_name", "Save what the user wants to be called, as soon as they tell you.", { name: { type: "string", description: "The name the user wants to be called" } }],
  ["phone_save_help_need", "Save the concrete thing the user wants help with, once it's clear (short, in their words).", { need: { type: "string", description: "Short description of what they want help with" } }],
  ["phone_get_status", "Returns what's already collected and whether the Google link was delivered/connected. Use when unsure, when they say they didn't get the link, or when they say they finished connecting.", {}],
];

async function main() {
  const existing = (await api("GET", "/v1/convai/tools")).tools || [];
  const ids = [];
  for (const [name, description, props] of TOOLS) {
    const tool_config = {
      type: "webhook",
      name,
      description,
      response_timeout_secs: 15,
      pre_tool_speech: name === "phone_send_google_link" ? "force" : "off",
      api_schema: {
        url: `${APP}/api/voice/tool/${name.replace("phone_", "")}`,
        method: "POST",
        request_headers: { "x-voice-secret": SECRET },
        request_body_schema: {
          type: "object",
          description: "tool input",
          properties: { user_phone: phone, ...props },
          required: ["user_phone", ...Object.keys(props)],
        },
      },
    };
    const found = existing.find((t) => t.tool_config?.name === name);
    if (found) { await api("PATCH", `/v1/convai/tools/${found.id}`, { tool_config }); ids.push(found.id); }
    else ids.push((await api("POST", "/v1/convai/tools", { tool_config })).id);
  }

  const conversation_config = {
    agent: {
      first_message: "hey! it's your new assistant.",
      language: "en",
      prompt: {
        prompt: "Per-call prompt is provided via override.",
        llm: process.env.VOICE_LLM || "claude-sonnet-5",
        reasoning_effort: process.env.VOICE_REASONING || "low", // "none" made Sonnet occasionally write tool calls as spoken text
        temperature: 0.6,
        tool_ids: ids,
        built_in_tools: {
          end_call: { name: "end_call", description: "Hang up after a warm goodbye once the call's purpose is done, or when the user wants to go.", params: { system_tool_type: "end_call" } },
        },
      },
    },
    tts: {
      model_id: "eleven_v4_turbo",
      voice_id: "cgSgspJ2msm6clMCkdW9",
      stability: 0.45, similarity_boost: 0.8, speed: 1.02,
      expressive_mode: false,
      suggested_audio_tags: [],
      agent_output_audio_format: "ulaw_8000",
    },
    asr: { user_input_audio_format: "ulaw_8000" },
    turn: {
      turn_timeout: 8,
      silence_end_call_timeout: 30,
      turn_eagerness: "normal",
      speculative_turn: true,
      interruption_ignore_terms: ["yeah", "yep", "mhm", "mm-hmm", "uh huh", "okay", "ok", "right", "sure", "got it", "cool"],
    },
    conversation: { max_duration_seconds: 600 },
  };
  const platform_settings = {
    // only sessions started with a server-issued token (never just the agent id)
    auth: { enable_auth: true },
    overrides: { conversation_config_override: { agent: { prompt: { prompt: true }, first_message: true }, tts: { voice_id: true } } },
  };
  const body = { name: "Persona onboarding phone call", conversation_config, platform_settings };
  const id = process.env.ELEVENLABS_PHONE_AGENT_ID;
  if (id) { await api("PATCH", `/v1/convai/agents/${id}`, body); console.log(`updated ${id}`); }
  else console.log(`ELEVENLABS_PHONE_AGENT_ID=${(await api("POST", "/v1/convai/agents/create", body)).agent_id}`);

  // post-call webhook (transcripts) → our app
  if (!process.env.ELEVENLABS_WEBHOOK_SECRET) {
    const hooks = await api("GET", "/v1/workspace/webhooks");
    console.log("existing webhooks:", JSON.stringify(hooks).slice(0, 300));
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
