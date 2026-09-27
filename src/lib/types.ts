export type GoogleStatus = "none" | "link_sent" | "connected";
export type CallStatus = "never" | "ringing" | "active" | "ended" | "declined" | "missed" | "failed";

export interface OnboardingState {
  agentName?: string;
  userName?: string;
  helpNeed?: string;
  google: { status: GoogleStatus; email?: string; name?: string; demo?: boolean };
  call: { status: CallStatus; count: number; lastEnd?: string };
  graduated: boolean;
  voiceId: string;
  /** things the user explicitly said no to (so we don't nag) */
  declined: { call?: boolean; google?: boolean };
  summarySent?: boolean;
}

export type ItemKind = "text" | "contact_card" | "google_link" | "call_log" | "divider";

export interface ChatItem {
  id: string;
  role: "user" | "agent" | "system";
  kind: ItemKind;
  text?: string;
  at: number;
}

/** Events the client reports to the text agent (besides user messages). */
export type AgentEvent =
  | { type: "user_message" }
  | { type: "first_contact" }
  | { type: "call_ended"; reason: string; durationSec: number; transcript: string }
  | { type: "call_declined" }
  | { type: "call_missed" }
  | { type: "call_failed"; reason: string }
  | { type: "google_connected" }
  | { type: "nudge" };

export type AgentAction = "send_contact_card" | "start_call" | "send_google_link" | "graduate" | "send_inbox_summary";

export interface AgentReply {
  messages: string[];
  updates: { agent_name: string | null; user_name: string | null; help_need: string | null };
  actions: AgentAction[];
  declined_call: boolean;
  declined_google: boolean;
}

export const VOICES = [
  { id: "cgSgspJ2msm6clMCkdW9", label: "Jessica", desc: "bright, warm" },
  { id: "ljX1ZrXuDIIRVcmiVSyR", label: "Michael", desc: "genuine, approachable" },
  { id: "iP95p4xoKVk53GoZ742B", label: "Chris", desc: "down-to-earth" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah", desc: "calm, reassuring" },
];

export const initialState = (): OnboardingState => ({
  google: { status: "none" },
  call: { status: "never", count: 0 },
  graduated: false,
  voiceId: VOICES[0].id,
  declined: {},
});
