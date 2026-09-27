import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { TEXT_SYSTEM_PROMPT, describeState } from "@/lib/prompts";
import type { AgentEvent, AgentReply, ChatItem, OnboardingState } from "@/lib/types";

export const maxDuration = 60;

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

function renderThread(items: ChatItem[]) {
  return items
    .slice(-40)
    .map((i) => {
      if (i.kind === "contact_card") return "[you sent your contact card]";
      if (i.kind === "google_link") return "[you sent the Connect with Google link card]";
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

// Strip anything that smells like internal plumbing so it can never reach the user.
const INTERNAL = /(^\[|\]$|\bjson\b|function call|tool call|tool_|system prompt|stop_reason|status code|\bundefined\b)/i;

export async function POST(req: Request) {
  const { state, items, event } = (await req.json()) as {
    state: OnboardingState;
    items: ChatItem[];
    event: AgentEvent;
  };

  const user = `<state>\n${describeState(state)}\n</state>\n\n<thread>\n${renderThread(items)}\n</thread>\n\n<event>\n${describeEvent(event)}\n</event>\n\nWrite your next turn.`;

  try {
    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system: [{ type: "text", text: TEXT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "low", format: zodOutputFormat(ReplySchema) },
      messages: [{ role: "user", content: user }],
    });
    const out = res.parsed_output as AgentReply | null;
    if (!out) throw new Error(`no parsed output (stop_reason=${res.stop_reason})`);
    out.messages = out.messages
      .map((m) => m.trim())
      .filter((m) => m && !INTERNAL.test(m))
      .slice(0, 3);
    return Response.json(out);
  } catch (err) {
    console.error("chat error", err);
    return Response.json({ error: true }, { status: 500 });
  }
}
