import { cookies } from "next/headers";
import { runTextAgent, type GmailCtx } from "@/lib/agent";
import { freshAccessToken, GOOGLE_COOKIE, seal, unseal, type GoogleSession } from "@/lib/session";
import type { AgentEvent, ChatItem, OnboardingState } from "@/lib/types";

export const maxDuration = 120;

async function gmailFromCookie(): Promise<GmailCtx | undefined> {
  const jar = await cookies();
  const s = unseal<GoogleSession>(jar.get(GOOGLE_COOKIE)?.value);
  if (!s) return undefined;
  const before = s.access_token;
  const token = await freshAccessToken(s);
  if (!token) return undefined;
  if (s.access_token !== before) jar.set(GOOGLE_COOKIE, seal(s), { httpOnly: true, secure: true, sameSite: "lax", maxAge: 604800, path: "/" });
  return { get: (path) => fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { authorization: `Bearer ${token}` } }) };
}

export async function POST(req: Request) {
  const { state, items, event } = (await req.json()) as { state: OnboardingState; items: ChatItem[]; event: AgentEvent };
  try {
    const gmail = state.google.status === "connected" && !state.google.demo ? await gmailFromCookie() : undefined;
    const out = await runTextAgent(state, items, event, "web", gmail);
    if (!out) throw new Error("no parsed output");
    return Response.json(out);
  } catch (err) {
    console.error("chat error", err);
    return Response.json({ error: true }, { status: 500 });
  }
}
