// SF-Symbol-style glyphs used across the simulated phone.

export const Sym = {
  chevronLeft: (s = 20) => (
    <svg width={s * 0.6} height={s} viewBox="0 0 12 20" fill="none"><path d="M10 1.8 2 10l8 8.2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  phone: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15.2 15.2 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" /></svg>
  ),
  video: (s = 22) => (
    <svg width={s} height={s * 0.7} viewBox="0 0 26 18" fill="currentColor"><rect x="0" y="1" width="17" height="16" rx="4" /><path d="M18.5 7 24.2 3.3c.8-.5 1.8.1 1.8 1v9.4c0 .9-1 1.5-1.8 1L18.5 11z" /></svg>
  ),
  plus: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 18 18" fill="none"><path d="M9 2v14M2 9h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
  ),
  mic: (s = 18) => (
    <svg width={s * 0.7} height={s} viewBox="0 0 14 20" fill="none"><rect x="3.5" y="1" width="7" height="11.5" rx="3.5" fill="currentColor" /><path d="M1 9.5a6 6 0 0 0 12 0M7 15.5V19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
  ),
  arrowUp: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M8 13.5V2.8M3 7.6 8 2.6l5 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  chevronRight: (s = 9) => (
    <svg width={s * 0.6} height={s} viewBox="0 0 6 10" fill="none"><path d="m1 1 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
};

export function GoogleG({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function PhoneIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M6.6 10.8a15.2 15.2 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1z" />
    </svg>
  );
}
