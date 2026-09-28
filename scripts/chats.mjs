// Read stored web conversations. Usage:
//   node --env-file=.env.local scripts/chats.mjs            # list recent
//   node --env-file=.env.local scripts/chats.mjs <sid>      # print one transcript
import { Redis } from "@upstash/redis";
const r = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
const sid = process.argv[2];
if (!sid) {
  const ids = await r.zrange("chats", 0, 19, { rev: true });
  for (const id of ids) {
    const c = await r.get(`chat:${id}`);
    if (!c) continue;
    const s = c.state ?? {};
    console.log(`${id}  ${new Date(c.updatedAt).toLocaleString()}  ${c.items.length} items  agent=${s.agentName ?? "-"} user=${s.userName ?? "-"} google=${s.google?.status} call=${s.call?.status} graduated=${!!s.graduated}  ${c.loc ?? ""}`);
  }
} else {
  const c = await r.get(`chat:${sid}`);
  if (!c) { console.log("not found"); process.exit(1); }
  for (const i of c.items) {
    const t = new Date(i.at).toLocaleTimeString();
    console.log(i.kind === "text" ? `[${t}] ${i.role === "user" ? "USER " : "AGENT"}: ${i.text}` : `[${t}] <${i.kind}${i.text ? `: ${i.text}` : ""}>`);
  }
  console.log("\nstate:", JSON.stringify(c.state));
  console.log(`from: ${c.loc ?? "unknown"}  ua: ${c.ua ?? "-"}`);
}
