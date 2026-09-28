import { redis } from "@/lib/db";

// Stores web-simulator conversations for review (30 days). Write-only: there is no public read endpoint.
const TTL = 60 * 60 * 24 * 30;

export async function POST(req: Request) {
  const body = await req.text();
  if (body.length > 400_000) return Response.json({ error: "too large" }, { status: 413 });
  let d: { sid?: string; state?: unknown; items?: unknown[] };
  try { d = JSON.parse(body); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  if (!d.sid || !/^[a-z0-9]{8,32}$/i.test(d.sid) || !Array.isArray(d.items)) return Response.json({ error: "bad request" }, { status: 400 });
  const now = Date.now();
  const key = `chat:${d.sid}`;
  const prev = await redis.get<{ startedAt?: number }>(key).catch(() => null);
  const h = req.headers;
  // approximate location from Vercel's geo headers (city/region/country only, no IP)
  const loc = [h.get("x-vercel-ip-city") && decodeURIComponent(h.get("x-vercel-ip-city")!), h.get("x-vercel-ip-country-region"), h.get("x-vercel-ip-country")].filter(Boolean).join(", ") || undefined;
  await redis.set(key, { sid: d.sid, startedAt: prev?.startedAt ?? now, updatedAt: now, state: d.state, items: d.items, ua: h.get("user-agent")?.slice(0, 160), loc }, { ex: TTL });
  await redis.zadd("chats", { score: now, member: d.sid });
  return Response.json({ ok: true });
}
