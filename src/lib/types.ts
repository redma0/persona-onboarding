type GoogleStatus = "none" | "link_sent" | "connected";
type CallStatus = "never" | "ringing" | "active" | "ended" | "declined" | "missed" | "failed";

export interface OnboardingState {
  agentName?: string;
  userName?: string;
  helpNeed?: string;
  google: { status: GoogleStatus; email?: string; name?: string; demo?: boolean };
  call: { status: CallStatus; count: number; lastEnd?: string };
  graduated: boolean;
  voiceId: string;
  /** things the user explicitly said no to (so we don't nag) */
  declined: { call?: boolean; google?: boolean; band?: boolean };
  summarySent?: boolean;
  /** commitment score (see lib/engagement.ts) */
  engagement?: { points: number; counts: Record<string, number> };
  bandShown?: boolean;
  /** true once the user picks a voice by hand; otherwise the voice follows the agent's name */
  voiceLocked?: boolean;
  /** how many times each onboarding item has been asked (see lib/onboarding.ts) */
  attempts?: Partial<Record<"agent_name" | "call" | "user_name" | "help_need" | "google", number>>;
}

type ItemKind = "text" | "contact_card" | "google_link" | "call_log" | "band_card";

export interface ChatItem {
  id: string;
  role: "user" | "agent" | "system";
  kind: ItemKind;
  text?: string;
  at: number;
}

/** Events the client reports to the text agent (besides user messages). */
export type AgentEvent =
  | { type: "user_message"; crossed?: boolean }
  | { type: "first_contact" }
  | { type: "call_ended"; reason: string; durationSec: number; transcript: string }
  | { type: "call_declined" }
  | { type: "call_missed" }
  | { type: "call_failed"; reason: string }
  | { type: "google_connected" }
  | { type: "nudge" }
  | { type: "band_moment"; score: number };

type AgentAction = "send_contact_card" | "start_call" | "send_google_link" | "graduate" | "send_inbox_summary" | "send_band";

export interface AgentReply {
  messages: string[];
  updates: { agent_name: string | null; user_name: string | null; help_need: string | null; agent_voice: "male" | "female" | "neutral" | null };
  actions: AgentAction[];
  declined_call: boolean;
  declined_google: boolean;
  /** user's latest message is a situation the Band is perfect for */
  band_moment: boolean;
  /** user asked the assistant to actually do something substantive */
  task_request: boolean;
  declined_band: boolean;
  /** onboarding items the agent actually asked for / offered in this turn */
  asked: ("agent_name" | "call" | "user_name" | "help_need" | "google")[];
  /** user clearly wants to stop doing setup and just use it */
  skip_setup: boolean;
}

export const VOICES = [
  { id: "cgSgspJ2msm6clMCkdW9", label: "Jessica", desc: "bright, warm" },
  { id: "ljX1ZrXuDIIRVcmiVSyR", label: "Michael", desc: "genuine, approachable" },
  { id: "iP95p4xoKVk53GoZ742B", label: "Chris", desc: "down-to-earth" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah", desc: "calm, reassuring" },
  { id: "SAz9YHcvj6GT2YYXdXww", label: "River", desc: "relaxed, neutral" },
];

/** Default voice for the gender the agent's name suggests. */
export const VOICE_FOR: Record<"male" | "female" | "neutral", string> = {
  male: "iP95p4xoKVk53GoZ742B", // Chris
  female: "cgSgspJ2msm6clMCkdW9", // Jessica
  neutral: "SAz9YHcvj6GT2YYXdXww", // River
};

export const initialState = (): OnboardingState => ({
  google: { status: "none" },
  call: { status: "never", count: 0 },
  graduated: false,
  voiceId: VOICES[0].id,
  declined: {},
});
