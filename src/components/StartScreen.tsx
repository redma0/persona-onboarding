"use client";
import { Logo } from "./brand";

/** Mirrors yourpersona.com/start, rendered inside the phone. */
export function StartScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="absolute inset-0 z-30 sm:pt-[50px] bg-[#f6f6f4] text-[#1b1b1a] flex flex-col items-center justify-center px-7 text-center fade-in">
      <Logo size={34} />
      <h2 className="mt-4 text-[21px] font-semibold tracking-[-0.02em]">Start texting your Persona</h2>
      <p className="mt-1.5 text-[13.5px] text-[#77766f] leading-snug">Persona lives in your messages. Send the first text and we&apos;ll take it from there.</p>
      <button
        onClick={onContinue}
        className="mt-6 w-full flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-3.5 py-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] active:scale-[0.98] transition"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/persona/imessage.svg" alt="" width={28} height={28} />
        <span className="flex-1">
          <span className="block text-[14.5px] font-semibold">Continue with iMessage</span>
          <span className="block text-[12px] text-[#8a8983]">Text your new assistant</span>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </button>
      <div className="mt-5 text-[12px] text-[#9b9a94]">No app to install. It&apos;s just texting.</div>
    </div>
  );
}
