export const TEAM_SPORTS = [
  "فوتبال",
  "فوتسال",
  "والیبال",
  "بسکتبال",
  "هندبال",
  "کشتی",
  "سایر",
] as const;

export const PLAYER_POSITIONS = [
  "دروازه‌بان",
  "مدافع",
  "هافبک",
  "مهاجم",
  "لیبرو",
  "پاسور",
  "سایر",
] as const;

export const PLAYER_STATUSES = [
  { id: "active", label: "فعال" },
  { id: "injured", label: "مصدوم" },
  { id: "inactive", label: "خارج از فهرست" },
] as const;

export type PlayerStatus = (typeof PLAYER_STATUSES)[number]["id"];

export function playerStatusLabel(status?: string) {
  return PLAYER_STATUSES.find((s) => s.id === status)?.label || "فعال";
}
