export const dynamic = "force-dynamic";

export async function GET() {
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agentId}`, {
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("voice token error", res.status, await res.text());
    return Response.json({ error: true }, { status: 502 });
  }
  const { token } = await res.json();
  return Response.json({ token });
}
