"use client";
// iMessage-style rich link (LPLinkView): big image + title + domain, or a compact row when there's no image.
import { useEffect, useState } from "react";

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
