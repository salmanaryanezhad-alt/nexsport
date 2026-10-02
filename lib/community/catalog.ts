export const SERVICE_CATEGORIES = [
  {
    id: "tournament_ad",
    label: "تبلیغ مسابقات",
    icon: "📢",
    desc: "معرفی و تبلیغ تورنمنت، لیگ و جام برای جذب تیم و تماشاگر.",
  },
  {
    id: "club_intro",
    label: "معرفی باشگاه‌ها",
    icon: "🏟️",
    desc: "معرفی باشگاه، امکانات، رده‌های سنی و جذب بازیکن.",
  },
  {
    id: "education",
    label: "آموزش ورزشی",
    icon: "🎓",
    desc: "دوره، کلاس و محتوای آموزشی برای ورزشکاران و مربیان.",
  },
  {
    id: "coach",
    label: "مربی و متخصص",
    icon: "🧢",
    desc: "مربی، بدنساز، آنالیزور و متخصص فنی.",
  },
  {
    id: "consultant",
    label: "مشاور",
    icon: "💬",
    desc: "مشاوره برگزاری مسابقه، مدیریت باشگاه و مسیر ورزشی.",
  },
  {
    id: "related",
    label: "خدمات مرتبط",
    icon: "🛠️",
    desc: "خدمات جانبی برای ورزشکاران و برگزارکنندگان.",
  },
] as const;

export type ServiceCategoryId = (typeof SERVICE_CATEGORIES)[number]["id"];

export const SERVICE_CATEGORY_IDS: ServiceCategoryId[] = SERVICE_CATEGORIES.map((c) => c.id);

export function serviceCategoryLabel(id?: string) {
  return SERVICE_CATEGORIES.find((c) => c.id === id)?.label || "خدمات";
}

export function serviceCategoryMeta(id?: string) {
  return SERVICE_CATEGORIES.find((c) => c.id === id) || SERVICE_CATEGORIES[SERVICE_CATEGORIES.length - 1];
}

export const TOURNAMENT_FORMAT_LABELS: Record<string, string> = {
  league: "لیگ دوره‌ای",
  "double-league": "لیگ رفت و برگشت",
  groups: "مرحله گروهی",
  "groups-knockout": "گروهی + حذفی",
  knockout: "حذفی",
  "double-knockout": "دو حذفی",
};

export function tournamentFormatLabel(format?: string) {
  return TOURNAMENT_FORMAT_LABELS[format || ""] || format || "مسابقه";
}
