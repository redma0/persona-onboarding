import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { TEXT_SYSTEM_PROMPT, describeState } from "./prompts";
import type { AgentEvent, AgentReply, ChatItem, OnboardingState } from "./types";

const client = new Anthropic();
const MODEL = process.env.TEXT_MODEL || "claude-opus-5-5";

const ReplySchema = z.object({
  messages: z.array(z.string()),
  updates: z.object({
    agent_name: z.string().nullable(),
    user_name: z.string().nullable(),
    help_need: z.string().nullable(),
    agent_voice: z.enum(["male", "female", "neutral"]).nullable(),
  }),
  actions: z.array(z.enum(["send_contact_card", "start_call", "send_google_link", "graduate", "send_inbox_summary", "send_band"])),
  declined_call: z.boolean(),
  declined_google: z.boolean(),
  band_moment: z.boolean(),
  task_request: z.boolean(),
  declined_band: z.boolean(),
});

export type Channel = "web" | "imessage";

function renderThread(items: ChatItem[]) {
  return items
    .slice(-40)
    .map((i) => {
      if (i.kind === "contact_card") return "[you sent your contact card]";
      if (i.kind === "google_link") return "[you sent the Connect with Google link]";
      if (i.kind === "call_log") return `[call: ${i.text}]`;
      if (i.kind === "divider") return `[${i.text}]`;
      if (i.kind === "band_card") return "[you sent the Persona Band card]";
      return `${i.role === "user" ? "USER" : "YOU"}: ${i.text}`;
    })
    .join("\n");
}

function describeEvent(e: AgentEvent) {
  switch (e.type) {
    case "user_message":
      return "The user just texted (see the end of the thread). Reply to them.";
    case "call_ended":
      return `call_ended — reason: ${e.reason}; duration: ${e.durationSec}s.\nCall transcript:\n${e.transcript || "(nothing was said)"}`;
    case "call_failed":
      return `call_failed — ${e.reason}`;
    case "band_moment":
      return `band_moment — you already answered their latest message. They're a committed user (commitment score ${e.score}), and what they just asked for is exactly what Persona Band is for. Now introduce the Band: 1–2 short bubbles that tie THEIR specific situation to the Band (quote their scenario, e.g. "next time you're driving you could just say it to your wrist"). Then include send_band (it sends the yourpersona.com/band link, which shows as a rich preview they can tap). Warm, not salesy, no hard sell, no emojis. Don't offer buttons or options; if you invite a reply, keep it natural ("just ask if you want the details").`;
    default:
      return e.type;
  }
}

const CHANNEL_NOTE: Record<Channel, string> = {
  web: "Channel: web simulator of a phone (text thread + in-browser voice call).",
  imessage:
    "Channel: REAL iMessage. You are texting their actual phone. The call is a real phone call to their number (it rings their phone). Link cards are real links they tap. Contact card is a real .vcf.",
};

// Strip anything that smells like internal plumbing so it can never reach the user.
const INTERNAL = /(^\[|\]$|\bjson\b|function call|tool call|tool_|system prompt|stop_reason|status code|\bundefined\b)/i;

/** Gmail access for tools; `get` performs an authorized GET against gmail/v1/users/me/<path>. */
export interface GmailCtx { get: (path: string) => Promise<Response> }

const GMAIL_TOOLS: Anthropic.Tool[] = [
  {
    name: "gmail_search",
    description: "Search the user's Gmail (Gmail search syntax, e.g. 'from:sarah term sheet newer_than:7d'). Returns sender, subject, date, snippet and id for up to 8 messages.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "gmail_read",
    description: "Read the full text of one email by id (from gmail_search).",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
];

function b64(s: string) {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}
type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };
function plainText(p: Part): string {
  if (p.mimeType === "text/plain" && p.body?.data) return b64(p.body.data);
  for (const c of p.parts ?? []) { const t = plainText(c); if (t) return t; }
  if (p.mimeType === "text/html" && p.body?.data) return b64(p.body.data).replace(/<[^>]+>/g, " ");
  return "";
}

async function runGmailTool(g: GmailCtx, name: string, input: Record<string, string>): Promise<string> {
  if (name === "gmail_search") {
    const r = await g.get(`messages?maxResults=8&q=${encodeURIComponent(input.query ?? "")}`);
    if (!r.ok) return `gmail error ${r.status}`;
    const ids: { id: string }[] = (await r.json()).messages ?? [];
    if (!ids.length) return "no results";
    const rows = await Promise.all(ids.map(async ({ id }) => {
      const d = await (await g.get(`messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`)).json();
      const h = Object.fromEntries((d.payload?.headers ?? []).map((x: { name: string; value: string }) => [x.name, x.value]));
      return `id=${id} | from: ${h.From} | subject: ${h.Subject} | ${h.Date}\n  ${d.snippet}`;
    }));
    return rows.join("\n");
  }
  if (name === "gmail_read") {
    const r = await g.get(`messages/${encodeURIComponent(input.id ?? "")}?format=full`);
    if (!r.ok) return `gmail error ${r.status}`;
    const d = await r.json();
    const h = Object.fromEntries((d.payload?.headers ?? []).map((x: { name: string; value: string }) => [x.name, x.value]));
    return `from: ${h.From}\nto: ${h.To}\nsubject: ${h.Subject}\ndate: ${h.Date}\n\n${plainText(d.payload).replace(/\s+\n/g, "\n").slice(0, 6000)}`;
  }
  return "unknown tool";
}

export async function runTextAgent(
  state: OnboardingState,
  items: ChatItem[],
  event: AgentEvent,
  channel: Channel = "web",
  gmail?: GmailCtx,
): Promise<AgentReply | null> {
  const caps = `Tools available now: web_search (live web)${gmail ? ", gmail_search + gmail_read (their real inbox)" : " (Gmail tools unavailable: not connected or demo mode)"}.`;
  const user = `<channel>${CHANNEL_NOTE[channel]} ${caps}</channel>\n\n<state>\n${describeState(state)}\n</state>\n\n<thread>\n${renderThread(items)}\n</thread>\n\n<event>\n${describeEvent(event)}\n</event>\n\nWrite your next turn.`;
  const tools: Anthropic.Messages.ToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: 3 },
    ...(gmail ? GMAIL_TOOLS : []),
  ];
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: user }];

  for (let step = 0; step < 6; step++) {
    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 6000,
      system: [{ type: "text", text: TEXT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "low", format: zodOutputFormat(ReplySchema) },
      tools,
      messages,
    });
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    if (res.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: res.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const b of res.content) {
        if (b.type !== "tool_use") continue;
        let out = "unavailable";
        try { if (gmail) out = await runGmailTool(gmail, b.name, b.input as Record<string, string>); } catch (e) { out = `error: ${String(e).slice(0, 200)}`; }
        results.push({ type: "tool_result", tool_use_id: b.id, content: out });
      }
      messages.push({ role: "user", content: results });
      continue;
    }
    const out = res.parsed_output as AgentReply | null;
    if (!out) return null;
    out.messages = out.messages.map((m) => m.trim()).filter((m) => m && !INTERNAL.test(m)).slice(0, 4);
    return out;
  }
  return null;
}

const Digest = z.object({ messages: z.array(z.string()) });

/** Reads recent Gmail with an access token and writes a short, texty digest. */
export async function inboxDigest(
  token: string,
  ctx: { helpNeed?: string; userName?: string; agentName?: string },
): Promise<string[] | { error: string }> {
  const g = (path: string) =>
    fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { authorization: `Bearer ${token}` } });
  const list = await g("messages?maxResults=25&q=newer_than:3d -category:promotions -category:social");
  if (!list.ok) return { error: `gmail ${list.status}` };
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
    model: MODEL,
    max_tokens: 3000,
    output_config: { effort: "low", format: zodOutputFormat(Digest) },
    system: `You are ${ctx.agentName || "a personal assistant"}, texting ${ctx.userName || "the user"} a first look at their inbox right after they connected Gmail. Style: lowercase, casual, warm, like a text from a sharp friend. 2–3 short text bubbles total. First bubble: the headline (what actually needs them). Then the 2–4 things that matter most, naming senders plainly. Skip newsletters/receipts/noise unless relevant. Tie it to what they said they need help with if possible: "${ctx.helpNeed || "unknown"}". End with one short offer of something concrete you could do next (a question). No markdown, no headers. Never invent emails that aren't listed. If the inbox is quiet, say so nicely.`,
    messages: [{ role: "user", content: `Recent emails (last 3 days):\n${metas.filter(Boolean).join("\n") || "(none)"}` }],
  });
  return res.parsed_output?.messages?.slice(0, 4) ?? [];
}
