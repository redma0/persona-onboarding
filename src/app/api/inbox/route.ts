import { inboxDigest } from "@/lib/agent";
import { cookies } from "next/headers";
import { GOOGLE_COOKIE, type GoogleSession, seal, unseal } from "@/lib/session";

export const maxDuration = 60;

async function accessToken(s: GoogleSession): Promise<string | null> {
  if (Date.now() < s.expires_at - 60_000) return s.access_token;
  if (!s.refresh_token) return null;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: s.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!r.ok) return null;
  const t = await r.json();
  s.access_token = t.access_token;
  s.expires_at = Date.now() + t.expires_in * 1000;
  (await cookies()).set(GOOGLE_COOKIE, seal(s), { httpOnly: true, secure: true, sameSite: "lax", maxAge: 604800, path: "/" });
  return s.access_token;
}

export async function POST(req: Request) {
  const { helpNeed, userName, agentName } = await req.json();
  const s = unseal<GoogleSession>((await cookies()).get(GOOGLE_COOKIE)?.value);
  if (!s) return Response.json({ demo: true });
  const token = await accessToken(s);
  if (!token) return Response.json({ error: "auth" }, { status: 401 });
  const out = await inboxDigest(token, { helpNeed, userName, agentName });
  if (!Array.isArray(out)) return Response.json(out, { status: 502 });
  return Response.json({ messages: out });
}
