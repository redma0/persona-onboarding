import crypto from "crypto";
import { cookies } from "next/headers";
import { googleConfigured } from "@/lib/session";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const t = url.searchParams.get("t"); // iMessage link token (maps to a phone number)
  if (!googleConfigured()) return Response.redirect(`${origin}/connect/demo${t ? `?t=${t}` : ""}`, 302);

  const state = crypto.randomBytes(16).toString("hex") + (t ? `.${t}` : "");
  (await cookies()).set("g_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${origin}/api/google/callback`,
    response_type: "code",
    scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "select_account consent",
    state,
  });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
}
