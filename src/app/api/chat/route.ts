import { runTextAgent } from "@/lib/agent";
import type { AgentEvent, ChatItem, OnboardingState } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { state, items, event } = (await req.json()) as { state: OnboardingState; items: ChatItem[]; event: AgentEvent };
  try {
    const out = await runTextAgent(state, items, event, "web");
    if (!out) throw new Error("no parsed output");
    return Response.json(out);
  } catch (err) {
    console.error("chat error", err);
    return Response.json({ error: true }, { status: 500 });
  }
}
