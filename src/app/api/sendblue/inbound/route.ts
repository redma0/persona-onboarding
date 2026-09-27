import { after } from "next/server";
import { processEvent, recordInbound, scheduleNudge } from "@/lib/imessage";
import { redis } from "@/lib/db";
import { markRead } from "@/lib/sendblue";

export const maxDuration = 300;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  const url = new URL(req.url);
  if (process.env.SENDBLUE_WEBHOOK_KEY && url.searchParams.get("k") !== process.env.SENDBLUE_WEBHOOK_KEY) {
    return new Response("nope", { status: 401 });
  }
  const b = await req.json().catch(() => null);
  if (!b || b.is_outbound || b.group_id || !b.from_number) return Response.json({ ok: true });
  // Sendblue retries on failures: dedupe on message handle
  if (b.message_handle && !(await redis.set(`seen:${b.message_handle}`, 1, { nx: true, ex: 3600 }))) return Response.json({ ok: true });

  const phone: string = b.from_number;
  const text = [b.content, b.media_url ? "(sent an attachment)" : ""].filter(Boolean).join(" ").trim();
  if (!text) return Response.json({ ok: true });
  const first = await recordInbound(phone, text, b.message_handle ?? String(Date.now()));

  after(async () => {
    void markRead(phone);
    // people send bursts ("hey" / "wait" / "what is this"): wait for a pause, then answer all of it once
    await sleep(first ? 1200 : 2200);
    if ((await redis.get(`last:${phone}`)) !== (b.message_handle ?? null) && b.message_handle) return;
    await processEvent(phone, first ? { type: "first_contact" } : { type: "user_message" });
    await scheduleNudge(phone);
  });
  return Response.json({ ok: true });
}

