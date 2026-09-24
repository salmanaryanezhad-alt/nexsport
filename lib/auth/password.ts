import crypto from "crypto";
import { toEnglishDigits } from "./utils";

export function toPersianDigits(str: string): string {
  if (!str) return "";
  const eng = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const per = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  let res = str;
  for (let i = 0; i < 10; i++) {
    res = res.replace(new RegExp(eng[i], "g"), per[i]);
  }
  return res;
}

export function toArabicDigits(str: string): string {
  if (!str) return "";
  const eng = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const arb = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  let res = str;
  for (let i = 0; i < 10; i++) {
    res = res.replace(new RegExp(eng[i], "g"), arb[i]);
  }
  return res;
}

export function hashPassword(password: string): string {
  const normalized = toEnglishDigits(password);
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(normalized, salt, 1000, 64, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function checkSinglePassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(":")) {
    return password === storedHash;
  }
  const [salt, hash] = storedHash.split(":");
  const testHash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha256").toString("hex");
  if (hash.length !== testHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(testHash, "hex"));
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;
  const eng = toEnglishDigits(password);
  const variants = Array.from(
    new Set([eng, password, toPersianDigits(eng), toArabicDigits(eng)])
  );
  for (const v of variants) {
    if (checkSinglePassword(v, storedHash)) return true;
  }
  return false;
}
