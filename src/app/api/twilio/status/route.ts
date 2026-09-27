import { after } from "next/server";
import { finishCall, load, phoneForCall } from "@/lib/imessage";

export const maxDuration = 120;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  const callId = new URL(req.url).searchParams.get("c");
  const phone = await phoneForCall(callId);
  if (!phone || !callId) return new Response("ok");
  const f = await req.formData();
  const st = String(f.get("CallStatus"));
  const u = await load(phone);
  if (!u || u.call?.id !== callId) return new Response("ok");

  if (st === "busy" || st === "no-answer" || st === "canceled" || st === "failed") {
    const declined = st === "busy";
    after(() =>
      finishCall(phone, callId, {
        log: declined ? "Declined call" : st === "failed" ? "Call didn't go through" : "Missed call",
        status: declined ? "declined" : st === "failed" ? "failed" : "missed",
        event: st === "failed" ? { type: "call_failed", reason: "the call couldn't connect" } : declined ? { type: "call_declined" } : { type: "call_missed" },
      }),
    );
  } else if (st === "completed") {
    if (u.call.machine) {
      after(() => finishCall(phone, callId, { log: "Declined call", status: "declined", event: { type: "call_declined" } }));
    } else {
      // normal path: the ElevenLabs post-call webhook finalizes with the transcript; this is the safety net
      after(async () => {
        await sleep(45_000);
        const dur = Number(f.get("CallDuration") ?? 0);
        await finishCall(phone, callId, {
          log: dur ? `Call · ${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, "0")}` : "Call ended",
          status: "ended",
          countIt: true,
          event: { type: "call_ended", reason: "the call ended (no transcript available)", durationSec: dur, transcript: "" },
        });
      });
    }
  }
  return new Response("ok");
}
