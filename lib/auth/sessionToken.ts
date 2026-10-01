import crypto from "crypto";

export const SESSION_HOURS = 30 * 24;
export const SESSION_COOKIE_NAME = "nexsport_token";
export const CLIENT_SESSION_COOKIE_NAME = "nexsport_client_token";
export const CLIENT_SESSION_STORAGE_KEY = "nexsport_session";
const TOKEN_PREFIX = "ns1";

export type SessionUserSnapshot = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  is_verified: boolean;
  role: string;
};

export type SessionTokenPayload = {
  sid: string;
  u: string;
  n: string;
  em: string;
  mo: string;
  r: string;
  v: 0 | 1;
  d: "desktop" | "mobile";
  e: number;
};

function sessionSecret(): string {
  return process.env.SESSION_SECRET || process.env.AUTH_SECRET || "nexsport-hmac-session-v1";
}

function hmac(body: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(body).digest("base64url");
}

function timingSafeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function encodePayload(payload: SessionTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${TOKEN_PREFIX}.${body}.${hmac(body)}`;
}

export function isSignedSessionToken(token: string | null | undefined): boolean {
  return Boolean(token && token.startsWith(`${TOKEN_PREFIX}.`));
}

export function createSignedSessionToken(input: {
  userId: string;
  name?: string;
  email?: string;
  mobile?: string;
  role?: string;
  isVerified?: boolean;
  deviceType?: "desktop" | "mobile";
  hours?: number;
}): { token: string; sid: string; payload: SessionTokenPayload } {
  const hours = input.hours && input.hours > 0 ? input.hours : SESSION_HOURS;
  const payload: SessionTokenPayload = {
    sid: crypto.randomBytes(16).toString("hex"),
    u: input.userId,
    n: input.name || "",
    em: input.email || "",
    mo: input.mobile || "",
    r: input.role || "user",
    v: input.isVerified ? 1 : 0,
    d: input.deviceType === "mobile" ? "mobile" : "desktop",
    e: Math.floor(Date.now() / 1000) + hours * 3600,
  };
  return { token: encodePayload(payload), sid: payload.sid, payload };
}

export function parseSessionToken(token: string | null | undefined): SessionTokenPayload | null {
  if (!token || !isSignedSessionToken(token)) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [, body, sig] = parts;
  if (!body || !sig || !timingSafeEqual(sig, hmac(body))) return null;
  try {
    const json = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!json || typeof json.u !== "string" || typeof json.sid !== "string") return null;
    if (typeof json.e !== "number" || json.e * 1000 <= Date.now()) return null;
    return json as SessionTokenPayload;
  } catch {
    return null;
  }
}

export function refreshSignedSessionToken(token: string, hours = SESSION_HOURS): string | null {
  const parsed = parseSessionToken(token);
  if (!parsed) return null;
  parsed.e = Math.floor(Date.now() / 1000) + Math.max(1, hours) * 3600;
  return encodePayload(parsed);
}

export function snapshotFromPayload(payload: SessionTokenPayload): SessionUserSnapshot {
  return {
    id: payload.u,
    name: payload.n || "",
    email: payload.em || "",
    mobile: payload.mo || "",
    is_verified: Boolean(payload.v),
    role: payload.r || "user",
  };
}

export function sessionCookieOptions(maxAgeSeconds = SESSION_HOURS * 60 * 60) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function getRequestToken(req: { cookies: { get: (name: string) => { value: string } | undefined }; headers: { get: (name: string) => string | null } }): string | undefined {
  const fromHttpOnly = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const fromClient = req.cookies.get(CLIENT_SESSION_COOKIE_NAME)?.value;
  const fromHeader = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || undefined;
  return fromHttpOnly || fromClient || fromHeader || undefined;
}

export function applySessionCookies(res: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => unknown } }, token: string, maxAgeSeconds = SESSION_HOURS * 60 * 60) {
  const base = sessionCookieOptions(maxAgeSeconds);
  res.cookies.set(SESSION_COOKIE_NAME, token, base);
  res.cookies.set(CLIENT_SESSION_COOKIE_NAME, token, { ...base, httpOnly: false });
}

export function clearSessionCookies(res: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => unknown } }) {
  const cleared = sessionCookieOptions(0);
  res.cookies.set(SESSION_COOKIE_NAME, "", cleared);
  res.cookies.set(CLIENT_SESSION_COOKIE_NAME, "", { ...cleared, httpOnly: false });
}
