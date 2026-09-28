// Band CTA scenarios: committed user + one message -> does the agent flag a band moment, and what pitch follows?
// Usage: node --env-file=.env.local scripts/sim/band-cta.mjs   (dev server on :3000; hard cap via SIM_BUDGET, default $1.50)
const API = "http://localhost:3000/api/chat";
const BUDGET = Number(process.env.SIM_BUDGET || 1.5);
let spent = 0;
const cost = (u) => (u ? (u.input * 4 + u.output * 20 + u.cacheRead * 0.2 + u.cacheWrite * 5) / 1e6 + u.searches * 0.01 : 0);

const SCENARIOS = [
  { id: "airport", expect: true, msg: "just landed at jfk, can you get me an uber to my hotel in midtown?" },
  { id: "driving", expect: true, msg: "driving rn, remind me to reply to sarah when i park" },
  { id: "gym", expect: true, msg: "at the gym between sets, can you cancel my fitpulse subscription?" },
  { id: "meetings", expect: true, msg: "back to back meetings all day, can you move my 3pm to tomorrow?" },
  { id: "cooking", expect: true, msg: "hands covered in flour lol, what temp do i bake chicken thighs at?" },
  { id: "dog-walk", expect: true, msg: "walking the dog, text my wife i'll be 10 min late" },
  { id: "note-taking", expect: true, msg: "can you take notes for me during my meeting in 5 min?" },
  { id: "ramen", expect: false, msg: "whats a good late night ramen spot in the mission?" },
  { id: "draft-email", expect: false, msg: "draft a reply to sarah about the term sheet, just say we'll send numbers friday" },
  { id: "weather", expect: false, msg: "what's the weather in tokyo next week?" },
  { id: "gate-low-score", expect: "gate", msg: "driving rn, remind me to reply to sarah when i park", score: 20 },
];

const base = (score) => ({
  agentName: "Nova", userName: "Riyad", helpNeed: "staying on top of email and errands",
  google: { status: "none" }, call: { status: "ended", count: 1 }, graduated: true, voiceId: "x", declined: {},
  engagement: { points: score, counts: {} },
});

async function chat(state, items, event) {
  const d = await (await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state, items, event }) })).json();
  spent += cost(d.usage);
  return d;
}

const results = [];
for (const sc of SCENARIOS) {
  if (spent >= BUDGET) { console.log(`\n!! budget $${BUDGET} reached, stopping`); break; }
  const score = sc.score ?? 72;
  const state = base(score);
  const items = [
    { id: "0", role: "agent", kind: "text", text: "you're all set. text me whenever you need something.", at: 0 },
    { id: "1", role: "user", kind: "text", text: sc.msg, at: 1 },
  ];
  const r1 = await chat(state, items, { type: "user_message" });
  const unlocked = score >= 60;
  let pitch = null;
  if (r1.band_moment && unlocked) {
    const it2 = [...items, ...r1.messages.map((m, i) => ({ id: `a${i}`, role: "agent", kind: "text", text: m, at: 2 + i }))];
    const r2 = await chat(state, it2, { type: "band_moment", score });
    pitch = { messages: r2.messages, sentCard: r2.actions.includes("send_band") };
  }
  const verdict = sc.expect === "gate" ? (pitch ? "❌ pitched below threshold" : "✅ gate held (no pitch)")
    : sc.expect ? (pitch?.sentCard ? "✅ pitched" : "❌ missed") : (pitch ? "❌ pitched when it shouldn't" : "✅ no pitch");
  results.push({ ...sc, reply: r1.messages, band_moment: r1.band_moment, pitch, verdict });
  console.log(`\n### ${sc.id}  ${verdict}  (flag=${r1.band_moment}, spent so far $${spent.toFixed(2)})`);
  console.log(`USER: ${sc.msg}`);
  for (const m of r1.messages) console.log(`  AGENT: ${m}`);
  if (pitch) { for (const m of pitch.messages) console.log(`  AGENT (pitch): ${m}`); console.log(`  ${pitch.sentCard ? "[Band link card sent]" : "[no card]"}`); }
}
console.log(`\nTOTAL SPENT: $${spent.toFixed(2)}`);
(await import("fs")).writeFileSync(process.env.SIM_OUT || "band-cta-results.json", JSON.stringify(results, null, 2));
