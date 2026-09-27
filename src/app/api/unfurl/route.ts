import { redis } from "@/lib/db";

// Link previews for URLs the assistant sends (like iMessage's rich links): og:title / og:image / site name.
export const maxDuration = 15;

type Preview = { url: string; title?: string; image?: string; site?: string; icon: string };

const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?|.*\.local$|.*\.internal$)/i;

function meta(html: string, keys: string[]) {
  for (const k of keys) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*>`, "i");
    const tag = html.match(re)?.[0];
    const c = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    if (c) return decode(c.trim());
  }
}
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url") ?? "";
  let u: URL;
  try { u = new URL(raw); } catch { return Response.json({ error: "bad url" }, { status: 400 }); }
  if (!/^https?:$/.test(u.protocol) || PRIVATE.test(u.hostname)) return Response.json({ error: "blocked" }, { status: 400 });

  const icon = `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=128`;
  const key = `unfurl:${u.href}`;
  const cached = await redis.get<Preview>(key).catch(() => null);
  if (cached) return Response.json(cached, { headers: { "cache-control": "public, max-age=86400" } });

  const out: Preview = { url: u.href, icon, site: u.hostname.replace(/^www\./, "") };
  try {
    const r = await fetch(u.href, {
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
      headers: {
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1 facebookexternalhit/1.1",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    if (r.ok && (r.headers.get("content-type") ?? "").includes("html")) {
      const html = (await r.text()).slice(0, 600_000);
      const head = html.split(/<\/head>/i)[0];
      out.title = meta(head, ["og:title", "twitter:title"]) ?? (decode(head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "") || undefined);
      const img = meta(head, ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]);
      if (img) { try { out.image = new URL(img, r.url).href; } catch {} }
      out.site = meta(head, ["og:site_name"]) ?? out.site;
    }
  } catch {}
  if (!out.image || /\.ico($|\?)|favicon|logo|icon/i.test(out.image)) {
    try {
      const m = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(u.href)}`, { signal: AbortSignal.timeout(6000) }).then((r) => r.json());
      const d = m?.data;
      if (d?.title && !out.title) out.title = d.title;
      if (d?.image?.url && (d.image.width ?? 0) >= 500) out.image = d.image.url;
      else if (out.image && /\.ico($|\?)|favicon/i.test(out.image)) out.image = undefined;
    } catch {}
  }
  await redis.set(key, out, { ex: 86400 }).catch(() => {});
  return Response.json(out, { headers: { "cache-control": "public, max-age=86400" } });
}
