import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { TEXT_SYSTEM_PROMPT, describeState } from "./prompts";
import { planForPrompt } from "./onboarding";
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
  asked: z.array(z.enum(["agent_name", "call", "user_name", "help_need", "google"])),
  skip_setup: z.boolean(),
});

export type Channel = "web" | "imessage";

function renderThread(items: ChatItem[]) {
  return items
    .slice(-40)
    .map((i) => {
      if (i.kind === "contact_card") return "[you sent your contact card]";
      if (i.kind === "google_link") return "[you sent the Connect with Google link]";
      if (i.kind === "call_log") return `[call: ${i.text}]`;
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
      return `band_moment — you already answered their latest message. They're a committed user (commitment score ${e.score}), and what they just asked for is exactly what Persona Band is for. Now introduce the Band in ONE short bubble (max 25 words) that ties THEIR exact situation to it (e.g. "next time you're driving, just flick your wrist and say it"). Nothing else. Then include send_band (it sends the yourpersona.com/band link, which shows as a rich preview they can tap). Warm, not salesy, no hard sell, no emojis. Don't offer buttons or options; if you invite a reply, keep it natural ("just ask if you want the details").`;
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
// (only our own bracket notes; drafts legitimately contain placeholders like "[your name]")
const INTERNAL = /(^\[(you sent|call:|app (sent|event))|\bjson\b|function call|tool call|tool_use|system prompt|stop_reason|status code|\bundefined\b)/i;

/** Gmail access for tools; `get` performs an authorized GET against gmail/v1/users/me/<path>. */
export interface GmailCtx { get: (path: string) => Promise<Response>; calendar: (path: string) => Promise<Response> }

const GMAIL_TOOLS: Anthropic.Tool[] = [
  {
    name: "gmail_search",
    description: "Search the user's Gmail (Gmail search syntax, e.g. 'from:sarah term sheet newer_than:7d'). Returns sender, subject, date, snippet and id for up to 8 messages.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "calendar_events",
    description: "List events on the user's primary Google Calendar between two ISO datetimes (e.g. to find free time). Returns start, end, title.",
    input_schema: { type: "object", properties: { time_min: { type: "string" }, time_max: { type: "string" } }, required: ["time_min", "time_max"] },
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
  if (name === "calendar_events") {
    const q = new URLSearchParams({ timeMin: new Date(input.time_min).toISOString(), timeMax: new Date(input.time_max).toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "50" });
    const r = await g.calendar(`calendars/primary/events?${q}`);
    if (!r.ok) return `calendar error ${r.status}`;
    const items: { summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } }[] = (await r.json()).items ?? [];
    return items.map((e) => `${e.start?.dateTime ?? e.start?.date} → ${e.end?.dateTime ?? e.end?.date} | ${e.summary ?? "(busy)"}`).join("\n") || "no events in that range";
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
  const caps = `Tools available now: web_search (live web)${gmail ? ", gmail_search + gmail_read (their real inbox), calendar_events (their real calendar). Today is " + new Date().toDateString() : " (Gmail/Calendar tools unavailable: not connected)"}.`;
  const user = `<channel>${CHANNEL_NOTE[channel]} ${caps}</channel>\n\n<state>\n${describeState(state)}\n</state>\n\n<onboarding_plan>\n${planForPrompt(state)}\n</onboarding_plan>\n\n<thread>\n${renderThread(items)}\n</thread>\n\n<event>\n${describeEvent(event)}\n</event>\n\nWrite your next turn.`;
  // Keep the tool list identical on every call so tools+system stay in the prompt cache.
  const tools: Anthropic.Messages.ToolUnion[] = [{ type: "web_search_20260209", name: "web_search", max_uses: 2 }, ...GMAIL_TOOLS];
  const usage = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, searches: 0 };
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
    usage.input += res.usage.input_tokens;
    usage.cacheRead += res.usage.cache_read_input_tokens ?? 0;
    usage.cacheWrite += res.usage.cache_creation_input_tokens ?? 0;
    usage.output += res.usage.output_tokens;
    usage.searches += res.usage.server_tool_use?.web_search_requests ?? 0;
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
        try { out = gmail ? await runGmailTool(gmail, b.name, b.input as Record<string, string>) : "not connected: Google isn't connected for this user, so you can't see their email or calendar."; } catch (e) { out = `error: ${String(e).slice(0, 200)}`; }
        results.push({ type: "tool_result", tool_use_id: b.id, content: out });
      }
      messages.push({ role: "user", content: results });
      continue;
    }
    const out = res.parsed_output as (AgentReply & { usage?: typeof usage }) | null;
    if (!out) return null;
    out.usage = usage;
    const msgs = tidyBubbles(out.messages.map((m) => m.trim().replace(/^[.,;:]+\s*/, "")).filter((m) => m && !INTERNAL.test(m)));
    out.messages = msgs.length > 4 ? [...msgs.slice(0, 3), msgs.slice(3).join("\n\n")] : msgs;
    return out;
  }
  return null;
}

/** Texts, not paragraphs: pull links into their own bubble and split any bubble over ~40 words at a sentence break. */
function tidyBubbles(msgs: string[]): string[] {
  const out: string[] = [];
  for (const m of msgs) {
    const urls = m.match(/https?:\/\/\S+/g) ?? [];
    const text = m.replace(/https?:\/\/\S+/g, "").replace(/\s+([.,;:!?])/g, "$1").replace(/[:\s]+$/, "").trim();
    for (const part of splitLong(text)) if (part) out.push(part);
    for (const u of urls) out.push(u.replace(/[.,;:!?)]+$/, ""));
  }
  return out;
}
function splitLong(t: string): string[] {
  const words = t.split(/\s+/).filter(Boolean).length;
  if (words <= 40) return [t];
  // real sentence breaks only: punctuation + space + next sentence (so "$888.11" and "point.me" stay intact)
  const sentences = t.split(/(?<=[.!?])\s+(?=[a-z("'$0-9])/i).map((x) => x.trim()).filter(Boolean);
  if (sentences.length < 2) return [t];
  let first = "";
  let k = 0;
  while (k < sentences.length - 1 && (first ? `${first} ${sentences[k]}` : sentences[k]).split(/\s+/).length <= Math.ceil(words / 2) + 5) {
    first = first ? `${first} ${sentences[k]}` : sentences[k];
    k++;
  }
  if (!first) { first = sentences[0]; k = 1; }
  return [first, ...splitLong(sentences.slice(k).join(" "))];
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
    system: `You are ${ctx.agentName || "a personal assistant"}, texting ${ctx.userName || "the user"} a first look at their inbox right after they connected Gmail. Style: lowercase, casual, warm, like a text from a sharp friend. 2–3 short text bubbles total, each ≤25 words. First bubble: the one thing that actually needs them. Second: at most 2 other things worth knowing, named plainly. Skip newsletters, promos, receipts, storage and security notices unless urgent. Tie it to what they said they need help with if possible: "${ctx.helpNeed || "unknown"}". End with one short offer of something concrete you could do next (a question). No markdown, no headers. Never invent emails that aren't listed. If the inbox is quiet, say so nicely.`,
    messages: [{ role: "user", content: `Recent emails (last 3 days):\n${metas.filter(Boolean).join("\n") || "(none)"}` }],
  });
  return tidyBubbles(res.parsed_output?.messages ?? []).slice(0, 4);
}
