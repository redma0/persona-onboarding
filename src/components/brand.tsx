// Brand marks, drawn from scratch to match the vibe of Persona's site.

export function Logo({ size = 24, className = "", strokeWidth = 2.1 }: { size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M11.3 6.2C9.6 8.9 6.2 13.7 5.3 16.6c-.7 2.2.6 3.7 2.4 3.4 2.5-.4 4.2-3.6 4.9-6.3.6-2.6.5-5.9-1-7.9-.4-.5-.1-1.3.6-1.4 1.1-.2 2.2.5 2.9 1.4 1.9 2.4 4.1 7.2 4.1 9.9 0 2-1.2 3.5-2.9 3.4-1.9-.1-3.3-2.2-3.8-4.3"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium tracking-[-0.01em] ${className}`}>
      <Logo size={18} strokeWidth={2.2} /> Persona
    </span>
  );
}

// deterministic pseudo-random so SSR and client render the same trees
function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

function Tree({ x, y, h, seed, fill, blur }: { x: number; y: number; h: number; seed: number; fill: string; blur: string }) {
  const r = rng(seed);
  const blobs = Array.from({ length: 34 }, () => {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    const q = (n: number) => Math.round(n * 10) / 10;
    return { cx: q(x + Math.cos(a) * d * h * 0.42), cy: q(y - h * 0.62 + Math.sin(a) * d * h * 0.36 - r() * h * 0.12), rr: q(h * (0.05 + r() * 0.085)) };
  });
  return (
    <g filter={blur} fill={fill}>
      <path d={`M${x - h * 0.012} ${y} L${x - h * 0.006} ${y - h * 0.6} L${x + h * 0.006} ${y - h * 0.6} L${x + h * 0.014} ${y}Z`} />
      <path d={`M${x} ${y - h * 0.42} L${x - h * 0.16} ${y - h * 0.62}`} stroke={fill} strokeWidth={h * 0.008} />
      <path d={`M${x} ${y - h * 0.36} L${x + h * 0.14} ${y - h * 0.55}`} stroke={fill} strokeWidth={h * 0.008} />
      {blobs.map((b, i) => <circle key={i} cx={b.cx} cy={b.cy} r={b.rr} />)}
    </g>
  );
}

/** Soft grayscale "fog + trees" art, in the spirit of the misty photo on Persona's site. */
export function Mist({ className = "", id = "m", sides = false }: { className?: string; id?: string; sides?: boolean }) {
  const L = sides ? [70, 150] : [95, 170];
  const R = sides ? [530, 455] : [505, 430];
  return (
    <svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <filter id={`${id}-b1`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9" /></filter>
        <filter id={`${id}-b2`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.2" /></filter>
        <filter id={`${id}-b3`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.1" /></filter>
        <filter id={`${id}-grain`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.08 0" />
        </filter>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f4f2" />
          <stop offset="0.7" stopColor="#e6e7e4" />
          <stop offset="1" stopColor="#d7d9d5" />
        </linearGradient>
        <linearGradient id={`${id}-fog`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.35" stopColor="#f2f2f0" stopOpacity="0" />
          <stop offset="1" stopColor="#eeeeec" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <rect width="600" height="400" fill={`url(#${id}-sky)`} />
      <Tree x={300} y={380} h={260} seed={7} fill="#c9ccc8" blur={`url(#${id}-b1)`} />
      <Tree x={L[1]} y={390} h={250} seed={3} fill="#b2b6b1" blur={`url(#${id}-b1)`} />
      <Tree x={R[1]} y={392} h={240} seed={11} fill="#b4b8b3" blur={`url(#${id}-b1)`} />
      <Tree x={L[0]} y={400} h={330} seed={5} fill="#8d938d" blur={`url(#${id}-b2)`} />
      <Tree x={R[0]} y={400} h={310} seed={13} fill="#90968f" blur={`url(#${id}-b2)`} />
      <Tree x={L[0] - 40} y={410} h={240} seed={21} fill="#6f756f" blur={`url(#${id}-b3)`} />
      <rect width="600" height="400" fill={`url(#${id}-fog)`} />
      <rect width="600" height="400" filter={`url(#${id}-grain)`} />
    </svg>
  );
}

export function MessagesIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="5.5" fill="#34c759" />
      <path d="M12 5.6c3.9 0 7 2.5 7 5.6s-3.1 5.6-7 5.6c-.7 0-1.4-.1-2-.2l-3 1.8.7-2.6C6.1 14.8 5 13.1 5 11.2 5 8.1 8.1 5.6 12 5.6z" fill="#fff" />
    </svg>
  );
}
