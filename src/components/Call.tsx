"use client";
// iOS 26 call UI: incoming full-screen call, in-call controls (Liquid Glass), notification banner.
import { useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { GoogleG, PhoneIcon } from "./icons";
import { AgentAvatar } from "./brand";
import { Glass } from "./ios";
import { Logo } from "./brand";

export function useClock(startedAt?: number) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [startedAt]);
  if (!startedAt || !now) return null;
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Contact-poster style background: soft dark gradient with a huge faint mark. */
function Poster() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#1c1c1e]">
      <div className="absolute inset-0" style={{ background: "radial-gradient(90% 60% at 50% 18%, #5b5d63 0%, #2c2d31 55%, #111113 100%)" }} />
      <Logo size={560} className="absolute left-1/2 top-[34%] -translate-x-1/2 -translate-y-1/2 text-white/[0.05]" />
    </div>
  );
}

function CallButton({
  onClick, label, children, tone = "glass", active = false, size = 78,
}: { onClick?: () => void; label: string; children: React.ReactNode; tone?: "glass" | "red" | "green"; active?: boolean; size?: number }) {
  const bg = tone === "red" ? "bg-[#ff3b30] text-white" : tone === "green" ? "bg-[#34c759] text-white" : "bg-white text-black";
  return (
    <button onClick={onClick} aria-label={label} className="flex flex-col items-center gap-[7px] active:scale-95 transition-transform">
      {tone === "glass" && !active ? (
        <Glass dark className="rounded-full text-white">
          <span className="grid place-items-center" style={{ width: size, height: size }}>{children}</span>
        </Glass>
      ) : (
        <span className={`rounded-full grid place-items-center ${bg}`} style={{ width: size, height: size }}>{children}</span>
      )}
      <span className="text-[13px] font-medium text-white/90 tracking-[-0.1px]">{label}</span>
    </button>
  );
}

const I = {
  down: <PhoneIcon size={34} className="rotate-[135deg]" />,
  up: <PhoneIcon size={34} />,
  speaker: (
    <svg width="30" height="26" viewBox="0 0 30 26" fill="currentColor"><path d="M2 9h5l7-6v20l-7-6H2a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z" /><path d="M18.5 8.5a6.5 6.5 0 0 1 0 9M22 5a11 11 0 0 1 0 16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
  ),
  facetime: (
    <svg width="30" height="21" viewBox="0 0 26 18" fill="currentColor"><rect x="0" y="1" width="17" height="16" rx="4" /><path d="M18.5 7 24.2 3.3c.8-.5 1.8.1 1.8 1v9.4c0 .9-1 1.5-1.8 1L18.5 11z" /></svg>
  ),
  mute: (off: boolean) => (
    <svg width="26" height="30" viewBox="0 0 26 30" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <rect x="8" y="2" width="10" height="16" rx="5" fill="currentColor" stroke="none" />
      <path d="M3.5 14a9.5 9.5 0 0 0 19 0M13 23.5V28" />
      {off && <path d="M3 3l20 23" strokeWidth="2.6" />}
    </svg>
  ),
  bell: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22a2.5 2.5 0 0 0 2.4-2h-4.8A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5.5-6.8V3.5a1.5 1.5 0 0 0-3 0v.7A7 7 0 0 0 5 11v5l-2 2v1h18v-1z" /></svg>
  ),
  msg: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5c5 0 9 3.4 9 7.6s-4 7.6-9 7.6c-.9 0-1.8-.1-2.6-.3L5 20.5l1-3.6c-1.9-1.4-3-3.5-3-5.8 0-4.2 4-7.6 9-7.6z" /></svg>
  ),
  captions: (
    <svg width="28" height="22" viewBox="0 0 28 22" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1.5" y="1.5" width="25" height="19" rx="4.5" /><path d="M11.5 8.3a3 3 0 1 0 0 5.4M20 8.3a3 3 0 1 0 0 5.4" strokeLinecap="round" /></svg>
  ),
};

export function IncomingCall({ name, onAccept, onDecline }: { name?: string; onAccept: () => void; onDecline: () => void }) {
  return (
    <div className="absolute inset-0 z-40 overflow-hidden slide-up text-white">
      <Poster />
      <div className="relative h-full flex flex-col items-center pt-[92px] pb-[64px]">
        <div className="text-[15px] text-white/60 tracking-[-0.2px]">Persona</div>
        <div className="mt-[2px] text-[42px] leading-[1.05] font-semibold tracking-[-1.2px]">{name || "Persona"}</div>
        <div className="relative mt-[70px]">
          <AgentAvatar size={128} className="relative" />
        </div>
        <div className="mt-auto w-full px-[46px]">
          <div className="flex justify-between mb-[34px] px-[12px]">
            <CallButton label="Remind Me" size={54}>{I.bell}</CallButton>
            <CallButton label="Message" size={54} onClick={onDecline}>{I.msg}</CallButton>
          </div>
          <div className="flex justify-between">
            <CallButton label="Decline" tone="red" onClick={onDecline}>{I.down}</CallButton>
            <CallButton label="Accept" tone="green" onClick={onAccept}>{I.up}</CallButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ActiveCall({
  name, connected, startedAt, caption, onEnd, onMinimize, banner, onBanner, onDismissBanner, outgoing,
}: {
  name?: string;
  connected: boolean;
  startedAt?: number;
  caption?: { who: "agent" | "user"; text: string };
  onEnd: () => void;
  onMinimize: () => void;
  banner: boolean;
  onBanner: () => void;
  onDismissBanner: () => void;
  outgoing: boolean;
}) {
  const convo = useConversation();
  const timer = useClock(startedAt);
  const glow = useRef<HTMLDivElement>(null);
  const [speaker, setSpeaker] = useState(true);
  const [captions, setCaptions] = useState(true);

  // Avatar glow follows the agent's voice.
  useEffect(() => {
    let raf = 0;
    let v = 0;
    const loop = () => {
      let target = 0;
      try { target = connected ? convo.getOutputVolume() : 0; } catch {}
      // slow easing + small range: a gentle breathe while it talks, not a per-syllable flicker
      v += (target - v) * 0.06;
      if (glow.current) {
        glow.current.style.transform = `scale(${1 + Math.min(v * 0.5, 0.12)})`;
        glow.current.style.opacity = String(0.12 + Math.min(v * 0.6, 0.18));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [connected, convo]);

  return (
    <div className="absolute inset-0 z-40 overflow-hidden fade-in text-white">
      <Poster />
      {banner && (
        <div className="absolute z-[55] left-[10px] right-[10px] top-[58px] slide-down">
          <div className="glass rounded-[26px] flex items-center gap-[10px] px-[12px] py-[11px] text-black">
            <AgentAvatar size={38} />
            <button onClick={onBanner} className="flex-1 text-left min-w-0">
              <div className="flex items-baseline justify-between">
                <span className="text-[15px] font-semibold tracking-[-0.3px]">{name}</span>
                <span className="text-[13px] text-black/45">now</span>
              </div>
              <div className="text-[15px] leading-[19px] tracking-[-0.3px] text-black/80 truncate">Connect your Google account</div>
            </button>
            <button onClick={onBanner} className="flex items-center gap-[5px] rounded-full bg-white px-[10px] py-[6px] text-[13px] font-semibold shadow-sm">
              <GoogleG size={13} /> Connect
            </button>
            <button onClick={onDismissBanner} aria-label="Dismiss" className="text-black/40 text-[20px] leading-none px-[2px]">×</button>
          </div>
        </div>
      )}
      <div className="relative h-full flex flex-col items-center pt-[96px] pb-[62px]">
        <div className="relative">
          <div ref={glow} className="absolute -inset-[10px] rounded-full bg-white/40 blur-[10px]" />
          <AgentAvatar size={84} className="relative" />
        </div>
        <div className="mt-[14px] text-[30px] leading-[1.1] font-semibold tracking-[-0.8px]">{name || "Persona"}</div>
        <div className="mt-[3px] text-[17px] text-white/60 tabular-nums tracking-[-0.3px]">
          {connected ? timer ?? "0:00" : outgoing ? "calling…" : "connecting…"}
        </div>

        <div className="mt-[34px] h-[112px] w-full px-[34px] text-center">
          {captions && caption?.text && (
            <p key={caption.text} className={`fade-in text-[17px] leading-[23px] tracking-[-0.3px] line-clamp-4 ${caption.who === "agent" ? "text-white/90" : "text-white/45"}`}>
              {caption.text}
            </p>
          )}
        </div>

        <div className="mt-auto grid grid-cols-3 gap-x-[26px] gap-y-[22px]">
          <CallButton label="Speaker" active={speaker} onClick={() => setSpeaker((x) => !x)}>{I.speaker}</CallButton>
          <CallButton label="FaceTime">{I.facetime}</CallButton>
          <CallButton label="Mute" active={convo.isMuted} onClick={() => convo.setMuted(!convo.isMuted)}>{I.mute(convo.isMuted)}</CallButton>
          <CallButton label="Messages" onClick={onMinimize}>{I.msg}</CallButton>
          <CallButton label="End" tone="red" onClick={onEnd}>{I.down}</CallButton>
          <CallButton label="Captions" active={captions} onClick={() => setCaptions((c) => !c)}>{I.captions}</CallButton>
        </div>
      </div>
    </div>
  );
}

/** Return-to-call pill for full-screen mobile (where no Dynamic Island is drawn). */
export function CallPill({ name, onClick, startedAt }: { name?: string; onClick: () => void; startedAt?: number }) {
  const timer = useClock(startedAt);
  return (
    <button onClick={onClick} className="absolute z-[45] top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black text-[#30d158] px-3.5 py-1.5 text-[13px] font-semibold shadow-lg slide-down">
      <PhoneIcon size={13} /> {name} · {timer ?? "connecting"}
    </button>
  );
}
