// Soft synthesized ringtone (no audio assets). Two-note marimba-ish pattern.
let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function note(freq: number, at: number, dur = 0.5) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o2.type = "sine";
  o.frequency.value = freq;
  o2.frequency.value = freq * 2.01;
  const g2 = ctx.createGain();
  g2.gain.value = 0.18;
  o.connect(g);
  o2.connect(g2).connect(g);
  g.connect(ctx.destination);
  const t = ctx.currentTime + at;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t);
  o2.start(t);
  o.stop(t + dur + 0.05);
  o2.stop(t + dur + 0.05);
}

function pattern() {
  [659.25, 987.77, 830.61, 987.77].forEach((f, i) => note(f, i * 0.16, 0.45));
  [659.25, 987.77, 830.61, 987.77].forEach((f, i) => note(f, 0.9 + i * 0.16, 0.45));
}

export function startRing() {
  stopRing();
  try {
    ctx = ctx ?? new AudioContext();
    void ctx.resume();
    pattern();
    timer = setInterval(pattern, 3200);
    navigator.vibrate?.([400, 200, 400]);
  } catch {}
}

export function stopRing() {
  if (timer) clearInterval(timer);
  timer = null;
  try { navigator.vibrate?.(0); } catch {}
}

export function blip(kind: "connect" | "end") {
  try {
    ctx = ctx ?? new AudioContext();
    void ctx.resume();
    if (kind === "connect") { note(880, 0, 0.18); note(1318.5, 0.1, 0.25); }
    else { note(660, 0, 0.2); note(440, 0.14, 0.3); }
  } catch {}
}
