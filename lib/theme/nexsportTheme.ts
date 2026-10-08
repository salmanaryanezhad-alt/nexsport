/**
 * NexSport theme architecture
 *
 * Identity (logo, ink, chalk, pitch green, cards, button shape) never changes.
 * Only the Accent layer swaps: Default / Spring / Summer / Autumn / Winter / Event.
 *
 * To ship a championship skin later, set ACTIVE_EVENT or add a date window below.
 * Components should prefer CSS variables (--ns-accent, --ns-accent-gradient, …)
 * instead of hardcoded gold/amber.
 */

export type NexSportThemeId =
  | "default"
  | "spring"
  | "summer"
  | "autumn"
  | "winter"
  | "world-cup"
  | "olympics";

export type NexSportSeasonId = "spring" | "summer" | "autumn" | "winter";

export interface NexSportTheme {
  id: NexSportThemeId;
  kind: "default" | "season" | "event";
  emoji: string;
  badge: string;
  label: string;
}

/** Flip this to force an event skin (e.g. "world-cup"). null = calendar season. */
export const ACTIVE_EVENT: Exclude<NexSportThemeId, NexSportSeasonId | "default"> | null =
  null;

const EVENT_WINDOWS: { id: Exclude<NexSportThemeId, NexSportSeasonId | "default">; start: string; end: string }[] =
  [
    // 2026 FIFA World Cup — already closed as of Oct 2026; kept as the template.
    { id: "world-cup", start: "2026-06-11", end: "2026-07-19" },
  ];

const THEMES: Record<NexSportThemeId, NexSportTheme> = {
  default: {
    id: "default",
    kind: "default",
    emoji: "⚡",
    badge: "NexSport",
    label: "هویت اصلی",
  },
  spring: {
    id: "spring",
    kind: "season",
    emoji: "🌱",
    badge: "فصل بهار NexSport",
    label: "بهار",
  },
  summer: {
    id: "summer",
    kind: "season",
    emoji: "☀️",
    badge: "فصل تابستان NexSport",
    label: "تابستان",
  },
  autumn: {
    id: "autumn",
    kind: "season",
    emoji: "🍂",
    badge: "فصل پاییز NexSport",
    label: "پاییز",
  },
  winter: {
    id: "winter",
    kind: "season",
    emoji: "❄️",
    badge: "فصل زمستان NexSport",
    label: "زمستان",
  },
  "world-cup": {
    id: "world-cup",
    kind: "event",
    emoji: "🏆",
    badge: "NexSport World Cup Mode",
    label: "جام جهانی",
  },
  olympics: {
    id: "olympics",
    kind: "event",
    emoji: "🏅",
    badge: "NexSport Olympics Mode",
    label: "المپیک",
  },
};

function tehranYmd(date = new Date()): { year: number; month: number; day: number; iso: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  const year = pick("year");
  const month = pick("month");
  const day = pick("day");
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { year, month, day, iso };
}

/** Northern-hemisphere / Jalali-aligned meteorological seasons. */
export function seasonFromDate(date = new Date()): NexSportSeasonId {
  const { month, day } = tehranYmd(date);
  const md = month * 100 + day;
  if (md >= 321 && md <= 620) return "spring";
  if (md >= 621 && md <= 921) return "summer";
  if (md >= 922 && md <= 1220) return "autumn";
  return "winter";
}

function eventFromDate(date = new Date()): NexSportThemeId | null {
  if (ACTIVE_EVENT) return ACTIVE_EVENT;
  const { iso } = tehranYmd(date);
  for (const window of EVENT_WINDOWS) {
    if (iso >= window.start && iso <= window.end) return window.id;
  }
  return null;
}

export function resolveNexSportTheme(date = new Date()): NexSportTheme {
  const eventId = eventFromDate(date);
  if (eventId) return THEMES[eventId];
  return THEMES[seasonFromDate(date)];
}

export function getNexSportTheme(id: NexSportThemeId): NexSportTheme {
  return THEMES[id];
}
