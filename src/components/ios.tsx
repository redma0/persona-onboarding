"use client";
// iOS 26 (Liquid Glass) building blocks for the simulated phone.
import { forwardRef, useEffect, useState } from "react";
import { AgentAvatar } from "./persona-ui";

export const Sym = {
  chevronLeft: (s = 20) => (
    <svg width={s * 0.6} height={s} viewBox="0 0 12 20" fill="none"><path d="M10 1.8 2 10l8 8.2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  phone: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15.2 15.2 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" /></svg>
  ),
  video: (s = 22) => (
    <svg width={s} height={s * 0.7} viewBox="0 0 26 18" fill="currentColor"><rect x="0" y="1" width="17" height="16" rx="4" /><path d="M18.5 7 24.2 3.3c.8-.5 1.8.1 1.8 1v9.4c0 .9-1 1.5-1.8 1L18.5 11z" /></svg>
  ),
  plus: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 18 18" fill="none"><path d="M9 2v14M2 9h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
  ),
  mic: (s = 18) => (
    <svg width={s * 0.7} height={s} viewBox="0 0 14 20" fill="none"><rect x="3.5" y="1" width="7" height="11.5" rx="3.5" fill="currentColor" /><path d="M1 9.5a6 6 0 0 0 12 0M7 15.5V19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
  ),
  arrowUp: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M8 13.5V2.8M3 7.6 8 2.6l5 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  chevronRight: (s = 9) => (
    <svg width={s * 0.6} height={s} viewBox="0 0 6 10" fill="none"><path d="m1 1 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
};

export function StatusBar({ tone = "dark", className = "" }: { tone?: "dark" | "light"; className?: string }) {
  const [t, setT] = useState("9:41");
  useEffect(() => {
    const f = () => setT(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M/i, ""));
    f();
    const i = setInterval(f, 15000);
    return () => clearInterval(i);
  }, []);
  return (
    <div className={`absolute inset-x-0 top-0 z-50 h-[54px] flex items-center justify-between pl-[42px] pr-[30px] pt-[3px] text-[17px] font-semibold tracking-[-0.4px] pointer-events-none ${tone === "light" ? "text-white" : "text-black"} ${className}`}>
      <span className="w-[54px] text-center tabular-nums">{t}</span>
      <span className="flex items-center gap-[6px]">
        <svg width="19" height="12" viewBox="0 0 19 12" fill="currentColor"><rect x="0" y="7.5" width="3.2" height="4.5" rx="1" /><rect x="5.2" y="5" width="3.2" height="7" rx="1" /><rect x="10.4" y="2.5" width="3.2" height="9.5" rx="1" /><rect x="15.6" y="0" width="3.2" height="12" rx="1" /></svg>
        <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor"><path d="M8.5 2.4c2.3 0 4.4.9 6 2.4l1.3-1.3A10.3 10.3 0 0 0 8.5.6 10.3 10.3 0 0 0 1.2 3.5l1.3 1.3a8.5 8.5 0 0 1 6-2.4zm0 3.6c1.3 0 2.5.5 3.4 1.4l1.3-1.3a6.7 6.7 0 0 0-9.4 0l1.3 1.3c.9-.9 2.1-1.4 3.4-1.4zm0 3.6c-.5 0-.9.2-1.2.5L8.5 11.3l1.2-1.2c-.3-.3-.7-.5-1.2-.5z" /></svg>
        <svg width="27" height="13" viewBox="0 0 27 13" fill="none"><rect x=".5" y=".5" width="23" height="12" rx="4" stroke="currentColor" opacity=".35" /><rect x="2" y="2" width="20" height="9" rx="2.5" fill="currentColor" /><path d="M25 4.5v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2z" fill="currentColor" opacity=".4" /></svg>
      </span>
    </div>
  );
}

/** Dynamic Island; expands into a live-call activity when a call is backgrounded. */
export function DynamicIsland({ call, onClick }: { call?: string | null; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!call}
      className={`absolute z-[60] left-1/2 top-[11px] -translate-x-1/2 h-[37px] rounded-full bg-black text-white flex items-center justify-between transition-all duration-500 ease-[cubic-bezier(.2,.9,.3,1.1)] ${call ? "w-[168px] px-[12px]" : "w-[126px] px-0"}`}
      aria-label={call ? "Return to call" : undefined}
    >
      {call && (
        <>
          <span className="text-[#30d158] fade-in">{Sym.phone(15)}</span>
          <span className="text-[#30d158] text-[14px] font-semibold tabular-nums fade-in">{call}</span>
        </>
      )}
    </button>
  );
}

export function HomeIndicator({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return <div className={`hidden sm:block absolute z-50 bottom-[8px] left-1/2 -translate-x-1/2 w-[139px] h-[5px] rounded-full pointer-events-none ${tone === "light" ? "bg-white" : "bg-black"}`} />;
}

export function Glass({ children, className = "", as = "div", onClick, label, dark = false }: {
  children: React.ReactNode; className?: string; as?: "div" | "button"; onClick?: () => void; label?: string; dark?: boolean;
}) {
  const Tag = as;
  return (
    <Tag onClick={onClick} aria-label={label} className={`${dark ? "glass-dark" : "glass"} ${as === "button" ? "active:scale-[0.94] transition-transform" : ""} ${className}`}>
      {children}
    </Tag>
  );
}

export function NavBar({ name, onBack, onCall }: { name?: string; onBack: () => void; onCall: () => void }) {
  return (
    <div className="absolute inset-x-0 top-0 z-30 pt-[max(env(safe-area-inset-top),14px)] sm:pt-[54px] pointer-events-none">
      <div className="edge-top absolute inset-x-0 top-0 h-[150px]" />
      <div className="relative flex items-start justify-between px-[16px] pt-[2px]">
        <Glass as="button" onClick={onBack} label="Back" className="pointer-events-auto w-[44px] h-[44px] rounded-full grid place-items-center text-black">
          {Sym.chevronLeft(19)}
        </Glass>
        <div className="flex flex-col items-center pointer-events-auto -mt-[1px]">
          <AgentAvatar size={52} />
          <Glass className="-mt-[7px] relative rounded-full h-[26px] px-[10px] flex items-center gap-[4px] text-[13px] font-semibold tracking-[-0.1px] text-black">
            {name || "Persona"} <span className="text-[#8e8e93]">{Sym.chevronRight(8)}</span>
          </Glass>
        </div>
        <Glass as="button" onClick={onCall} label="Call" className="pointer-events-auto w-[44px] h-[44px] rounded-full grid place-items-center text-black">
          {Sym.phone(19)}
        </Glass>
      </div>
    </div>
  );
}

export function ThreadStamp({ top, bottom }: { top?: string; bottom: string }) {
  return (
    <div className="text-center text-[11px] leading-[13px] text-[#8e8e93] my-[10px] fade-in">
      {top && <div className="font-semibold">{top}</div>}
      <div>{bottom}</div>
    </div>
  );
}

export function IBubble({ text, me, tail }: { text: string; me: boolean; tail: boolean }) {
  return (
    <div className={`flex ${me ? "justify-end pr-[2px]" : "justify-start pl-[2px]"} pop-in`}>
      <div className={`ibubble ${me ? "me" : "them"} ${tail ? "tail" : ""}`}>{text}</div>
    </div>
  );
}

export function ITyping() {
  return (
    <div className="flex justify-start pl-[2px] pop-in">
      <div className="ityping">
        <span /><span /><span />
      </div>
    </div>
  );
}

export const InputBar = forwardRef<HTMLTextAreaElement, {
  value: string; onChange: (v: string) => void; onSend: () => void;
}>(function InputBar({ value, onChange, onSend }, ref) {
  const has = value.trim().length > 0;
  return (
    <div className="absolute inset-x-0 bottom-0 z-30">
      <div className="edge-bottom absolute inset-x-0 bottom-0 h-[110px] pointer-events-none" />
      <form onSubmit={(e) => { e.preventDefault(); onSend(); }} className="relative flex items-end gap-[8px] px-[14px] pb-[max(env(safe-area-inset-bottom),12px)] sm:pb-[30px]">
        <Glass className="w-[40px] h-[40px] shrink-0 rounded-full grid place-items-center text-[#3c3c43]">{Sym.plus(17)}</Glass>
        <Glass className="flex-1 min-h-[40px] rounded-[20px] flex items-end pl-[14px] pr-[5px] py-[5px]">
          <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            placeholder="iMessage"
            className="flex-1 resize-none bg-transparent outline-none text-[17px] leading-[22px] tracking-[-0.43px] py-[4px] max-h-[110px] text-black placeholder:text-[#8e8e93] caret-[#0088ff]"
          />
          {has ? (
            <button type="submit" aria-label="Send" className="w-[30px] h-[30px] shrink-0 rounded-full bg-[#0088ff] text-white grid place-items-center pop-in">
              {Sym.arrowUp(15)}
            </button>
          ) : (
            <span className="w-[30px] h-[30px] shrink-0 grid place-items-center text-[#8e8e93]">{Sym.mic(18)}</span>
          )}
        </Glass>
      </form>
    </div>
  );
});
