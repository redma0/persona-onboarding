import { ImageResponse } from "next/og";

// Link-preview image iMessage shows for the Connect-with-Google link.
export async function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", background: "linear-gradient(160deg,#eeeae3 0%,#d9dfd6 55%,#c5cfc4 100%)", padding: 64 }}>
        <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", left: 0, top: 0 }}>
          <path d="M0 500 C260 380 400 560 660 450 S1060 330 1200 400 L1200 630 L0 630Z" fill="#b7c3b5" />
          <path d="M0 560 C300 480 520 610 800 520 S1100 480 1200 500 L1200 630 L0 630Z" fill="#a6b4a4" />
        </svg>
        <div style={{ fontSize: 34, fontWeight: 600, color: "#3a3a37", display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="28" height="28" viewBox="0 0 24 24"><path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" fill="#3a3a37" /></svg>
          Persona
        </div>
        <div style={{ marginTop: 40, fontSize: 104, lineHeight: 1.02, fontWeight: 600, letterSpacing: -3, color: "#2f2f2c", display: "flex", flexDirection: "column" }}>
          <span>One tap to a</span>
          <span>quieter inbox</span>
        </div>
        <div style={{ position: "absolute", right: 64, bottom: 64, display: "flex", alignItems: "center", gap: 14, background: "white", borderRadius: 999, padding: "20px 34px", fontSize: 34, color: "#1f1f1f", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" }}>
          <span style={{ fontWeight: 700, color: "#4285F4" }}>G</span> Connect with Google
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
