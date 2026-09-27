import { cookies } from "next/headers";
import { after } from "next/server";
import { GOOGLE_COOKIE, seal } from "@/lib/session";
import { redis } from "@/lib/db";
import { onGoogleConnected } from "@/lib/imessage";

export const maxDuration = 300;

// Renders a tiny page that hands the result back to the onboarding tab and closes itself.
function done(payload: Record<string, unknown>) {
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connected</title>
<body style="font-family:-apple-system,system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#f6f5f2;color:#1c1b19">
<div style="text-align:center;padding:24px"><div style="font-size:42px">${payload.ok ? "✓" : "–"}</div><p style="font-size:17px">${payload.ok ? (payload.imessage ? "You're connected. Head back to Messages." : "Connected. You can close this tab.") : "Didn't connect. You can close this tab."}</p></div>
<script>
const p=${json};
try{localStorage.setItem("google_result",JSON.stringify({...p,at:Date.now()}))}catch(e){}
try{new BroadcastChannel("google").postMessage(p)}catch(e){}
try{window.opener&&window.opener.postMessage({source:"google",...p},location.origin)}catch(e){}
setTimeout(()=>{try{window.close()}catch(e){}},600);
</script></body>`;
  return new Response(html, { headers: { "content-type": "text/html" } });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const code = url.searchParams.get("code");
  if (!code || url.searchParams.get("state") !== jar.get("g_state")?.value) {
    return done({ ok: false, reason: url.searchParams.get("error") || "cancelled" });
  }
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${url.origin}/api/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  const tok = await tokenRes.json();
  if (!tokenRes.ok) return done({ ok: false, reason: "token_exchange" });

  const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${tok.access_token}` },
  }).then((r) => r.json());

  const gmail = String(tok.scope || "").includes("gmail.readonly");
  const session = {
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    expires_at: Date.now() + (tok.expires_in ?? 3600) * 1000,
    email: info.email,
    name: info.given_name || info.name,
  };
  const t = String(url.searchParams.get("state")).split(".")[1];
  const phone = t ? await redis.get<string>(`gt:${t}`) : null;
  jar.delete("g_state");
  if (phone) {
    after(() => onGoogleConnected(phone, { email: info.email, name: session.name, session }));
    return done({ ok: true, imessage: true, email: info.email, name: session.name, gmail });
  }

  jar.set(
    GOOGLE_COOKIE,
    seal({
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at: Date.now() + (tok.expires_in ?? 3600) * 1000,
      email: info.email,
      name: info.given_name || info.name,
    }),
    { httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 7, path: "/" },
  );
  return done({ ok: true, email: info.email, name: info.given_name || info.name, gmail });
}
