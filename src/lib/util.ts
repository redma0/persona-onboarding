export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Trim a name-ish value from the model: strip quotes, cap length, drop empties. */
export const clean = (s: string | null | undefined, max = 30) =>
  s ? s.trim().replace(/^["']|["']$/g, "").slice(0, max) || undefined : undefined;

/** Capitalize the first letter of each word (for names). */
export const cap = (s?: string) => (s ? s.replace(/(^|[\s-])(\p{Ll})/gu, (_m, a, b) => a + b.toUpperCase()) : s);
