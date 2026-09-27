import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { cookies } from "next/headers";
import { GOOGLE_COOKIE, type GoogleSession, seal, unseal } from "@/lib/session";

export const maxDuration = 60;
const client = new Anthropic();

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

const Digest = z.object({ messages: z.array(z.string()) });

export async function POST(req: Request) {
  const { helpNeed, userName, agentName } = await req.json();
  const s = unseal<GoogleSession>((await cookies()).get(GOOGLE_COOKIE)?.value);
  if (!s) return Response.json({ demo: true });
  const token = await accessToken(s);
  if (!token) return Response.json({ error: "auth" }, { status: 401 });

  const g = (path: string) =>
    fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { authorization: `Bearer ${token}` } });
  const list = await g("messages?maxResults=25&q=newer_than:3d -category:promotions -category:social");
  if (!list.ok) return Response.json({ error: "gmail", status: list.status }, { status: 502 });
  const ids: { id: string }[] = (await list.json()).messages ?? [];
  const metas = await Promise.all(
    ids.map((m) =>
      g(`messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`)
        .then((r) => r.json())
        .then((d) => {
          const h = Object.fromEntries((d.payload?.headers ?? []).map((x: { name: string; value: string }) => [x.name, x.value]));
          return `- from: ${h.From} | subject: ${h.Subject} | ${h.Date}${d.labelIds?.includes("UNREAD") ? " | UNREAD" : ""}\n  ${d.snippet}`;
        })
        .catch(() => ""),
    ),
  );

  const res = await client.messages.parse({
    model: process.env.TEXT_MODEL || "claude-opus-5-5",
    max_tokens: 3000,
    output_config: { effort: "low", format: zodOutputFormat(Digest) },
    system: `You are ${agentName || "a personal assistant"}, texting ${userName || "the user"} a first look at their inbox right after they connected Gmail. Style: lowercase, casual, warm, like a text from a sharp friend. 2–3 short text bubbles total. First bubble: the headline (what actually needs them). Then the 2–4 things that matter most, naming senders plainly. Skip newsletters/receipts/noise unless relevant. Tie it to what they said they need help with if possible: "${helpNeed || "unknown"}". End with one short offer of something concrete you could do next (a question). No markdown headers, no bullet symbols other than a simple "·" if needed. Never invent emails that aren't listed. If the inbox is empty/quiet, say so in a nice way.`,
    messages: [{ role: "user", content: `Recent emails (last 3 days):\n${metas.filter(Boolean).join("\n") || "(none)"}` }],
  });
  return Response.json({ messages: res.parsed_output?.messages?.slice(0, 4) ?? [] });
}
