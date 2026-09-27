"use client";
// Persona Band upsell: an iMessage-app-style bubble + an iOS 26 sheet (assets from yourpersona.com/band).
import { useEffect, useState } from "react";
import { Logo } from "./brand";

const B = "/persona/band";
export const BAND_URL = "https://yourpersona.com/band";

const COLORS = [
  { id: "knit-black", label: "Carbone Black", material: "Knit", dot: `${B}/dot-knit-black.webp`, img: `${B}/knit-black.webp` },
  { id: "knit-perla", label: "Beige Perla", material: "Knit", dot: `${B}/dot-knit-perla.webp`, img: `${B}/knit-beige.webp` },
  { id: "suede-mocha", label: "Brown Mocha", material: "Suede", dot: `${B}/dot-suede-mocha.webp`, img: `${B}/suede-brown.webp` },
  { id: "liquid-orange", label: "Capri Orange", material: "Liquid", dot: `${B}/dot-liquid-orange.webp`, img: `${B}/suede-black.webp` },
];

const QTY = [
  { n: 1, price: 179, was: 219, save: 40, tag: "Best seller" },
  { n: 2, price: 338, was: 438, save: 100, tag: null },
  { n: 3, price: 477, was: 657, save: 180, tag: "Top value" },
];

const ic = "w-[22px] h-[22px] shrink-0 text-[#3c3c43]";
const FEATURES: [React.ReactNode, string][] = [
  [<svg key="a" className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="7" y="2.5" width="10" height="19" rx="2.6" /><path d="M11 18.5h2" strokeLinecap="round" /></svg>, "Pairs with the Persona app"],
  [<svg key="b" className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><path d="m8 12.3 2.7 2.7L16.3 9.4" strokeLinecap="round" strokeLinejoin="round" /></svg>, "Approve with a tap or voice"],
  [<svg key="c" className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="3.6" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></svg>, "The LED ring shows it heard you"],
  [<svg key="d" className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z" /></svg>, "Three days of battery, full charge in 30 minutes"],
  [<svg key="e" className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z" /></svg>, "Water-resistant, two mics that catch a whisper"],
  [<svg key="f" className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="5" y="10.5" width="14" height="10" rx="2.4" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></svg>, "Privacy mode"],
];

/** In-thread bubble, styled like an iMessage app message (MSMessage template layout). */
export function BandCard({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex justify-start pl-[2px] pop-in">
      <button onClick={onOpen} className="w-[262px] rounded-[18px] overflow-hidden bg-[#e9e9eb] text-left active:opacity-90 transition-opacity">
        <div className="relative h-[164px] bg-[#f2f2f0] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${B}/side-knit-900.webp`} alt="Persona Band" className="absolute right-[-18px] top-1/2 -translate-y-1/2 h-[150px] object-contain" />
          <div className="absolute left-[14px] top-[14px] flex items-center gap-[4px] text-[11px] font-semibold text-[#1c1c1e]"><Logo size={12} /> Persona Band</div>
          <div className="absolute left-[14px] top-[40px] text-[21px] leading-[1.08] font-semibold tracking-[-0.5px] text-[#111]">Your Persona,<br />on your wrist.</div>
          <div className="absolute left-[14px] bottom-[14px] rounded-full bg-[#1c1c1e] text-white text-[11px] font-semibold px-[10px] py-[5px]">Pre-order</div>
        </div>
        <div className="px-[13px] pt-[8px] pb-[9px] flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[15px] leading-[19px] font-semibold tracking-[-0.3px] text-black">Persona Band</div>
            <div className="text-[13px] leading-[17px] text-[#6c6c70] truncate">First AI assistant you can wear</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[15px] font-semibold tracking-[-0.3px] text-black">$179</div>
            <div className="text-[11px] text-[#8e8e93] line-through">$219</div>
          </div>
        </div>
      </button>
    </div>
  );
}

/** Quick-reply chips shown under the card (Messages for Business style). */
export function QuickReplies({ options, onPick }: { options: string[]; onPick: (s: string) => void }) {
  return (
    <div className="flex gap-[8px] mt-[8px] pl-[2px] fade-in">
      {options.map((o) => (
        <button key={o} onClick={() => onPick(o)} className="rounded-full border border-[#0088ff]/35 text-[#0088ff] text-[15px] tracking-[-0.2px] px-[14px] py-[6px] bg-white active:bg-[#0088ff]/10">
          {o}
        </button>
      ))}
    </div>
  );
}

/** iOS 26 sheet with the product page. */
export function BandSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [color, setColor] = useState(COLORS[0]);
  const [qty, setQty] = useState(1);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) requestAnimationFrame(() => setShown(true));
  }, [open]);
  if (!open) return null;
  const close = () => { setShown(false); setTimeout(onClose, 320); };

  return (
    <div className="absolute inset-0 z-[65]">
      <div onClick={close} className={`absolute inset-0 bg-black transition-opacity duration-300 ${shown ? "opacity-30" : "opacity-0"}`} />
      <div
        className={`absolute inset-x-0 bottom-0 top-[58px] rounded-t-[38px] bg-[#f2f2f7] overflow-hidden shadow-[0_-10px_40px_rgba(0,0,0,0.18)] transition-transform duration-[380ms] ease-[cubic-bezier(.2,.9,.25,1)] ${shown ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="absolute inset-x-0 top-0 z-10 h-[64px] flex items-start justify-between px-[16px] pt-[14px] pointer-events-none">
          <span />
          <span className="mt-[-8px] w-[36px] h-[5px] rounded-full bg-black/20" />
          <button onClick={close} aria-label="Close" className="glass pointer-events-auto w-[36px] h-[36px] rounded-full grid place-items-center text-[#3c3c43]">
            <svg width="12" height="12" viewBox="0 0 12 12"><path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="h-full overflow-y-auto no-scrollbar pb-[120px]">
          <div className="relative h-[250px] bg-[#e9e9eb]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={color.id} src={color.img} alt={color.label} className="absolute inset-0 w-full h-full object-cover fade-in" />
          </div>

          <div className="px-[20px] pt-[18px]">
            <div className="text-[30px] leading-[1.05] font-bold tracking-[-0.8px] text-black">Persona Band</div>
            <div className="mt-[4px] text-[17px] text-[#6c6c70] tracking-[-0.3px]">The world&apos;s smartest band.</div>
          </div>

          <div className="mx-[16px] mt-[16px] rounded-[20px] bg-white px-[16px] py-[4px]">
            {FEATURES.map(([icon, text], i) => (
              <div key={i} className={`flex items-center gap-[12px] py-[11px] ${i ? "border-t border-black/[0.07]" : ""}`}>
                {icon}
                <span className="text-[15px] leading-[20px] tracking-[-0.25px] text-black">{text}</span>
              </div>
            ))}
          </div>

          <div className="px-[20px] mt-[20px] text-[13px] uppercase tracking-[0.3px] text-[#6c6c70]">Color · {color.material}</div>
          <div className="mx-[16px] mt-[8px] rounded-[20px] bg-white px-[14px] py-[12px] flex items-center gap-[14px]">
            {COLORS.map((c) => (
              <button key={c.id} onClick={() => setColor(c)} aria-label={c.label} className={`rounded-full p-[2px] transition ${color.id === c.id ? "ring-2 ring-[#0088ff]" : "ring-1 ring-black/10"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.dot} alt="" className="w-[34px] h-[34px] rounded-full object-cover" />
              </button>
            ))}
            <span className="ml-auto text-[15px] text-[#3c3c43] tracking-[-0.2px]">{color.label}</span>
          </div>

          <div className="px-[20px] mt-[20px] text-[13px] uppercase tracking-[0.3px] text-[#6c6c70]">Included with your order</div>
          <div className="mx-[16px] mt-[8px] rounded-[20px] bg-white px-[16px] py-[4px]">
            {[`Persona Band ${color.material}, ${color.label}`, "Home charging dock with USB-C cable"].map((t, i) => (
              <div key={t} className={`flex items-center gap-[10px] py-[11px] ${i ? "border-t border-black/[0.07]" : ""}`}>
                <span className="w-[20px] h-[20px] rounded-full bg-[#34c759] grid place-items-center">
                  <svg width="11" height="11" viewBox="0 0 12 12"><path d="m2.5 6.3 2.3 2.3 4.7-5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <span className="text-[15px] text-black tracking-[-0.25px]">{t}</span>
              </div>
            ))}
          </div>

          <div className="mx-[16px] mt-[16px] flex flex-col gap-[10px]">
            {QTY.map((q) => (
              <button key={q.n} onClick={() => setQty(q.n)} className={`relative text-left rounded-[20px] bg-white px-[16px] py-[14px] transition ${qty === q.n ? "ring-2 ring-black" : "ring-1 ring-black/[0.06]"}`}>
                <div className="flex items-center gap-[10px]">
                  <span className={`w-[20px] h-[20px] rounded-full grid place-items-center ${qty === q.n ? "bg-black" : "ring-[1.5px] ring-black/25"}`}>
                    {qty === q.n && <span className="w-[8px] h-[8px] rounded-full bg-white" />}
                  </span>
                  <span className="text-[16px] tracking-[-0.3px] text-black">{q.n}× Persona Band</span>
                  {q.tag && <span className="ml-auto text-[11px] font-semibold uppercase tracking-[0.3px] text-[#6c6c70]">{q.tag}</span>}
                </div>
                <div className="mt-[8px] flex items-center gap-[8px] pl-[30px]">
                  <span className="text-[22px] font-semibold tracking-[-0.5px] text-black">${q.price}</span>
                  <span className="text-[15px] text-[#8e8e93] line-through">${q.was}</span>
                  <span className="rounded-full bg-[#34c759]/15 text-[#248a3d] text-[13px] font-semibold px-[9px] py-[3px]">Save ${q.save}</span>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-[14px] text-center text-[13px] text-[#8e8e93]">Free US shipping. Ships December 2026.</div>
          <div className="mt-[6px] mb-[10px] text-center text-[12px] text-[#aeaeb2]">30-day money-back · 1 year warranty</div>
        </div>

        <div className="absolute inset-x-0 bottom-0 px-[16px] pt-[12px] pb-[30px] bg-gradient-to-t from-[#f2f2f7] via-[#f2f2f7]/95 to-transparent">
          <a
            href={`${BAND_URL}?utm_source=onboarding&qty=${qty}&color=${color.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center h-[54px] rounded-full bg-[#1c1c1e] text-white text-[17px] font-semibold tracking-[-0.3px] active:scale-[0.98] transition"
          >
            Pre-order now · ${QTY.find((q) => q.n === qty)!.price}
          </a>
        </div>
      </div>
    </div>
  );
}
