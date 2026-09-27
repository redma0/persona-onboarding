"use client";
import type { OnboardingState } from "@/lib/types";

function Row({ label, value, done, note }: { label: string; value?: string; done: boolean; note?: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-hairline last:border-0">
      <span className={`mt-[5px] w-2.5 h-2.5 rounded-full shrink-0 ${done ? "bg-emerald-500" : "border border-muted/60"}`} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-muted">{label}</div>
        <div className={`text-[14px] truncate ${value ? "" : "text-muted/70"}`}>{value || note || "—"}</div>
      </div>
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
    <aside className="hidden lg:block w-[300px] self-center text-ink">
      <div className="text-[12px] uppercase tracking-[0.12em] text-muted">Onboarding prototype</div>
      <h1 className="mt-1 text-[26px] leading-tight font-semibold tracking-[-0.02em]">Meet your assistant</h1>
      <p className="mt-2 text-[14px] text-muted leading-relaxed">
        Text it like a person. It&apos;ll offer to call you. Try hanging up, refusing things, or going off-script.
      </p>

      <div className="mt-6 rounded-2xl bg-panel border border-hairline px-4 py-1">
        <Row label="Assistant's name" value={state.agentName} done={!!state.agentName} />
        <Row label="Your name" value={state.userName} done={!!state.userName} />
        <Row label="Gmail" value={g.status === "connected" ? g.email : undefined} done={g.status === "connected"} note={g.status === "link_sent" ? "link sent" : state.declined.google ? "skipped for now" : undefined} />
        <Row label="Wants help with" value={state.helpNeed} done={!!state.helpNeed} />
        <Row
          label="Call"
          value={inCall ? "on the call now" : state.call.count ? `${state.call.count} call${state.call.count > 1 ? "s" : ""} · last: ${state.call.status}` : state.call.status !== "never" ? state.call.status : undefined}
          done={state.call.count > 0}
          note={state.declined.call ? "declined" : undefined}
        />
        <Row label="Onboarding" value={state.graduated ? "graduated ✓" : undefined} done={state.graduated} note="in progress" />
      </div>

      <div className="mt-5">
        <div className="text-[13px] text-muted mb-2">Voice (applies to the next call)</div>
        <div className="grid grid-cols-2 gap-2">
          {voices.map((v) => (
            <button
              key={v.id}
              onClick={() => onVoice(v.id)}
              className={`text-left rounded-xl px-3 py-2 border transition ${state.voiceId === v.id ? "border-ink bg-panel" : "border-hairline hover:bg-panel"}`}
            >
              <div className="text-[14px] font-medium">{v.label}</div>
              <div className="text-[12px] text-muted">{v.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between text-[12px] text-muted">
        <span>{googleConfigured ? "Google sign-in: live" : "Google sign-in: demo mode"}</span>
        <button onClick={onReset} className="rounded-full border border-hairline px-3 py-1.5 text-ink hover:bg-panel">
          Start over
        </button>
      </div>
    </aside>
  );
}
