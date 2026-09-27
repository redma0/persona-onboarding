import { after } from "next/server";
import { redis } from "@/lib/db";
import { processEvent, recordInbound, scheduleNudge } from "@/lib/imessage";
import { markRead } from "@/lib/sendblue";

export const maxDuration = 300;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// BlueBubbles webhook ("new-message"). Same pipeline as the Sendblue webhook.
export async function POST(req: Request) {
  if (new URL(req.url).searchParams.get("k") !== process.env.BLUEBUBBLES_WEBHOOK_KEY) return new Response("nope", { status: 401 });
  const b = await req.json().catch(() => null);
  const m = b?.data;
  if (b?.type !== "new-message" || !m || m.isFromMe) return Response.json({ ok: true });
  const chat = m.chats?.[0];
  if (chat && (chat.style === 43 || String(chat.guid).includes(";+;"))) return Response.json({ ok: true }); // ignore group chats
  const address: string | undefined = m.handle?.address;
  if (!address) return Response.json({ ok: true });
  if (m.guid && !(await redis.set(`seen:${m.guid}`, 1, { nx: true, ex: 3600 }))) return Response.json({ ok: true });
  if (chat?.guid) await redis.set(`cg:${address}`, chat.guid, { ex: 60 * 60 * 24 * 30 });

  const text = [m.text, m.attachments?.length ? "(sent an attachment)" : ""].filter(Boolean).join(" ").trim();
  if (!text) return Response.json({ ok: true });
  const handle = m.guid ?? String(Date.now());
  const first = await recordInbound(address, text, handle);

  after(async () => {
    void markRead(address);
    await sleep(first ? 1200 : 2200);
    if ((await redis.get(`last:${address}`)) !== handle) return;
    await processEvent(address, first ? { type: "first_contact" } : { type: "user_message" });
    await scheduleNudge(address);
  });
  return Response.json({ ok: true });
}
