export function downloadVCard(name: string) {
  const vcf = ["BEGIN:VCARD", "VERSION:3.0", `FN:${name}`, `N:;${name};;;`, "ORG:Persona", "NOTE:Your personal assistant", "END:VCARD"].join("\r\n");
  const url = URL.createObjectURL(new Blob([vcf], { type: "text/vcard" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.vcf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
