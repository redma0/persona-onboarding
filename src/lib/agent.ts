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
  }),
  actions: z.array(z.enum(["send_contact_card", "start_call", "send_google_link", "graduate", "send_inbox_summary"])),
  declined_call: z.boolean(),
  declined_google: z.boolean(),
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

export async function runTextAgent(
  state: OnboardingState,
  items: ChatItem[],
  event: AgentEvent,
  channel: Channel = "web",
): Promise<AgentReply | null> {
  const user = `<channel>${CHANNEL_NOTE[channel]}</channel>\n\n<state>\n${describeState(state)}\n</state>\n\n<thread>\n${renderThread(items)}\n</thread>\n\n<event>\n${describeEvent(event)}\n</event>\n\nWrite your next turn.`;
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system: [{ type: "text", text: TEXT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "low", format: zodOutputFormat(ReplySchema) },
    messages: [{ role: "user", content: user }],
  });
  const out = res.parsed_output as AgentReply | null;
  if (!out) return null;
  out.messages = out.messages.map((m) => m.trim()).filter((m) => m && !INTERNAL.test(m)).slice(0, 3);
  return out;
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
