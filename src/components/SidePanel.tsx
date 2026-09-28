"use client";
// Right-hand column: Persona hero (like yourpersona.com) + a small group of demo controls for reviewers.
import type { OnboardingState } from "@/lib/types";
import { BAND_THRESHOLD } from "@/lib/engagement";
import { Wordmark } from "./brand";

interface Props {
  state: OnboardingState;
  voices: { id: string; label: string; desc: string }[];
  onVoice: (id: string) => void;
  onReset: () => void;
  commitment: number;
  bandShown: boolean;
  bandPreview: boolean;
  onToggleBandPreview: () => void;
}

export function SidePanel({ state, voices, onVoice, onReset, commitment, bandShown, bandPreview, onToggleBandPreview }: Props) {
  return (
    <aside className="relative z-10 hidden lg:flex flex-col items-center text-center w-[380px] text-[#111]">
      <Wordmark className="text-[22px]" />
      <h1 className="mt-[34px] text-[56px] leading-[1.02] font-medium tracking-[-0.04em]">
        Your personal<br />intelligence
      </h1>
      <button
        onClick={onReset}
        className="mt-[36px] flex items-center gap-[10px] rounded-full bg-white border border-black/10 shadow-[0_4px_16px_rgba(0,0,0,0.08)] pl-[18px] pr-[22px] py-[12px] text-[17px] font-semibold hover:shadow-[0_4px_22px_rgba(0,0,0,0.12)] transition"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/persona/imessage.svg" alt="" width={24} height={24} /> Start over
      </button>

      <div className="mt-[44px] w-[260px] border-t border-black/[0.07] pt-[18px] text-left">
        <div className="text-[11px] uppercase tracking-[0.12em] text-[#9a9a9a]">Demo controls</div>

        <div className="mt-[12px] flex items-center justify-between text-[13px] text-[#555]">
          <span>Voice</span>
          <select
            value={state.voiceId}
            onChange={(e) => onVoice(e.target.value)}
            className="bg-transparent text-right text-[#111] outline-none cursor-pointer"
          >
            {voices.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </div>

        <div className="mt-[12px]" title="Points for real usage. The Band is only offered past the threshold, and only for a request it's made for.">
          <div className="flex justify-between text-[13px] text-[#555]">
            <span>Commitment</span>
            <span className="tabular-nums text-[#111]">{bandShown ? "Band offered" : `${Math.min(commitment, BAND_THRESHOLD)} / ${BAND_THRESHOLD}`}</span>
          </div>
          <div className="mt-[6px] h-[3px] rounded-full bg-black/[0.07] overflow-hidden">
            <div className="h-full rounded-full bg-[#111] transition-all duration-700" style={{ width: `${Math.min(100, (commitment / BAND_THRESHOLD) * 100)}%` }} />
          </div>
        </div>

        <button onClick={onToggleBandPreview} className="mt-[12px] w-full flex items-center justify-between text-[13px] text-[#555]">
          <span>Preview Band upsell</span>
          <span className={`relative w-[38px] h-[23px] rounded-full transition-colors ${bandPreview ? "bg-[#34c759]" : "bg-black/[0.12]"}`}>
            <span className={`absolute top-[2px] w-[19px] h-[19px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-all ${bandPreview ? "left-[17px]" : "left-[2px]"}`} />
          </span>
        </button>
      </div>
    </aside>
  );
}
