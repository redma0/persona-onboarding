// Dev-only fake Gmail + Calendar so simulations exercise the real tool loop. Never used in production.
import type { GmailCtx } from "./agent";

const day = (d: number, h = 10) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10) + `T${String(h).padStart(2, "0")}:00:00-07:00`;
const MAIL = [
  { id: "m1", from: "Sarah Kim <sarah@northbeam.vc>", subject: "Re: term sheet: couple of questions", date: day(-1, 16), unread: true, body: "Hi! Partners reviewed the deck. Two questions before we send the term sheet: 1) current MRR and growth last 3 months 2) are you open to a $500k pro-rata for us? Could you reply by Thursday? Thanks, Sarah" },
  { id: "m2", from: "Dan Ortiz <dan@seedcamp.io>", subject: "Following up: intro call", date: day(-3, 9), unread: true, body: "Hey, circling back on my note from last week. Would love 20 min next week to hear about the round. Tues or Wed afternoon work?" },
  { id: "m3", from: "Maya Patel <maya@angel.co>", subject: "Congrats + small check", date: day(-2, 12), unread: false, body: "Loved the demo. I'd like to put in $25k if there's room. Send the SAFE when ready." },
  { id: "m4", from: "Oak Street Properties <leasing@oakst.com>", subject: "Lease renewal: action needed by Friday", date: day(-2, 11), unread: true, body: "Your lease ends next month. Please confirm renewal (12-month at $2,450) or give notice by Friday." },
  { id: "m5", from: "Bright Smile Dental <appts@brightsmile.com>", subject: "Appointment confirmation", date: day(-4, 8), unread: false, body: "Your cleaning is confirmed for next Tuesday at 3:00pm with Dr. Feldman. Reply C to confirm." },
  { id: "m6", from: "FitPulse <billing@fitpulse.app>", subject: "Your subscription renews in 3 days ($14.99)", date: day(-1, 7), unread: true, body: "Your FitPulse Premium renews on the 14th for $14.99. Manage or cancel in Account > Billing." },
  { id: "m7", from: "PG&E <billing@pge.com>", subject: "Your bill is ready: $142.18 due Oct 21", date: day(-5, 6), unread: false, body: "Amount due $142.18, due date Oct 21. Autopay is OFF." },
  { id: "m8", from: "Delta <deltaairlines@delta.com>", subject: "Trip confirmation: SFO → JFK", date: day(-6, 14), unread: false, body: "Confirmation GH7K2L. Fri 7:05am SFO → JFK, arrives 3:40pm. Seat 22C." },
];
const EVENTS = [
  { summary: "Standup", start: day(1, 9), end: day(1, 9).replace("09:00", "09:30") },
  { summary: "Investor call: Northbeam", start: day(2, 14), end: day(2, 15) },
  { summary: "Dentist cleaning (Dr. Feldman)", start: day(((9 - new Date().getDay()) % 7) + 7, 15), end: day(((9 - new Date().getDay()) % 7) + 7, 16) },
  { summary: "Team offsite", start: day(3, 10), end: day(3, 16) },
];

const json = (b: unknown) => new Response(JSON.stringify(b), { headers: { "content-type": "application/json" } });
const hdrs = (m: (typeof MAIL)[number]) => [{ name: "From", value: m.from }, { name: "Subject", value: m.subject }, { name: "Date", value: m.date }, { name: "To", value: "you@gmail.com" }];

export function fakeGoogle(): GmailCtx {
  return {
    async get(path) {
      const u = new URL("https://x/" + path);
      if (u.pathname === "/messages") {
        const q = (u.searchParams.get("q") ?? "").toLowerCase().replace(/newer_than:\S+|-?category:\S+|is:\S+/g, "").trim();
        const words = q.split(/\s+/).filter(Boolean).map((w) => w.replace(/^(from|subject):/, ""));
        const hits = MAIL.filter((m) => !words.length || words.some((w) => `${m.from} ${m.subject} ${m.body}`.toLowerCase().includes(w)));
        return json({ messages: hits.map((m) => ({ id: m.id })) });
      }
      const id = u.pathname.split("/")[2];
      const m = MAIL.find((x) => x.id === id);
      if (!m) return new Response("not found", { status: 404 });
      return json({ snippet: m.body.slice(0, 120), labelIds: m.unread ? ["UNREAD"] : [], payload: { headers: hdrs(m), mimeType: "text/plain", body: { data: Buffer.from(m.body).toString("base64url") } } });
    },
    async calendar() {
      return json({ items: EVENTS.map((e) => ({ summary: e.summary, start: { dateTime: e.start }, end: { dateTime: e.end } })) });
    },
  };
}
