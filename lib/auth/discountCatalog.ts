import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { DiscountAppliesTo } from "@/lib/payment/pricing";
import { sessionCookieOptions } from "@/lib/auth/sessionToken";

export type CatalogDiscount = {
  id: string;
  code: string;
  discount_percent: number;
  applies_to: DiscountAppliesTo;
  expires_at: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export const DISCOUNT_CATALOG_COOKIE = "nexsport_discounts";
const PREFIX = "nsd1";
const MAX_ENTRIES = 40;

type CatalogEntry = {
  id: string;
  c: string;
  p: number;
  a: DiscountAppliesTo;
  e: number | null;
  on: 0 | 1;
  ca: number;
  ua: number;
};

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

function toEntry(record: CatalogDiscount): CatalogEntry {
  return {
    id: record.id,
    c: String(record.code || "").trim().toUpperCase(),
    p: Number(record.discount_percent) || 0,
    a: (record.applies_to || "all") as DiscountAppliesTo,
    e: record.expires_at ? new Date(record.expires_at).getTime() : null,
    on: record.is_active ? 1 : 0,
    ca: new Date(record.created_at).getTime(),
    ua: new Date(record.updated_at).getTime(),
  };
}

function fromEntry(entry: CatalogEntry): CatalogDiscount {
  return {
    id: entry.id,
    code: entry.c,
    discount_percent: entry.p,
    applies_to: entry.a || "all",
    expires_at: entry.e ? new Date(entry.e) : null,
    is_active: Boolean(entry.on),
    created_at: new Date(entry.ca || Date.now()),
    updated_at: new Date(entry.ua || Date.now()),
  };
}

export function signDiscountCatalog(records: CatalogDiscount[]): string {
  const entries = records
    .map(toEntry)
    .filter((e) => e.c && e.p > 0)
    .sort((a, b) => b.ua - a.ua)
    .slice(0, MAX_ENTRIES);
  const body = Buffer.from(JSON.stringify(entries), "utf8").toString("base64url");
  return `${PREFIX}.${body}.${hmac(body)}`;
}

export function parseDiscountCatalog(token: string | undefined | null): CatalogDiscount[] {
  if (!token || !token.startsWith(`${PREFIX}.`)) return [];
  const parts = token.split(".");
  if (parts.length !== 3) return [];
  const [, body, sig] = parts;
  if (!body || !sig || !timingSafeEqual(sig, hmac(body))) return [];
  try {
    const json = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!Array.isArray(json)) return [];
    return json.map(fromEntry).filter((r) => r.code && r.discount_percent > 0);
  } catch {
    return [];
  }
}

export function readDiscountCatalogCookie(req: NextRequest): CatalogDiscount[] {
  return parseDiscountCatalog(req.cookies.get(DISCOUNT_CATALOG_COOKIE)?.value);
}

export function writeDiscountCatalogCookie(res: NextResponse, records: CatalogDiscount[]) {
  res.cookies.set(DISCOUNT_CATALOG_COOKIE, signDiscountCatalog(records), {
    ...sessionCookieOptions(30 * 24 * 60 * 60),
  });
}

export function mergeDiscountRecords(...lists: CatalogDiscount[][]): CatalogDiscount[] {
  const map = new Map<string, CatalogDiscount>();
  for (const list of lists) {
    for (const record of list) {
      const key = String(record.code || "").trim().toUpperCase();
      if (!key) continue;
      const prev = map.get(key);
      if (!prev || new Date(record.updated_at).getTime() >= new Date(prev.updated_at).getTime()) {
        map.set(key, { ...record, code: key });
      }
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}
