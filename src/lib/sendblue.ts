const BASE = "https://api.sendblue.com";
const headers = () => ({
  "sb-api-key-id": process.env.SENDBLUE_API_KEY_ID!,
  "sb-api-secret-key": process.env.SENDBLUE_API_SECRET!,
  "content-type": "application/json",
});
export const LINE = () => process.env.SENDBLUE_NUMBER!;

async function post(path: string, body: Record<string, unknown>) {
  const r = await fetch(BASE + path, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  if (!r.ok) console.error("sendblue", path, r.status, (await r.text()).slice(0, 300));
  return r.ok;
}

export const sendText = (to: string, content: string) => post("/api/send-message", { number: to, from_number: LINE(), content });
export const sendMedia = (to: string, media_url: string, content?: string) =>
  post("/api/send-message", { number: to, from_number: LINE(), media_url, ...(content ? { content } : {}) });
export const sendTyping = (to: string) => post("/api/send-typing-indicator", { number: to, from_number: LINE() }).catch(() => false);
export const markRead = (to: string) => post("/api/mark-read", { number: to, from_number: LINE() }).catch(() => false);
