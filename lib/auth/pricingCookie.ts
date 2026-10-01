import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_PRICING_SETTINGS,
  PricingSettings,
  sanitizePricingSettings,
} from "@/lib/payment/pricing";
import { sessionCookieOptions } from "@/lib/auth/sessionToken";

export const PRICING_COOKIE = "nexsport_pricing";
const PREFIX = "nsp1";

function secret(): string {
  return process.env.SESSION_SECRET || process.env.AUTH_SECRET || "nexsport-hmac-session-v1";
}

function hmac(body: string): string {
  return crypto.createHmac("sha256", secret()).update(body).digest("base64url");
}

function timingSafeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function signPricingSettings(settings: PricingSettings): string {
  const body = Buffer.from(JSON.stringify(sanitizePricingSettings(settings)), "utf8").toString("base64url");
  return `${PREFIX}.${body}.${hmac(body)}`;
}

export function parsePricingCookie(token: string | undefined | null): PricingSettings | null {
  if (!token || !token.startsWith(`${PREFIX}.`)) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [, body, sig] = parts;
  if (!body || !sig || !timingSafeEqual(sig, hmac(body))) return null;
  try {
    const json = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return sanitizePricingSettings(json);
  } catch {
    return null;
  }
}

export function readPricingCookie(req: NextRequest): PricingSettings | null {
  return parsePricingCookie(req.cookies.get(PRICING_COOKIE)?.value);
}

export function writePricingCookie(res: NextResponse, settings: PricingSettings) {
  res.cookies.set(PRICING_COOKIE, signPricingSettings(settings), sessionCookieOptions(30 * 24 * 60 * 60));
}

export function isDefaultPricing(settings: PricingSettings): boolean {
  const a = sanitizePricingSettings(settings);
  const b = DEFAULT_PRICING_SETTINGS;
  return (Object.keys(b) as (keyof PricingSettings)[]).every((key) => a[key] === b[key]);
}

export function resolvePricingSettings(stored: PricingSettings, cookie: PricingSettings | null): PricingSettings {
  if (cookie && isDefaultPricing(stored)) return cookie;
  return stored;
}
