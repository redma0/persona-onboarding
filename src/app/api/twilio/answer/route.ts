import { buildFirstMessage, buildVoicePrompt } from "@/lib/prompts";
import { load, phoneForCall, update } from "@/lib/imessage";

const hangupTwiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`;
const xml = (s: string) => new Response(s, { headers: { "content-type": "text/xml" } });

// Twilio hits this when the callee picks up: hand the audio stream to the ElevenLabs phone agent.
export async function POST(req: Request) {
  const callId = new URL(req.url).searchParams.get("c");
  const phone = await phoneForCall(callId);
  const u = phone ? await load(phone) : null;
  if (!phone || !u || u.call?.id !== callId) return xml(hangupTwiml);
  const form = await req.formData();

  const thread = u.items.slice(-14).map((i) =>
    i.kind === "text" ? `${i.role === "user" ? "user" : "you"}: ${i.text}` : i.kind === "google_link" ? "(you texted the Connect with Google link)" : i.kind === "call_log" ? `(${i.text})` : "",
  ).filter(Boolean).join("\n");

  const r = await fetch("https://api.elevenlabs.io/v1/convai/twilio/register-call", {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "content-type": "application/json" },
    body: JSON.stringify({
      agent_id: process.env.ELEVENLABS_PHONE_AGENT_ID,
      from_number: String(form.get("From") ?? process.env.TWILIO_FROM_NUMBER),
      to_number: String(form.get("To") ?? phone),
      direction: "outbound",
      conversation_initiation_client_data: {
        dynamic_variables: { user_phone: phone, call_id: callId },
        conversation_config_override: {
          agent: { prompt: { prompt: buildVoicePrompt(u.state, thread, "phone") }, first_message: buildFirstMessage(u.state) },
          tts: { voice_id: u.state.voiceId },
        },
      },
    }),
  });
  if (!r.ok) {
    console.error("register-call", r.status, await r.text());
    return xml(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, something went wrong. I'll text you instead.</Say><Hangup/></Response>`);
  }
  await update(phone, (x) => {
    if (x.call?.id === callId) { x.call.status = "active"; x.call.answeredAt = Date.now(); x.state.call.status = "active"; }
  });
  return xml(await r.text());
}
