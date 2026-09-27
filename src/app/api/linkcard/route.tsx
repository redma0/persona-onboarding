import { ImageResponse } from "next/og";

// Generated preview image for links whose site gives no usable og:image (blocked, or only a logo).
const PALETTES = [
  ["#eef2ff", "#dbe4ff"], ["#ecfdf5", "#d1fae5"], ["#fff7ed", "#ffedd5"], ["#fdf2f8", "#fce7f3"],
  ["#f0f9ff", "#e0f2fe"], ["#f5f3ff", "#ede9fe"], ["#f7f7f5", "#e9e9e6"],
];

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const host = (q.get("h") || "").slice(0, 60);
  const icon = q.get("i") || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=256`;
  let hash = 0;
  for (const c of host) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const [a, b] = PALETTES[hash % PALETTES.length];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${a}, ${b})` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon} width={200} height={200} style={{ borderRadius: 46, background: "white", padding: 30, boxShadow: "0 10px 40px rgba(0,0,0,0.10)" }} alt="" />
      </div>
    ),
    { width: 1200, height: 630, headers: { "cache-control": "public, max-age=604800" } },
  );
}
