// Deterministic onboarding plan: what's still missing, what to attempt next, and when graduation is allowed.
// The model decides HOW to say things; this decides WHAT the next step is, so coverage doesn't depend on vibes.
import type { OnboardingState } from "./types";

export type Step = "agent_name" | "call" | "user_name" | "help_need" | "google";
const MAX_ATTEMPTS = 2;

const attempts = (s: OnboardingState, k: Step) => s.attempts?.[k] ?? 0;

function done(s: OnboardingState, k: Step): boolean {
  switch (k) {
    case "agent_name": return !!s.agentName;
    case "user_name": return !!s.userName;
    case "help_need": return !!s.helpNeed;
    case "google": return s.google.status === "connected";
    case "call": return s.call.count > 0 || ["ended", "declined", "missed", "failed"].includes(s.call.status);
  }
}

function blocked(s: OnboardingState, k: Step): boolean {
  if (k === "call") return !!s.declined.call;
  if (k === "google") return !!s.declined.google;
  return false;
}

/** Items still open: not collected, not declined, and not yet attempted MAX_ATTEMPTS times. */
function open(s: OnboardingState): Step[] {
  // the call collects name/need/google, so offer it right after naming; then fall back to text
  const order: Step[] = ["agent_name", "call", "user_name", "help_need", "google"];
  return order.filter((k) => !done(s, k) && !blocked(s, k) && attempts(s, k) < MAX_ATTEMPTS);
}

function nextStep(s: OnboardingState): Step | null {
  if (s.graduated) return null;
  // round-robin: every open item gets one attempt before any item gets a second
  const o = open(s).sort((a, b) => attempts(s, a) - attempts(s, b));
  // google lands better once we know what they need (it's how we show value)
  if (o[0] === "google" && !s.helpNeed && o.includes("help_need") && attempts(s, "help_need") <= attempts(s, "google")) return "help_need";
  return o[0] ?? null;
}

/** Apply what the agent asked this turn (+ a skip-setup request) to the attempt counters. */
export function recordAsked(s: OnboardingState, asked: Step[], skip: boolean): OnboardingState {
  const a = { ...(s.attempts ?? {}) };
  for (const k of new Set(asked)) a[k] = (a[k] ?? 0) + 1;
  if (skip) for (const k of open(s)) if (k !== "agent_name") a[k] = MAX_ATTEMPTS;
  return { ...s, attempts: a };
}

export function canGraduate(s: OnboardingState): boolean {
  return !!s.agentName && open(s).length === 0;
}

const HOW: Record<Step, string> = {
  agent_name: 'ask what they want your name to be ("what should my name be?"); if they don\'t care, pick one and move on',
  call: "offer a quick call, framed as optional and faster (it covers the rest of setup)",
  user_name: 'ask their name naturally ("who am i helping, by the way?")',
  help_need: "find out one concrete thing they'd love help with (dig one level deeper than a generic answer)",
  google: "send the google card (send_google_link) with one light, optional line tied to what they need (e.g. 'if you want me to see your inbox and calendar next time, this hooks it up in one tap, totally optional'). Over text the card itself is the ask; no need to get a yes first",
};

/** Plain-language guidance injected into the agent's turn. */
export function planForPrompt(s: OnboardingState, hold = false): string {
  if (s.graduated) return "Onboarding is complete. Just be their assistant.";
  // their texts crossed with our last reply, which already asked something: don't stack a second question
  const step = hold ? null : nextStep(s);
  const missing = (["agent_name", "user_name", "help_need", "google", "call"] as Step[]).filter((k) => !done(s, k));
  const lines = [
    `still missing: ${missing.join(", ") || "nothing"}`,
    `attempts so far: ${JSON.stringify(s.attempts ?? {})} (max ${MAX_ATTEMPTS} each; declined items are never pushed again)`,
    step
      ? `NEXT STEP this turn (after responding to what they said): ${step}: ${HOW[step]}. Attempt ${attempts(s, step) + 1} of ${MAX_ATTEMPTS}.${attempts(s, step) ? " You already asked once: rephrase it, don't repeat it." : ""} If they're in the middle of a task, finish helping first and weave this in at the end. If you already asked them a question about their task this turn, hold the onboarding step for next turn (never two questions in one turn). Report it in "asked".`
      : hold
        ? "HOLD this turn: your previous reply already asked them something they haven't answered yet. Don't start an onboarding step or ask a new question."
        : canGraduate(s)
        ? "Every onboarding item is collected, attempted twice, or declined: include graduate this turn (with a short warm 'you're set' tied to their need)."
        : "No onboarding step to push this turn.",
    "Only say \"you're all set\" when you graduate.",
  ];
  return lines.join("\n");
}
