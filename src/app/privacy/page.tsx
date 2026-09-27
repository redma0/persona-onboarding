import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy · Persona onboarding prototype" };

export default function Privacy() {
  return (
    <main className="min-h-dvh bg-white text-[#1b1b1a]">
      <div className="mx-auto max-w-[680px] px-5 py-16 leading-relaxed">
        <h1 className="text-[34px] font-semibold tracking-[-0.02em]">Privacy policy</h1>
        <p className="mt-2 text-[#6b6b6b]">Persona onboarding prototype · last updated September 27, 2026</p>

        <p className="mt-8">This site is a prototype that demonstrates a conversational onboarding for a personal AI assistant. It is not a commercial service.</p>

        <h2 className="mt-10 text-[20px] font-semibold">What we access</h2>
        <p className="mt-2">If you choose to connect Google, the app requests <strong>read-only</strong> access to your Gmail and Google Calendar (<code>gmail.readonly</code>, <code>calendar.readonly</code>) plus your name and email address. It uses this only to show you a short summary of recent email and to answer questions you ask about your inbox or calendar. It cannot send email, delete anything, or change your calendar.</p>

        <h2 className="mt-10 text-[20px] font-semibold">What we store</h2>
        <p className="mt-2">Your Google access token is kept in an encrypted, http-only cookie in your browser. Your conversation with the assistant is stored in your browser&apos;s local storage. We don&apos;t keep a copy of your emails or calendar on our servers, and we never sell or share your data.</p>

        <h2 className="mt-10 text-[20px] font-semibold">Service providers</h2>
        <p className="mt-2">To generate replies and voice, the text of your conversation (and any email or calendar content needed to answer you) is processed by Anthropic (Claude) and ElevenLabs (voice calls). The site is hosted on Vercel.</p>

        <h2 className="mt-10 text-[20px] font-semibold">Your control</h2>
        <p className="mt-2">You can disconnect at any time at <a className="underline" href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>. Tapping &quot;Start over&quot; clears the conversation stored in your browser.</p>

        <p className="mt-2">Google API data is used in accordance with the Google API Services User Data Policy, including the Limited Use requirements.</p>

        <h2 className="mt-10 text-[20px] font-semibold">Contact</h2>
        <p className="mt-2">Questions: riyad@skema3d.com</p>
      </div>
    </main>
  );
}
