// BlueBubbles server (a Mac running Messages, signed into a spare Apple ID) as the iMessage transport.
import crypto from "crypto";
import { redis } from "./db";

/** Server URL changes when the BlueBubbles Cloudflare tunnel restarts, so it lives in Redis (fallback: env). */
async function base() {
  return ((await redis.get<string>("bb:url")) || process.env.BLUEBUBBLES_URL || "").replace(/\/$/, "");
}
const pw = () => encodeURIComponent(process.env.BLUEBUBBLES_PASSWORD || "");

async function chatGuidFor(address: string) {
  return (await redis.get<string>(`cg:${address}`)) || `iMessage;-;${address}`;
}

async function call(path: string, init: RequestInit) {
  const b = await base();
  if (!b) { console.error("bluebubbles: no server url"); return false; }
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`${b}/api/v1/${path}${sep}password=${pw()}`, init).catch((e) => { console.error("bluebubbles", path, e); return null; });
  if (!r?.ok) console.error("bluebubbles", path, r?.status, (await r?.text().catch(() => ""))?.slice(0, 300));
  return !!r?.ok;
}

export async function bbSendText(to: string, message: string) {
  return call("message/text", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chatGuid: await chatGuidFor(to), tempGuid: crypto.randomUUID(), message, method: "apple-script" }),
  });
}

export async function bbSendMedia(to: string, url: string) {
  const file = await fetch(url).then((r) => r.blob()).catch(() => null);
  if (!file) return false;
  const form = new FormData();
  form.set("chatGuid", await chatGuidFor(to));
  form.set("tempGuid", crypto.randomUUID());
  form.set("name", decodeURIComponent(url.split("/").pop()!.split("?")[0]));
  form.set("method", "apple-script");
  form.set("attachment", file, decodeURIComponent(url.split("/").pop()!.split("?")[0]));
  return call("message/attachment", { method: "POST", body: form });
}

// Typing + read receipts need BlueBubbles' Private API (SIP disabled); harmless no-ops otherwise.
export async function bbTyping(to: string) {
  return call(`chat/${encodeURIComponent(await chatGuidFor(to))}/typing`, { method: "POST" }).catch(() => false);
}
export async function bbMarkRead(to: string) {
  return call(`chat/${encodeURIComponent(await chatGuidFor(to))}/read`, { method: "POST" }).catch(() => false);
}
