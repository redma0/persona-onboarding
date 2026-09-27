import { redis } from "@/lib/db";
import { onGoogleConnected } from "@/lib/imessage";
import { after } from "next/server";

export const maxDuration = 300;

// Demo-mode stand-in for OAuth on the iMessage channel (only used when Google isn't configured).
export async function POST(req: Request) {
  const { t, email } = await req.json();
  const phone = t ? await redis.get<string>(`gt:${t}`) : null;
  if (!phone || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return Response.json({ ok: false }, { status: 400 });
  after(() => onGoogleConnected(phone, { email, name: String(email).split("@")[0].split(/[._]/)[0], demo: true }));
  return Response.json({ ok: true });
}
