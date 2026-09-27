// Contact card for the assistant, sent as an iMessage attachment (URL must end in .vcf).
export async function GET(_req: Request, ctx: RouteContext<"/api/vcard/[file]">) {
  const { file } = await ctx.params;
  const name = decodeURIComponent(file).replace(/\.vcf$/i, "").slice(0, 40) || "Assistant";
  const tels = [...new Set([process.env.SENDBLUE_NUMBER, process.env.TWILIO_FROM_NUMBER].filter(Boolean))];
  const vcf = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${name}`,
    `N:;${name};;;`,
    "ORG:Persona",
    ...tels.map((t, i) => `TEL;type=${i === 0 ? "CELL" : "VOICE"}:${t}`),
    "NOTE:Your personal assistant. Text or call anytime.",
    "END:VCARD",
  ].join("\r\n");
  return new Response(vcf, {
    headers: { "content-type": "text/vcard; charset=utf-8", "content-disposition": `attachment; filename="${name}.vcf"` },
  });
}
