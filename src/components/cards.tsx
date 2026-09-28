"use client";
// Cards that appear in the message thread: contact card, Google connect card, and iMessage-style link previews.
import { useEffect, useState } from "react";
import { Logo } from "./brand";
import { GoogleG } from "./icons";

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

export function GoogleLinkCard({ onConnect, onDemo, state }: { onConnect: () => void; onDemo?: () => void; state: "idle" | "waiting" | "connected" }) {
  return (
    <div className="flex flex-col items-start pop-in">
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
      {onDemo && state !== "connected" && (
        <button onClick={onDemo} className="mt-[4px] ml-[4px] text-[11px] text-[#8e8e93]">
          Trouble connecting? <span className="text-[#0088ff]">Use demo sign-in</span>
        </button>
      )}
    </div>
  );
}

type Preview = { url: string; title?: string; image?: string; site?: string; icon: string };
const cache = new Map<string, Preview>();

export function LinkPreview({ url, tail }: { url: string; tail: boolean }) {
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } })();
  const [p, setP] = useState<Preview | null>(cache.get(url) ?? null);
  const [imgOk, setImgOk] = useState(true);
  // like iMessage: small or square images (logos) use the compact layout, shown as the icon
  const [small, setSmall] = useState(false);
  useEffect(() => {
    if (cache.has(url)) return;
    let live = true;
    fetch(`/api/unfurl?url=${encodeURIComponent(url)}`).then((r) => r.json()).then((d) => {
      if (!live || d.error) return;
      cache.set(url, d);
      setP(d);
    }).catch(() => {});
    return () => { live = false; };
  }, [url]);

  // ignore slug-like titles ("nopa-san-francisco") that some blocked sites return
  const title = p?.title && !/^[\w]+(-[\w]+)+$/.test(p.title.trim()) ? p.title : nameFromUrl(url, host);
  const generated = `/api/linkcard?t=${encodeURIComponent(title)}&h=${encodeURIComponent(host)}`;
  const src = p?.image && imgOk && !small ? p.image : generated;
  return (
    <div className="flex justify-start pl-[2px] pop-in">
      <a href={url} target="_blank" rel="noreferrer" className={`richlink ${tail ? "" : "notail"} block active:opacity-90`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p ? src : generated}
          alt=""
          onError={() => setImgOk(false)}
          onLoad={(e) => { const i = e.currentTarget; if (i.src.includes("/api/linkcard")) return; if (i.naturalWidth < 500 || i.naturalWidth / i.naturalHeight < 1.25) setSmall(true); }}
          className="block w-full aspect-[1.905] object-cover rounded-t-[18px] bg-[#e5e5ea]"
        />
        <div className="px-[12px] pt-[8px] pb-[9px]">
          <div className="text-[15px] leading-[19px] font-semibold tracking-[-0.3px] text-black line-clamp-2">{title}</div>
          <div className="text-[13px] leading-[17px] text-[#6c6c70] truncate">{host}</div>
        </div>
      </a>
    </div>
  );
}

/** Split a message into its text (URLs removed, like iOS) and the URLs to preview. */
export function splitLinks(text: string) {
  const urls = [...text.matchAll(/https?:\/\/[^\s)]+/g)].map((m) => m[0].replace(/[.,;:!?]+$/, ""));
  const rest = text.replace(/https?:\/\/[^\s)]+/g, "").replace(/\s+([.,;:!?])/g, "$1").replace(/[ \t]{2,}/g, " ").replace(/[:\s]+$/, (m) => (m.includes(":") ? "" : "")).trim();
  return { rest, urls: [...new Set(urls)].slice(0, 2) };
}

const KNOWN: [RegExp, string][] = [
  [/google\.[^/]+\/travel\/flights/, "Google Flights"],
  [/google\.[^/]+\/maps/, "Google Maps"],
  [/opentable\.com/, "OpenTable"],
  [/airbnb\.com/, "Airbnb"],
  [/resy\.com/, "Resy"],
  [/yelp\.com/, "Yelp"],
];
/** Readable title when a site blocks previews: known site name + the last path segment. */
function nameFromUrl(url: string, host: string) {
  const site = KNOWN.find(([re]) => re.test(url))?.[1];
  let seg = "";
  try {
    seg = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() ?? "").replace(/[-_]+/g, " ").replace(/\.\w+$/, "").trim();
  } catch {}
  if (seg && !/^(s|r|search|flights|list|index)$/i.test(seg) && !/^\d+$/.test(seg)) {
    const nice = seg.replace(/\b\w/g, (c) => c.toUpperCase());
    return site ? `${nice} · ${site}` : nice;
  }
  return site ?? host;
}
