"use client";
import type { OnboardingState } from "@/lib/types";
import { Wordmark } from "./brand";
import { BAND_THRESHOLD } from "@/lib/engagement";

export function SidePanel({
  state, googleConfigured, voices, onVoice, onReset, commitment, bandShown,
}: {
  commitment: number;
  bandShown: boolean;
  state: OnboardingState;
  googleConfigured: boolean;
  voices: { id: string; label: string; desc: string }[];
  onVoice: (id: string) => void;
  onReset: () => void;
}) {
  return (
    <aside className="relative z-10 hidden lg:flex flex-col items-center text-center w-[380px] text-[#111]">
      <Wordmark className="text-[22px]" />
      <h1 className="mt-[34px] text-[56px] leading-[1.02] font-medium tracking-[-0.04em]">
        Your personal<br />intelligence
      </h1>
      <p className="mt-[22px] max-w-[320px] text-[15px] text-[#6b6b6b] leading-relaxed">
        Text it like a person. It&apos;ll offer to call you. Try hanging up mid-call, saying no, or going completely off-script.
      </p>

      <div className="mt-[30px]">
        <div className="text-[11px] uppercase tracking-[0.12em] text-muted mb-2">Voice · next call</div>
        <div className="flex flex-wrap justify-center gap-1.5">
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

      <button onClick={onReset} className="mt-[34px] flex items-center gap-[10px] rounded-full bg-white text-[#111] border border-black/10 shadow-[0_4px_16px_rgba(0,0,0,0.08)] pl-[18px] pr-[22px] py-[12px] text-[17px] font-semibold hover:shadow-[0_4px_22px_rgba(0,0,0,0.12)] transition">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/persona/imessage.svg" alt="" width={24} height={24} /> Start over
      </button>
      <span className="mt-[14px] text-[13px] text-[#8a8a8a]">Google sign-in: {googleConfigured ? "live" : "demo mode"}</span>
      <div className="mt-[26px] w-[240px]" title="Points for real usage. The Band is only offered past the threshold, and only when you ask for something it's perfect for.">
        <div className="flex justify-between text-[11px] uppercase tracking-[0.12em] text-[#8a8a8a]">
          <span>Commitment</span>
          <span className="tabular-nums">{bandShown ? "Band offered" : `${Math.min(commitment, BAND_THRESHOLD)} / ${BAND_THRESHOLD}`}</span>
        </div>
        <div className="mt-[6px] h-[4px] rounded-full bg-black/[0.07] overflow-hidden">
          <div className="h-full rounded-full bg-[#111] transition-all duration-700" style={{ width: `${Math.min(100, (commitment / BAND_THRESHOLD) * 100)}%` }} />
        </div>
      </div>
    </aside>
  );
}
