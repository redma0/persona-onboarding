const sid = () => process.env.TWILIO_ACCOUNT_SID!;
const auth = () => "Basic " + Buffer.from(`${sid()}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
export const twilioConfigured = () => !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);

async function call(path: string, form: Record<string, string | string[]>) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(form)) (Array.isArray(v) ? v : [v]).forEach((x) => body.append(k, x));
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid()}${path}`, {
    method: "POST",
    headers: { authorization: auth(), "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) console.error("twilio", path, r.status, JSON.stringify(d).slice(0, 300));
  return r.ok ? d : null;
}

export function placeCall(to: string, callId: string, app: string) {
  return call("/Calls.json", {
    To: to,
    From: process.env.TWILIO_FROM_NUMBER!,
    Url: `${app}/api/twilio/answer?c=${callId}`,
    StatusCallback: `${app}/api/twilio/status?c=${callId}`,
    StatusCallbackEvent: ["answered", "completed"],
    MachineDetection: "Enable",
    AsyncAmd: "true",
    AsyncAmdStatusCallback: `${app}/api/twilio/amd?c=${callId}`,
    Timeout: "25",
  });
}

export const hangup = (callSid: string) => call(`/Calls/${callSid}.json`, { Status: "completed" });
