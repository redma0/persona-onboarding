// Brand marks, drawn from scratch to match the vibe of Persona's site.

// Persona's mark (path from yourpersona.com/icon.svg).
const MARK = "M23.6813 15.4245C23.3962 12.7186 22.3617 9.73895 20.768 7.0367C19.646 5.13537 18.3108 3.4873 16.9061 2.27142C15.4653 1.0249 13.9827 0.258395 12.6166 0.0555602C12.4676 0.03353 12.3201 0.0182135 12.1743 0.00924973C11.9735 -0.00308324 11.7777 -0.00308324 11.5851 0.00924973C11.4398 0.0182135 11.2911 0.03353 11.142 0.0555602C9.77668 0.258395 8.29352 1.0249 6.85327 2.27142C5.44828 3.48692 4.11259 5.13499 2.99153 7.0367C1.39776 9.73932 0.363216 12.7186 0.0781778 15.4245C-0.228965 18.339 0.375195 20.6534 1.77981 21.941C2.54317 22.64 3.48969 23 4.54858 23C4.78867 23 5.03514 22.9817 5.28572 22.9443C6.65175 22.7415 8.13505 21.9749 9.57516 20.7285C10.3753 20.036 11.1521 19.2044 11.8803 18.265C12.6077 19.2044 13.3849 20.036 14.1854 20.7285C15.6255 21.9749 17.1088 22.7415 18.4741 22.9443C18.7254 22.9817 18.9715 23 19.2117 23C20.2705 23 21.2167 22.6403 21.9796 21.941C23.3839 20.6537 23.9884 18.339 23.6813 15.4245ZM11.4762 14.8135C11.1713 15.3308 10.8502 15.8239 10.518 16.2893C8.74856 18.7674 6.66262 20.4465 4.95011 20.7012C4.27703 20.801 3.74365 20.6601 3.31889 20.2713C2.46938 19.4932 2.11242 17.8129 2.33941 15.6614C2.59149 13.2704 3.51853 10.6163 4.95161 8.18651C5.69662 6.92314 6.53489 5.80363 7.40124 4.88695C8.78041 3.42789 10.2285 2.48508 11.4777 2.29943C11.5747 2.28486 11.6694 2.27515 11.7612 2.27142C11.7679 2.27067 11.7742 2.26993 11.7811 2.26993C11.811 2.26842 11.8413 2.26768 11.8705 2.26768H11.8882C11.9181 2.26768 11.9485 2.26842 11.9777 2.26993C11.9844 2.26993 11.9908 2.26993 11.9975 2.27142C12.4331 2.29421 12.7991 2.44586 13.1085 2.72863C13.9572 3.50672 14.3142 5.18691 14.088 7.33852C13.8602 9.49651 13.0819 11.87 11.8792 14.0981C11.7503 14.3387 11.6159 14.577 11.4762 14.8135ZM20.4402 20.2713C20.0146 20.6605 19.4812 20.801 18.809 20.7012C17.0961 20.4461 15.0086 18.7674 13.2403 16.2886C13.307 16.1809 13.3718 16.0723 13.4366 15.9632C15.0304 13.2607 16.0648 10.282 16.35 7.57533C16.4522 6.60824 16.4537 5.70688 16.3582 4.88695C17.2246 5.80363 18.0629 6.92314 18.8079 8.18651C20.2398 10.6163 21.1679 13.2704 21.42 15.6614C21.6459 17.8126 21.2889 19.4932 20.4402 20.2713Z";

export function Logo({ size = 24, className = "" }: { size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="-0.5 -0.5 25 24" fill="currentColor" className={className} aria-hidden>
      <path d={MARK} />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[7px] font-semibold tracking-[-0.02em] ${className}`}>
      <Logo size={21} /> Persona
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
