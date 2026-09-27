import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { charge } from "./cost.mjs";

const JUDGE_MODEL = process.env.SIM_JUDGE_MODEL || "claude-sonnet-5";

const client = new Anthropic();
const Verdict = z.object({
  naturalness: z.number().describe("1-10: sounds like a real, warm person texting/talking; not robotic"),
  not_a_form: z.number().describe("1-10: conversational, one thing at a time, doesn't feel like a form"),
  edge_case_handling: z.number().describe("1-10: handled this persona's specific curveballs gracefully"),
  goal_progress: z.number().describe("1-10: made sensible progress on onboarding (name, user name, need, google, call) without being pushy; respecting refusals counts as good"),
  violations: z.array(z.string()).describe("Hard failures: asked for email, claimed something was done that wasn't, repeated the same question verbatim, leaked internal/system text, promised future monitoring/pinging, ignored a direct question, pitched a product unprompted, wrong language, monologue/walls of text on voice"),
  worst_moment: z.string().describe("Quote the single weakest agent line and why"),
  fix: z.string().describe("One concrete prompt/logic change that would fix the biggest issue, or 'none'"),
});

export async function judge(kind, persona, transcript, extra = "") {
  const res = await client.messages.parse({
    model: JUDGE_MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(Verdict) },
    system: `You are a harsh QA reviewer for an AI personal assistant's onboarding (${kind}). The assistant should: feel like texting/talking to a sharp warm friend; lowercase casual texts; one question at a time; answer the user's questions before steering; never ask for email (Google OAuth provides it); never claim it did something it didn't; respect refusals; gently collect: its own name, user's name, what they need help with, Google connection, and offer a quick call. On voice: short turns. IMPORTANT system facts: after every call, the text side receives the call transcript and follows up by text with live web search, so a voice promise like "i'll text you a few options right after we hang up" for research/options/drafts IS backed by the system (don't count it as a violation), while promises to monitor, remind, book or ping later are NOT. Also, when the user connects Google, the text side automatically texts them, so "i'll text you once it's connected" is backed too. The assistant's own name is collected over text before the call, so the call not asking it is fine. Product facts: the product is called Persona (so "persona" is not a leak). Google access is genuinely read-only (gmail.readonly + calendar.readonly scopes), so "i can only look, i can't send or change anything" is accurate. When Google is connected the assistant has real gmail_search/gmail_read/calendar_events tools, so inbox/calendar details it reports after using them are real. Score strictly; 10 is rare. List every hard violation you see.`,
    messages: [{ role: "user", content: `Persona under test: ${persona}\n${extra}\n\nTranscript:\n${transcript}` }],
  });
  charge("judge", JUDGE_MODEL, res.usage);
  return res.parsed_output;
}
