import { redis } from "@/lib/db";

// Lets us point the app at a new BlueBubbles tunnel URL without redeploying.
export async function POST(req: Request) {
  const { key, url } = await req.json().catch(() => ({}));
  if (!key || key !== process.env.BLUEBUBBLES_WEBHOOK_KEY || !/^https:\/\//.test(String(url))) return new Response("nope", { status: 401 });
  await redis.set("bb:url", String(url).replace(/\/$/, ""));
  return Response.json({ ok: true });
}
