"use client";
import { useState } from "react";

// Stand-in for Google's consent screen, used only when GOOGLE_CLIENT_ID isn't configured.
export default function DemoGoogle() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const finish = (ok: boolean) => {
    const p = ok
      ? { ok: true, email: email.trim(), name: email.split("@")[0].split(/[._]/)[0], demo: true }
      : { ok: false, reason: "cancelled" };
    try { localStorage.setItem("google_result", JSON.stringify({ ...p, at: Date.now() })); } catch {}
    try { new BroadcastChannel("google").postMessage(p); } catch {}
    try { window.opener?.postMessage({ source: "google", ...p }, location.origin); } catch {}
    setDone(true);
    setTimeout(() => window.close(), 700);
  };
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  return (
    <main className="min-h-dvh grid place-items-center bg-white text-[#1f1f1f] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#dadce0] p-8">
        <div className="text-[22px] font-medium tracking-tight">
          <span className="text-[#4285F4]">G</span><span className="text-[#EA4335]">o</span><span className="text-[#FBBC05]">o</span><span className="text-[#4285F4]">g</span><span className="text-[#34A853]">l</span><span className="text-[#EA4335]">e</span>
        </div>
        {done ? (
          <p className="mt-6">All set, you can close this tab.</p>
        ) : (
          <>
            <h1 className="mt-4 text-2xl">Sign in to continue to Persona</h1>
            <p className="mt-2 text-sm text-[#5f6368]">
              Demo mode: real Google sign-in isn&apos;t configured on this deployment, so this simulates it.
            </p>
            <input
              autoFocus
              className="mt-6 w-full rounded-md border border-[#dadce0] px-3 py-3 outline-none focus:border-[#1a73e8]"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && valid && finish(true)}
            />
            <div className="mt-8 flex justify-between">
              <button className="text-[#1a73e8] text-sm font-medium" onClick={() => finish(false)}>Cancel</button>
              <button disabled={!valid} className="rounded-full bg-[#1a73e8] px-6 py-2 text-sm font-medium text-white disabled:opacity-40" onClick={() => finish(true)}>
                Allow
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
