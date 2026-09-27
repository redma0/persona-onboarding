import type { Metadata } from "next";
import { redis } from "@/lib/db";
import { APP } from "@/lib/imessage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Connect your Google account",
  description: "Gmail + Calendar · read-only · one tap",
  openGraph: {
    title: "Connect your Google account",
    description: "Gmail + Calendar · read-only · one tap",
    images: [{ url: `${APP()}/og/connect`, width: 1200, height: 630 }],
    siteName: "Persona",
  },
};

export default async function ConnectPage({ params }: PageProps<"/g/[token]">) {
  const { token } = await params;
  const phone = await redis.get<string>(`gt:${token}`);
  return (
    <main className="min-h-dvh grid place-items-center px-5" style={{ background: "linear-gradient(160deg,#eeeae3 0%,#d9dfd6 55%,#c5cfc4 100%)" }}>
      <div className="w-full max-w-sm text-[#2f2f2c]">
        <div className="text-sm font-semibold">✦ Persona</div>
        <h1 className="mt-4 text-[44px] leading-[1.02] font-semibold tracking-[-0.03em]">One tap to a quieter inbox</h1>
        <p className="mt-4 text-[15px] text-[#5b5b56] leading-relaxed">
          Let your assistant read your Gmail and calendar so it can tell you what actually needs you. Read-only. You can disconnect anytime.
        </p>
        {phone ? (
          <a href={`/api/google/start?t=${token}`} className="mt-8 flex items-center justify-center gap-2 rounded-full bg-white border border-black/10 py-3.5 text-[16px] font-medium text-[#1f1f1f] shadow-sm active:scale-[0.98] transition">
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
            Connect with Google
          </a>
        ) : (
          <p className="mt-8 text-[15px]">This link has expired. Text your assistant and ask for a new one.</p>
        )}
      </div>
    </main>
  );
}
