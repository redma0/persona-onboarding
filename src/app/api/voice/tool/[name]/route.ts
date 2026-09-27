import { describeState } from "@/lib/prompts";
import { load, sendGoogleLink, update } from "@/lib/imessage";

const cap = (s: string) => s.replace(/(^|[\s-])(\p{Ll})/gu, (_m, a, b) => a + b.toUpperCase());

// Webhook tools for the phone-call agent. Responses are read by the voice agent, never shown to the user.
export async function POST(req: Request, ctx: RouteContext<"/api/voice/tool/[name]">) {
  if (req.headers.get("x-voice-secret") !== process.env.VOICE_TOOL_SECRET) return new Response("nope", { status: 401 });
  const { name } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  const phone: string | undefined = b.user_phone;
  const u = phone ? await load(phone) : null;
  if (!phone || !u) return Response.json({ result: "Unknown user." });

  switch (name) {
    case "send_google_link": {
      if (u.state.google.status === "connected") return Response.json({ result: `Already connected as ${u.state.google.email}. Nothing to send.` });
      await sendGoogleLink(phone);
      return Response.json({ result: "Delivered. It's now the latest text message from you in their Messages app: a 'Connect your Google account' link." });
    }
    case "save_user_name": {
      const n = String(b.name ?? "").trim().slice(0, 30);
      if (n) await update(phone, (x) => { x.state.userName = cap(n); });
      return Response.json({ result: n ? "Saved." : "No name given." });
    }
    case "save_help_need": {
      const n = String(b.need ?? "").trim().slice(0, 200);
      if (n) await update(phone, (x) => { x.state.helpNeed = n; });
      return Response.json({ result: n ? "Saved." : "Nothing to save." });
    }
    case "get_status": {
      const delivered = u.items.some((i) => i.kind === "google_link");
      return Response.json({ result: `${describeState(u.state)}\ngoogle_link_delivered: ${delivered}` });
    }
  }
  return Response.json({ result: "Unknown tool." });
}
