import crypto from "crypto";

// Tiny AES-GCM sealed cookie so Google tokens never touch the client in plaintext.
const key = () => crypto.createHash("sha256").update(process.env.SESSION_SECRET || "dev-secret").digest();

export function seal(data: unknown) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(data), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64url");
}

export function unseal<T>(token: string | undefined): T | null {
  if (!token) return null;
  try {
    const buf = Buffer.from(token, "base64url");
    const d = crypto.createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8"));
  } catch {
    return null;
  }
}

export const GOOGLE_COOKIE = "g_sess";
export interface GoogleSession {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  email: string;
  name?: string;
}

export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
