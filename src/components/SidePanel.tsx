"use client";
import type { OnboardingState } from "@/lib/types";
import { Wordmark } from "./brand";

function Row({ label, value, done, note }: { label: string; value?: string; done: boolean; note?: string }) {
  return (
    <div className="flex items-baseline gap-3 py-2">
      <span className={`w-[7px] h-[7px] rounded-full shrink-0 translate-y-[-1px] ${done ? "bg-[#34c759]" : "bg-ink/15"}`} />
      <div className="text-[13px] text-muted w-[120px] shrink-0">{label}</div>
      <div className={`text-[13.5px] truncate ${value ? "text-ink" : "text-muted/70"}`}>{value || note || "—"}</div>
    </div>
  );
}

export function SidePanel({
  state, googleConfigured, voices, onVoice, onReset, inCall,
}: {
  state: OnboardingState;
  googleConfigured: boolean;
  voices: { id: string; label: string; desc: string }[];
  onVoice: (id: string) => void;
  onReset: () => void;
  inCall: boolean;
}) {
  const g = state.google;
  return (
    <aside className="relative z-10 hidden lg:flex flex-col w-[340px] text-ink">
      <Wordmark className="text-[17px]" />
      <h1 className="mt-5 text-[46px] leading-[1.02] font-medium tracking-[-0.035em]">
        Meet your <span className="text-muted">personal</span> intelligence
      </h1>
      <p className="mt-4 text-[14.5px] text-muted leading-relaxed">
        Text it like a person. It&apos;ll offer to call you. Try hanging up mid-call, saying no, or going completely off-script.
      </p>

      <div className="mt-8">
        <div className="text-[11px] uppercase tracking-[0.12em] text-muted mb-1">What it knows so far</div>
        <Row label="Assistant's name" value={state.agentName} done={!!state.agentName} />
        <Row label="Your name" value={state.userName} done={!!state.userName} />
        <Row label="Gmail" value={g.status === "connected" ? g.email : undefined} done={g.status === "connected"} note={g.status === "link_sent" ? "link sent" : state.declined.google ? "skipped for now" : undefined} />
        <Row label="Wants help with" value={state.helpNeed} done={!!state.helpNeed} />
        <Row
          label="Call"
          value={inCall ? "on the call now" : state.call.count ? `${state.call.count} call${state.call.count > 1 ? "s" : ""} · ${state.call.status}` : state.call.status !== "never" ? state.call.status : undefined}
          done={state.call.count > 0}
          note={state.declined.call ? "declined" : undefined}
        />
        <Row label="Onboarding" value={state.graduated ? "graduated" : undefined} done={state.graduated} note="in progress" />
      </div>

      <div className="mt-7">
        <div className="text-[11px] uppercase tracking-[0.12em] text-muted mb-2">Voice · next call</div>
        <div className="flex flex-wrap gap-1.5">
          {voices.map((v) => (
            <button
              key={v.id}
              onClick={() => onVoice(v.id)}
              title={v.desc}
              className={`rounded-full px-3 py-1.5 text-[13px] border transition ${state.voiceId === v.id ? "border-ink bg-ink text-page" : "border-hairline hover:bg-panel"}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 flex items-center gap-4">
        <button onClick={onReset} className="rounded-full bg-white text-[#1b1b1a] border border-black/10 shadow-[0_2px_10px_rgba(0,0,0,0.07)] px-5 py-2.5 text-[14px] font-medium hover:shadow-[0_2px_14px_rgba(0,0,0,0.11)] transition">
          Start over
        </button>
        <span className="text-[12px] text-muted">Google sign-in: {googleConfigured ? "live" : "demo mode"}</span>
      </div>
    </aside>
  );
}
