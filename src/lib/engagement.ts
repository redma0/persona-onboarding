// Commitment score: deterministic points for real usage. The Band upsell unlocks only past the threshold.
import type { OnboardingState } from "./types";

export const BAND_THRESHOLD = 60;

const RULES: Record<string, { points: number; max: number; label: string }> = {
  named_agent: { points: 5, max: 1, label: "named their assistant" },
  user_name: { points: 5, max: 1, label: "shared their name" },
  help_need: { points: 5, max: 1, label: "said what they need" },
  message: { points: 1, max: 15, label: "sent a message" },
  call_done: { points: 10, max: 2, label: "finished a call" },
  long_call: { points: 5, max: 1, label: "call over a minute" },
  google: { points: 15, max: 1, label: "connected Gmail" },
  digest: { points: 10, max: 1, label: "got an inbox digest" },
  graduated: { points: 10, max: 1, label: "finished setup" },
  task: { points: 8, max: 6, label: "asked it to get something done" },
};

export type EngagementKey = keyof typeof RULES;

export function award(s: OnboardingState, key: EngagementKey): OnboardingState {
  const rule = RULES[key];
  const e = s.engagement ?? { points: 0, counts: {} };
  const n = e.counts[key] ?? 0;
  if (n >= rule.max) return s;
  return { ...s, engagement: { points: e.points + rule.points, counts: { ...e.counts, [key]: n + 1 } } };
}

export const score = (s: OnboardingState) => s.engagement?.points ?? 0;
export const bandUnlocked = (s: OnboardingState) => score(s) >= BAND_THRESHOLD && !s.bandShown && !s.declined.band;

export function describeEngagement(s: OnboardingState) {
  const c = s.engagement?.counts ?? {};
  return Object.entries(c).map(([k, n]) => `${RULES[k]?.label ?? k}${n > 1 ? ` ×${n}` : ""}`).join(", ") || "nothing yet";
}
