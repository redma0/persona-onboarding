"use client";
import { useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { Avatar, GoogleG, PhoneIcon } from "./ui";
import { hueFor } from "@/lib/vcard";

function Backdrop({ name }: { name?: string }) {
  const h = hueFor(name || "?");
  return (
    <div
      className="absolute inset-0"
      style={{
        background: `radial-gradient(120% 70% at 50% 0%, hsl(${h} 45% 32%) 0%, hsl(${h} 30% 12%) 55%, #070708 100%)`,
      }}
    />
  );
}

function RoundButton({
  onClick, label, color = "bg-white/15", children, size = 70,
}: { onClick: () => void; label: string; color?: string; children: React.ReactNode; size?: number }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 group" aria-label={label}>
      <span
        className={`grid place-items-center rounded-full ${color} text-white backdrop-blur-md transition active:scale-95`}
        style={{ width: size, height: size }}
      >
        {children}
      </span>
      <span className="text-[12px] text-white/80">{label}</span>
    </button>
  );
}

export function IncomingCall({ name, onAccept, onDecline }: { name?: string; onAccept: () => void; onDecline: () => void }) {
  return (
    <div className="absolute inset-0 z-40 overflow-hidden slide-up">
      <Backdrop name={name} />
      <div className="relative h-full flex flex-col items-center pt-24 pb-16 text-white">
        <div className="text-[13px] text-white/60 tracking-wide">incoming call</div>
        <div className="mt-2 text-[34px] font-semibold tracking-[-0.02em]">{name || "Persona"}</div>
        <div className="text-[15px] text-white/60">Persona</div>
        <div className="relative mt-16">
          <span className="absolute inset-0 rounded-full bg-white/20 pulse-ring" />
          <span className="absolute inset-0 rounded-full bg-white/20 pulse-ring" style={{ animationDelay: "0.9s" }} />
          <Avatar name={name} size={112} className="relative ring-4 ring-white/10" />
        </div>
        <div className="mt-auto w-full px-12 flex justify-between">
          <RoundButton onClick={onDecline} label="Decline" color="bg-[#ff3b30]">
            <PhoneIcon size={30} className="rotate-[135deg]" />
          </RoundButton>
          <RoundButton onClick={onAccept} label="Accept" color="bg-[#34c759]">
            <PhoneIcon size={30} />
          </RoundButton>
        </div>
      </div>
    </div>
  );
}

function useTimer(startedAt?: number) {
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
  const timer = useTimer(startedAt);
  const glow = useRef<HTMLDivElement>(null);
  const [captions, setCaptions] = useState(true);

  // Avatar glow follows the agent's voice.
  useEffect(() => {
    let raf = 0;
    let v = 0;
    const loop = () => {
      let target = 0;
      try { target = connected ? convo.getOutputVolume() : 0; } catch {}
      v += (target - v) * 0.25;
      if (glow.current) {
        glow.current.style.transform = `scale(${1 + Math.min(v * 1.6, 0.55)})`;
        glow.current.style.opacity = String(0.25 + Math.min(v * 2, 0.6));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [connected, convo]);

  return (
    <div className="absolute inset-0 z-40 overflow-hidden fade-in">
      <Backdrop name={name} />
      {banner && (
        <div className="absolute z-10 left-3 right-3 top-3 slide-down">
          <div className="flex items-center gap-3 rounded-[22px] bg-white/85 dark:bg-[#2a2a2c]/90 backdrop-blur-xl px-3.5 py-3 text-[#111] dark:text-white shadow-lg">
            <Avatar name={name} size={34} />
            <button onClick={onBanner} className="flex-1 text-left min-w-0">
              <div className="text-[13px] font-semibold">{name}</div>
              <div className="text-[13px] opacity-70 truncate">sent you a link · Connect your Google account</div>
            </button>
            <button onClick={onBanner} className="flex items-center gap-1.5 rounded-full bg-white text-[#1f1f1f] border border-black/10 px-3 py-1.5 text-[12px] font-medium">
              <GoogleG size={13} /> Connect
            </button>
            <button onClick={onDismissBanner} aria-label="Dismiss" className="opacity-50 text-lg leading-none px-1">×</button>
          </div>
        </div>
      )}
      <div className="relative h-full flex flex-col items-center pt-24 pb-14 text-white">
        <div className="relative">
          <div ref={glow} className="absolute -inset-3 rounded-full bg-white/30 blur-md transition-none" />
          <Avatar name={name} size={112} className="relative" />
        </div>
        <div className="mt-6 text-[32px] font-semibold tracking-[-0.02em]">{name || "Persona"}</div>
        <div className="text-[15px] text-white/60 tabular-nums">
          {connected ? timer ?? "0:00" : outgoing ? "calling…" : "connecting…"}
        </div>

        <div className="mt-8 h-[92px] w-full px-8 text-center">
          {captions && caption?.text && (
            <p key={caption.text} className={`fade-in text-[15px] leading-snug line-clamp-4 ${caption.who === "agent" ? "text-white/90" : "text-white/50 italic"}`}>
              {caption.text}
            </p>
          )}
        </div>

        <div className="mt-auto grid grid-cols-3 gap-x-8 gap-y-7 px-10">
          <RoundButton
            onClick={() => convo.setMuted(!convo.isMuted)}
            label={convo.isMuted ? "Unmute" : "Mute"}
            color={convo.isMuted ? "bg-white !text-black" : "bg-white/15"}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={convo.isMuted ? "#000" : "currentColor"} strokeWidth="1.9" strokeLinecap="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" />
              {convo.isMuted && <path d="M4 4l16 16" />}
            </svg>
          </RoundButton>
          <RoundButton onClick={onMinimize} label="Messages">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5c5 0 9 3.4 9 7.6s-4 7.6-9 7.6c-.9 0-1.8-.1-2.6-.3L5 20.5l1-3.6c-1.9-1.4-3-3.5-3-5.8 0-4.2 4-7.6 9-7.6z" /></svg>
          </RoundButton>
          <RoundButton onClick={() => setCaptions((c) => !c)} label="Captions" color={captions ? "bg-white/30" : "bg-white/15"}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M10.5 10.2a2.2 2.2 0 100 3.6M17 10.2a2.2 2.2 0 100 3.6" strokeLinecap="round" /></svg>
          </RoundButton>
          <div />
          <RoundButton onClick={onEnd} label="End" color="bg-[#ff3b30]">
            <PhoneIcon size={30} className="rotate-[135deg]" />
          </RoundButton>
          <div />
        </div>
      </div>
    </div>
  );
}

export function CallPill({ name, onClick, startedAt }: { name?: string; onClick: () => void; startedAt?: number }) {
  const timer = useTimer(startedAt);
  return (
    <button onClick={onClick} className="absolute z-30 top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-[#34c759] text-white px-3.5 py-1.5 text-[13px] font-medium shadow-lg slide-down">
      <PhoneIcon size={13} /> {name} · {timer ?? "connecting"}
    </button>
  );
}
