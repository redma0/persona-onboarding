"use client";
import { hueFor } from "@/lib/vcard";
import { Logo } from "./brand";
import type { ChatItem } from "@/lib/types";

export function Avatar({ name, size = 40, className = "" }: { name?: string; size?: number; className?: string }) {
  const h = hueFor(name || "?");
  return (
    <div
      className={`grid place-items-center rounded-full font-semibold text-white select-none shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(145deg, hsl(${h} 70% 68%), hsl(${(h + 40) % 360} 60% 48%))`,
      }}
    >
      {name ? name.trim()[0]?.toUpperCase() : (
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4.2" /><path d="M3.5 21c.8-4.4 4.2-7 8.5-7s7.7 2.6 8.5 7z" /></svg>
      )}
    </div>
  );
}

export function Bubble({ item, tail }: { item: ChatItem; tail: boolean }) {
  const me = item.role === "user";
  return (
    <div className={`flex ${me ? "justify-end" : "justify-start"} pop-in`}>
      <div
        className={`relative max-w-[78%] px-3.5 py-[7px] text-[16px] leading-[1.3] whitespace-pre-wrap break-words ${
          me ? "bg-me text-white" : "bg-them text-them-ink"
        } rounded-[19px] ${tail ? (me ? "rounded-br-[6px]" : "rounded-bl-[6px]") : ""}`}
      >
        {linkify(item.text || "")}
      </div>
    </div>
  );
}

function linkify(t: string) {
  const parts = t.split(/(https?:\/\/\S+|[\w.+-]+@[\w-]+\.[\w.]+)/g);
  return parts.map((p, i) =>
    /^https?:\/\//.test(p) || /@/.test(p) ? (
      <span key={i} className="underline underline-offset-2">{p}</span>
    ) : (
      p
    ),
  );
}

export function Typing() {
  return (
    <div className="flex justify-start pop-in">
      <div className="bg-them rounded-[19px] rounded-bl-[6px] px-4 py-3 flex gap-1">
        <span className="typing-dot w-2 h-2 rounded-full bg-muted" />
        <span className="typing-dot w-2 h-2 rounded-full bg-muted" />
        <span className="typing-dot w-2 h-2 rounded-full bg-muted" />
      </div>
    </div>
  );
}

export function ContactCard({ name, onSave, saved }: { name: string; onSave: () => void; saved: boolean }) {
  return (
    <div className="flex justify-start pop-in">
      <button onClick={onSave} className="w-[230px] rounded-[18px] bg-them text-them-ink text-left overflow-hidden active:opacity-80">
        <div className="flex items-center gap-3 px-3.5 py-3">
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{name}</div>
            <div className="text-[13px] text-muted">Persona</div>
          </div>
          <div className="w-11 h-11 rounded-full bg-white text-black grid place-items-center text-[19px] font-medium shadow-[0_0_0_0.5px_rgba(0,0,0,0.15)]">{name.trim()[0]?.toUpperCase()}</div>
          <svg width="8" height="14" viewBox="0 0 8 14" className="text-muted"><path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
        </div>
        <div className="border-t border-hairline px-3.5 py-2 text-[13px] text-me font-medium">
          {saved ? "Saved to contacts ✓" : "Add to contacts"}
        </div>
      </button>
    </div>
  );
}

export function GoogleLinkCard({ onConnect, state }: { onConnect: () => void; state: "idle" | "waiting" | "connected" }) {
  return (
    <div className="flex justify-start pop-in">
      <button onClick={onConnect} disabled={state === "connected"} className="w-[262px] rounded-[18px] overflow-hidden bg-them text-them-ink text-left active:opacity-90">
        <div className="relative h-[168px] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/persona/photo.webp" alt="" className="absolute inset-0 w-full h-full object-cover object-[50%_70%] grayscale-[35%] opacity-90" />
          <div className="absolute left-4 top-4 flex items-center gap-1 text-[11px] font-semibold text-[#3a3a37]"><Logo size={12} /> Persona</div>
          <div className="absolute left-4 top-10 text-[24px] leading-[1.08] font-medium tracking-[-0.025em] text-[#2b2b29]">
            One tap <span className="text-[#6d6d68]">to a</span><br />quieter life
          </div>
          <div className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-white/95 text-[#1f1f1f] px-2.5 py-1.5 text-[11px] font-medium shadow-sm">
            {state === "connected" ? "Connected ✓" : <><GoogleG size={11} /> {state === "waiting" ? "Waiting…" : "Connect with Google"}</>}
          </div>
        </div>
        <div className="px-3.5 py-2.5">
          <div className="text-[13.5px] font-semibold">Connect your Google account</div>
          <div className="text-[12px] text-muted">{typeof location !== "undefined" ? location.host : "yourpersona"}</div>
        </div>
      </button>
    </div>
  );
}

export function GoogleG({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function CallLog({ text }: { text: string }) {
  const missed = /missed|declined|didn/i.test(text);
  return (
    <div className="flex justify-center py-1 fade-in">
      <div className={`flex items-center gap-1.5 text-[12px] ${missed ? "text-red-500" : "text-muted"}`}>
        <PhoneIcon size={12} /> {text}
      </div>
    </div>
  );
}

export function Divider({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 py-3 fade-in">
      <div className="h-px flex-1 bg-hairline" />
      <div className="text-[11px] uppercase tracking-[0.08em] text-muted">{text}</div>
      <div className="h-px flex-1 bg-hairline" />
    </div>
  );
}

export function PhoneIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M6.6 10.8a15.2 15.2 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1z" />
    </svg>
  );
}
