/**
 * Jalali (Persian/Shamsi) calendar helpers.
 * Conversion algorithm based on the well-known jalaali-js mapping.
 */

export const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

export const JALALI_WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

export interface JalaliDate {
  y: number;
  m: number;
  d: number;
}

function div(a: number, b: number) {
  return Math.trunc(a / b);
}

export function isJalaliLeap(jy: number): boolean {
  return ((((jy + 12) % 33) * 8) % 33) < 8;
}

export function daysInJalaliMonth(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeap(jy) ? 30 : 29;
}

export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    div(gy2 + 3, 4) -
    div(gy2 + 99, 100) +
    div(gy2 + 399, 400) +
    gd +
    g_d_m[gm - 1];
  let jy = -1595 + 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { y: jy, m: jm, d: jd };
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  jy += 1595;
  let days =
    -355668 +
    365 * jy +
    div(jy, 33) * 8 +
    div((jy % 33) + 3, 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * div(days, 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * div(--days, 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    gy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const sal_a = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 1; gm <= 12 && gd > sal_a[gm]; gm++) {
    gd -= sal_a[gm];
  }
  return { gy, gm, gd };
}

export function dateToJalali(date: Date): JalaliDate {
  return gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function jalaliToDate(y: number, m: number, d: number): Date {
  const g = jalaliToGregorian(y, m, d);
  return new Date(g.gy, g.gm - 1, g.gd, 12, 0, 0, 0);
}

export function formatJalali(j: JalaliDate, persianDigits = true): string {
  const raw = `${j.y}/${String(j.m).padStart(2, "0")}/${String(j.d).padStart(2, "0")}`;
  if (!persianDigits) return raw;
  return raw.replace(/\d/g, (ch) => "۰۱۲۳۴۵۶۷۸۹"[Number(ch)]);
}

export function formatDateJalali(date: Date, persianDigits = true): string {
  return formatJalali(dateToJalali(date), persianDigits);
}

export function toGregorianYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseGregorianYmd(ymd: string | null | undefined): Date | null {
  if (!ymd) return null;
  const m = String(ymd).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function parseJalaliInput(value: string | null | undefined): JalaliDate | null {
  if (!value) return null;
  const map: Record<string, string> = {
    "۰": "0",
    "۱": "1",
    "۲": "2",
    "۳": "3",
    "۴": "4",
    "۵": "5",
    "۶": "6",
    "۷": "7",
    "۸": "8",
    "۹": "9",
    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9",
  };
  const normalized = String(value)
    .trim()
    .replace(/[۰-۹٠-٩]/g, (ch) => map[ch] || ch)
    .replace(/-/g, "/");
  const m = normalized.match(/^(\d{3,4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1200 || y > 1600 || mo < 1 || mo > 12) return null;
  if (d < 1 || d > daysInJalaliMonth(y, mo)) return null;
  return { y, m: mo, d };
}

/** End of the selected Jalali day in local time, for expiry timestamps. */
export function jalaliEndOfDayIso(j: JalaliDate): string {
  const g = jalaliToGregorian(j.y, j.m, j.d);
  const dt = new Date(g.gy, g.gm - 1, g.gd, 23, 59, 59, 999);
  return dt.toISOString();
}
