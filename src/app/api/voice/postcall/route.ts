import crypto from "crypto";
import { after } from "next/server";
import { finishCall, load } from "@/lib/imessage";

export const maxDuration = 300;

function verify(raw: string, header: string | null) {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  if (!parts.t || !parts.v0) return false;
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 30 * 60) return false;
  const mac = crypto.createHmac("sha256", secret).update(`${parts.t}.${raw}`).digest("hex");
  return mac.length === parts.v0.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(parts.v0));
}

type Turn = { role: string; message?: string | null };

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verify(raw, req.headers.get("elevenlabs-signature"))) return new Response("bad signature", { status: 401 });
  const body = JSON.parse(raw);
  const d = body.data ?? {};
  if (d.agent_id !== process.env.ELEVENLABS_PHONE_AGENT_ID) return new Response("ok"); // web-simulator calls: ignore
  const vars = d.conversation_initiation_client_data?.dynamic_variables ?? {};
  const phone: string | undefined = vars.user_phone;
  const callId: string | undefined = vars.call_id;
  if (!phone || !callId) return new Response("ok");
  const u = await load(phone);
  if (!u || u.call?.id !== callId) return new Response("ok");

  if (body.type === "call_initiation_failure") {
    after(() => finishCall(phone, callId, { log: "Missed call", status: "missed", event: { type: "call_missed" } }));
    return new Response("ok");
  }
  if (u.call.machine) {
    after(() => finishCall(phone, callId, { log: "Declined call", status: "declined", event: { type: "call_declined" } }));
    return new Response("ok");
  }

  const transcript = ((d.transcript ?? []) as Turn[])
    .filter((t) => t.message)
    .map((t) => `${t.role === "user" ? "USER" : "YOU"}: ${String(t.message).replace(/\[[^\]]{1,30}\]\s*/g, "")}`)
    .join("\n");
  const dur = Math.round(d.metadata?.call_duration_secs ?? 0);
  const term = String(d.metadata?.termination_reason ?? "");
  const reason = /end_call/i.test(term)
    ? "you (voice agent) ended the call after wrapping up"
    : /remote|client|user|hang/i.test(term)
      ? "the user hung up"
      : /timeout|silence/i.test(term)
        ? "the call timed out after silence"
        : `the call ended (${term || "unknown reason"})`;

  after(() =>
    finishCall(phone, callId, {
      log: `Call · ${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, "0")}`,
      status: "ended",
      countIt: true,
      event: { type: "call_ended", reason, durationSec: dur, transcript },
    }),
  );
  return new Response("ok");
}
