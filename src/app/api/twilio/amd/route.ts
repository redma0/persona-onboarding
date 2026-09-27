import { hangup } from "@/lib/twilio";
import { phoneForCall, update } from "@/lib/imessage";

// Declined calls on iPhone roll to voicemail; if a machine answers, hang up and treat it as declined.
export async function POST(req: Request) {
  const callId = new URL(req.url).searchParams.get("c");
  const phone = await phoneForCall(callId);
  const f = await req.formData();
  const by = String(f.get("AnsweredBy") ?? "");
  if (phone && /machine|fax/.test(by)) {
    await update(phone, (x) => { if (x.call?.id === callId) x.call.machine = true; });
    await hangup(String(f.get("CallSid")));
  }
  return new Response("ok");
}
