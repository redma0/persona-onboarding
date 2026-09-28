// Creates (or updates) the ElevenLabs voice agent + its client tools.
// Usage: node --env-file=.env.local scripts/setup-agent.mjs
// Prints ELEVENLABS_AGENT_ID to add to .env.local.

const KEY = process.env.ELEVENLABS_API_KEY;
const BASE = "https://api.elevenlabs.io/v1/convai";
const H = { "xi-api-key": KEY, "content-type": "application/json" };

async function api(method, path, body) {
  const res = await fetch(BASE + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

const CLIENT_TOOLS = [
  {
    name: "send_google_link",
    description:
      "Puts the 'Connect with Google' link into the user's text thread RIGHT NOW. Call this BEFORE you say you've sent it. Returns whether it was delivered. Never call it more than once unless get_status says it isn't connected and the user says they can't find it.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "save_user_name",
    description: "Save what the user wants to be called, as soon as they tell you.",
    parameters: {
      type: "object",
      properties: { name: { type: "string", description: "The name the user wants to be called" } },
      required: ["name"],
    },
  },
  {
    name: "save_help_need",
    description:
      "Save the concrete thing the user wants help with, as soon as it's clear (one short sentence in their words, e.g. 'staying on top of recruiter emails').",
    parameters: {
      type: "object",
      properties: { need: { type: "string", description: "Short description of what they want help with" } },
      required: ["need"],
    },
  },
  {
    name: "get_status",
    description:
      "Returns what's already been collected and whether the Google link was delivered/connected. Call it when unsure, or when the user says they didn't get the link.",
    parameters: { type: "object", properties: {}, required: [] },
  },
];

async function upsertTools() {
  const existing = await api("GET", "/tools");
  const ids = [];
  for (const t of CLIENT_TOOLS) {
    const tool_config = {
      type: "client",
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      // saving facts shouldn't block the reply; link/status tools must wait for their answer
      expects_response: true, // non-blocking saves caused the model to occasionally repeat its line
      // say a quick "sending it now" while the link tool runs, so the line never goes silent
      // only the link tool gets filler speech; "auto" on silent tools produced odd narration (even in German)
      pre_tool_speech: t.name === "send_google_link" ? "force" : "off",
      response_timeout_secs: 10,
    };
    const found = (existing.tools || []).find((x) => x.tool_config?.name === t.name);
    if (found) {
      await api("PATCH", `/tools/${found.id}`, { tool_config });
      ids.push(found.id);
    } else {
      const created = await api("POST", "/tools", { tool_config });
      ids.push(created.id);
    }
  }
  return ids;
}

const BASE_PROMPT =
  "You are a friendly personal assistant on a phone call. The full instructions are provided per call via override.";

async function main() {
  const toolIds = await upsertTools();
  const conversation_config = {
    agent: {
      first_message: "hey! it's your new assistant.",
      language: "en",
      prompt: {
        prompt: BASE_PROMPT,
        llm: process.env.VOICE_LLM || "claude-sonnet-5",
        reasoning_effort: process.env.VOICE_REASONING || "low", // "none" made Sonnet occasionally write tool calls as spoken text
        temperature: 0.6,
        tool_ids: toolIds,
        built_in_tools: {
          end_call: {
            name: "end_call",
            description:
              "Hang up. Use after a warm goodbye once the call's purpose is done, or when the user clearly wants to go.",
            params: { system_tool_type: "end_call" },
          },
        },
      },
    },
    tts: {
      model_id: process.env.TTS_MODEL || "eleven_v4_turbo",
      voice_id: process.env.VOICE_ID || "kdmDKE6EkgrWrrykO9Qt",
      stability: 0.45,
      similarity_boost: 0.8,
      speed: 1.02,
      expressive_mode: false, // don't auto-inject [warm]/[thinking]-style audio tags
      suggested_audio_tags: [],
    },
    turn: {
      turn_timeout: 8,
      silence_end_call_timeout: 45,
      turn_eagerness: "normal",
      speculative_turn: true,
      interruption_ignore_terms: ["yeah", "yep", "mhm", "mm-hmm", "uh huh", "okay", "ok", "right", "sure", "got it", "cool"],
    },
    conversation: { max_duration_seconds: 600 },
  };
  const platform_settings = {
    // only sessions started with a server-issued token (never just the agent id)
    auth: { enable_auth: true },
    overrides: {
      conversation_config_override: {
        agent: { prompt: { prompt: true }, first_message: true },
        tts: { voice_id: true },
      },
    },
  };
  const body = { name: "Persona onboarding call", conversation_config, platform_settings };
  const id = process.env.ELEVENLABS_AGENT_ID;
  if (id) {
    await api("PATCH", `/agents/${id}`, body);
    console.log(`updated ELEVENLABS_AGENT_ID=${id}`);
  } else {
    const created = await api("POST", "/agents/create", body);
    console.log(`ELEVENLABS_AGENT_ID=${created.agent_id}`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
