/**
 * NexSport Pricing, Plans & Quota Rules
 *
 * Admin-configurable defaults (editable from the financial plans panel):
 * 1. Credit packages: 50,000 Tomans per tournament. 1% extra discount for every 5 credits.
 * 2. VIP: 350,000 Tomans / month with 20% (3m), 25% (6m), 30% (1y) discounts.
 * 3. Dedicated spectator link: 150,000 Tomans.
 * 4. Online registration link: always free (included with a saved tournament).
 * 5. Public club page: 100,000 Tomans (or 2 planning credits). Create-club stays free.
 * 6. Club Pro: 200,000 Tomans / month, separate from organizer VIP. Free caps: 1 club / 1 team / 15 players / 2 coaches.
 */

export const DEDICATED_LINK_PRICE_TOMANS = 150_000;
export const BASE_PLANNING_PRICE_TOMANS = 50_000;
/** Dedicated-link activation via planning credits: 3 quotas = 150,000 Tomans. */
export const LINK_ACTIVATION_CREDIT_COST = 3;
export const REGISTRATION_LINK_PRICE_TOMANS = 100_000;
/** Registration-link activation via planning credits: 2 quotas = 100,000 Tomans. */
export const REGISTRATION_CREDIT_COST = 2;
/** Public club page `/c/[id]` — same muscle as registration link. */
export const CLUB_PAGE_PRICE_TOMANS = 100_000;
export const CLUB_PAGE_CREDIT_COST = 2;
/** Club Pro is separate from organizer VIP. */
export const CLUB_PRO_MONTHLY_TOMANS = 200_000;
export const FREE_CLUB_LIMIT = 1;
export const FREE_CLUB_TEAMS = 1;
export const FREE_CLUB_PLAYERS = 15;
export const FREE_CLUB_COACHES = 2;
export const GUEST_MAX_TOURNAMENTS = 2;
export const USER_FREE_PLANNINGS = 5;
export const USER_FREE_LINKS = 1;

export type DiscountItemType = "credits" | "vip" | "link" | "club_page" | "club_pro";
/** Stored as "all" or a comma-separated list of DiscountItemType. Legacy: planning. */
export type DiscountAppliesTo = string;

export const DISCOUNT_ITEM_TYPES: DiscountItemType[] = ["credits", "vip", "link", "club_page", "club_pro"];

export const DISCOUNT_ITEM_OPTIONS: { value: DiscountItemType; label: string }[] = [
  { value: "credits", label: "بسته‌های اعتباری مسابقه" },
  { value: "vip", label: "اشتراک VIP برگزارکننده" },
  { value: "link", label: "لینک اختصاصی تماشاگران" },
  { value: "club_page", label: "صفحه عمومی باشگاه" },
  { value: "club_pro", label: "اشتراک Club Pro" },
];

export const DISCOUNT_ITEM_LABELS: Record<DiscountItemType, string> = {
  credits: "بسته‌های اعتباری مسابقه",
  vip: "اشتراک VIP برگزارکننده",
  link: "لینک اختصاصی تماشاگران",
  club_page: "صفحه عمومی باشگاه",
  club_pro: "اشتراک Club Pro",
};

export const DISCOUNT_APPLIES_OPTIONS: { value: DiscountItemType | "all"; label: string }[] = [
  ...DISCOUNT_ITEM_OPTIONS,
  { value: "all", label: "همه موارد پرداخت" },
];

export function parseAppliesTo(raw: string | string[] | null | undefined): DiscountItemType[] {
  if (Array.isArray(raw)) {
    if (raw.length === 0) return [];
    return parseAppliesTo(raw.join(","));
  }
  if (raw == null) return [...DISCOUNT_ITEM_TYPES];
  const s = String(raw).trim().toLowerCase();
  if (!s || s === "all") return [...DISCOUNT_ITEM_TYPES];
  const parts = s.split(/[,|;\s]+/).map((p) => p.trim()).filter(Boolean);
  const set = new Set<DiscountItemType>();
  for (const p of parts) {
    if (p === "all") return [...DISCOUNT_ITEM_TYPES];
    if (p === "planning") {
      set.add("credits");
      set.add("vip");
      continue;
    }
    if ((DISCOUNT_ITEM_TYPES as string[]).includes(p)) set.add(p as DiscountItemType);
  }
  return DISCOUNT_ITEM_TYPES.filter((t) => set.has(t));
}

export function serializeAppliesTo(raw: string | string[] | null | undefined): string {
  if (Array.isArray(raw) && raw.length === 0) return "";
  const items = parseAppliesTo(raw);
  if (items.length === 0) return "";
  if (items.length === DISCOUNT_ITEM_TYPES.length) return "all";
  return items.join(",");
}

export function discountAppliesToItem(
  appliesTo: string | string[] | null | undefined,
  itemType: DiscountItemType | "planning"
): boolean {
  const items = parseAppliesTo(appliesTo);
  if (itemType === "planning") return items.includes("credits") || items.includes("vip");
  return items.includes(itemType);
}

export function formatAppliesToLabel(appliesTo: string | string[] | null | undefined): string {
  const items = parseAppliesTo(appliesTo);
  if (items.length === DISCOUNT_ITEM_TYPES.length) return "همه موارد پرداخت";
  if (items.length === 0) return "هیچ موردی";
  return items.map((i) => DISCOUNT_ITEM_LABELS[i]).join("، ");
}

export function mismatchDiscountMessage(appliesTo: string | string[] | null | undefined): string {
  return `این کد تخفیف برای این بخش قابل استفاده نیست. محدوده کد: ${formatAppliesToLabel(appliesTo)}.`;
}

export interface PricingSettings {
  creditPriceTomans: number;
  creditDiscountEvery: number;
  creditDiscountPercent: number;
  creditDiscountMaxPercent: number;
  vipMonthlyTomans: number;
  vipDiscount3mPercent: number;
  vipDiscount6mPercent: number;
  vipDiscount12mPercent: number;
  linkPriceTomans: number;
  linkCreditCost: number;
  registrationPriceTomans: number;
  clubPagePriceTomans: number;
  clubPageCreditCost: number;
  clubProMonthlyTomans: number;
  clubProDiscount3mPercent: number;
  clubProDiscount6mPercent: number;
  clubProDiscount12mPercent: number;
  guestMaxTournaments: number;
  userFreePlannings: number;
  userFreeLinks: number;
  freeClubLimit: number;
  freeClubTeams: number;
  freeClubPlayers: number;
  freeClubCoaches: number;
}

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  creditPriceTomans: 50_000,
  creditDiscountEvery: 5,
  creditDiscountPercent: 1,
  creditDiscountMaxPercent: 20,
  vipMonthlyTomans: 350_000,
  vipDiscount3mPercent: 20,
  vipDiscount6mPercent: 25,
  vipDiscount12mPercent: 30,
  linkPriceTomans: 150_000,
  linkCreditCost: LINK_ACTIVATION_CREDIT_COST,
  registrationPriceTomans: 100_000,
  clubPagePriceTomans: 100_000,
  clubPageCreditCost: CLUB_PAGE_CREDIT_COST,
  clubProMonthlyTomans: 200_000,
  clubProDiscount3mPercent: 20,
  clubProDiscount6mPercent: 25,
  clubProDiscount12mPercent: 30,
  guestMaxTournaments: GUEST_MAX_TOURNAMENTS,
  userFreePlannings: USER_FREE_PLANNINGS,
  userFreeLinks: USER_FREE_LINKS,
  freeClubLimit: FREE_CLUB_LIMIT,
  freeClubTeams: FREE_CLUB_TEAMS,
  freeClubPlayers: FREE_CLUB_PLAYERS,
  freeClubCoaches: FREE_CLUB_COACHES,
};

export function sanitizePricingSettings(input: Partial<PricingSettings> | null | undefined): PricingSettings {
  const src = input || {};
  const clampInt = (value: unknown, fallback: number, min: number, max: number) => {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };

  return {
    creditPriceTomans: clampInt(src.creditPriceTomans, DEFAULT_PRICING_SETTINGS.creditPriceTomans, 1_000, 10_000_000),
    creditDiscountEvery: clampInt(src.creditDiscountEvery, DEFAULT_PRICING_SETTINGS.creditDiscountEvery, 1, 1000),
    creditDiscountPercent: clampInt(src.creditDiscountPercent, DEFAULT_PRICING_SETTINGS.creditDiscountPercent, 0, 100),
    creditDiscountMaxPercent: clampInt(
      src.creditDiscountMaxPercent,
      DEFAULT_PRICING_SETTINGS.creditDiscountMaxPercent,
      0,
      90
    ),
    vipMonthlyTomans: clampInt(src.vipMonthlyTomans, DEFAULT_PRICING_SETTINGS.vipMonthlyTomans, 1_000, 50_000_000),
    vipDiscount3mPercent: clampInt(src.vipDiscount3mPercent, DEFAULT_PRICING_SETTINGS.vipDiscount3mPercent, 0, 90),
    vipDiscount6mPercent: clampInt(src.vipDiscount6mPercent, DEFAULT_PRICING_SETTINGS.vipDiscount6mPercent, 0, 90),
    vipDiscount12mPercent: clampInt(src.vipDiscount12mPercent, DEFAULT_PRICING_SETTINGS.vipDiscount12mPercent, 0, 90),
    linkPriceTomans: clampInt(src.linkPriceTomans, DEFAULT_PRICING_SETTINGS.linkPriceTomans, 0, 50_000_000),
    linkCreditCost: clampInt(src.linkCreditCost, DEFAULT_PRICING_SETTINGS.linkCreditCost, 1, 100),
    registrationPriceTomans: clampInt(
      src.registrationPriceTomans,
      DEFAULT_PRICING_SETTINGS.registrationPriceTomans,
      0,
      50_000_000
    ),
    clubPagePriceTomans: clampInt(
      src.clubPagePriceTomans,
      DEFAULT_PRICING_SETTINGS.clubPagePriceTomans,
      0,
      50_000_000
    ),
    clubPageCreditCost: clampInt(
      src.clubPageCreditCost,
      DEFAULT_PRICING_SETTINGS.clubPageCreditCost,
      1,
      100
    ),
    clubProMonthlyTomans: clampInt(
      src.clubProMonthlyTomans,
      DEFAULT_PRICING_SETTINGS.clubProMonthlyTomans,
      1_000,
      50_000_000
    ),
    clubProDiscount3mPercent: clampInt(
      src.clubProDiscount3mPercent,
      DEFAULT_PRICING_SETTINGS.clubProDiscount3mPercent,
      0,
      90
    ),
    clubProDiscount6mPercent: clampInt(
      src.clubProDiscount6mPercent,
      DEFAULT_PRICING_SETTINGS.clubProDiscount6mPercent,
      0,
      90
    ),
    clubProDiscount12mPercent: clampInt(
      src.clubProDiscount12mPercent,
      DEFAULT_PRICING_SETTINGS.clubProDiscount12mPercent,
      0,
      90
    ),
    guestMaxTournaments: clampInt(
      src.guestMaxTournaments,
      DEFAULT_PRICING_SETTINGS.guestMaxTournaments,
      0,
      50
    ),
    userFreePlannings: clampInt(
      src.userFreePlannings,
      DEFAULT_PRICING_SETTINGS.userFreePlannings,
      0,
      1000
    ),
    userFreeLinks: clampInt(src.userFreeLinks, DEFAULT_PRICING_SETTINGS.userFreeLinks, 0, 20),
    freeClubLimit: clampInt(src.freeClubLimit, DEFAULT_PRICING_SETTINGS.freeClubLimit, 0, 50),
    freeClubTeams: clampInt(src.freeClubTeams, DEFAULT_PRICING_SETTINGS.freeClubTeams, 0, 100),
    freeClubPlayers: clampInt(src.freeClubPlayers, DEFAULT_PRICING_SETTINGS.freeClubPlayers, 0, 500),
    freeClubCoaches: clampInt(src.freeClubCoaches, DEFAULT_PRICING_SETTINGS.freeClubCoaches, 0, 50),
  };
}

function faNum(n: number): string {
  return Math.round(n)
    .toLocaleString("en-US")
    .replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)] || d);
}

export function formatFreeClubCaps(settings?: Partial<PricingSettings> | null): string {
  const s = sanitizePricingSettings(settings);
  return `${faNum(s.freeClubLimit)} باشگاه، ${faNum(s.freeClubTeams)} تیم، ${faNum(s.freeClubPlayers)} بازیکن، ${faNum(s.freeClubCoaches)} مربی`;
}

export interface CreditPackagePreset {
  count: number;
  label: string;
  tag?: string;
  isPopular?: boolean;
}

export const CREDIT_PRESETS: CreditPackagePreset[] = [
  { count: 1, label: "۱ مسابقه" },
  { count: 10, label: "۱۰ مسابقه" },
  { count: 50, label: "۵۰ مسابقه" },
  { count: 100, label: "۱۰۰ مسابقه" },
];

export interface VipPlan {
  id: string;
  months: number;
  title: string;
  durationLabel: string;
  basePriceTomans: number;
  discountPercent: number;
  finalPriceTomans: number;
  monthlyEquivalentTomans: number;
  tag?: string;
  isPopular?: boolean;
  features: string[];
}

function formatFaAmount(n: number): string {
  const map: Record<string, string> = {
    "0": "۰",
    "1": "۱",
    "2": "۲",
    "3": "۳",
    "4": "۴",
    "5": "۵",
    "6": "۶",
    "7": "۷",
    "8": "۸",
    "9": "۹",
  };
  return Math.round(n)
    .toLocaleString("en-US")
    .replace(/\d/g, (d) => map[d] || d);
}

export function buildVipPlans(settings?: Partial<PricingSettings> | null): VipPlan[] {
  const s = sanitizePricingSettings(settings);
  const monthly = s.vipMonthlyTomans;

  const make = (
    months: number,
    discountPercent: number,
    extra: { id: string; title: string; durationLabel: string; extraFeatures: string[] }
  ): VipPlan => {
    const basePriceTomans = monthly * months;
    const finalPriceTomans = Math.round(basePriceTomans * (1 - discountPercent / 100));
    const monthlyEquivalentTomans = Math.round(finalPriceTomans / months);
    const saved = Math.max(0, basePriceTomans - finalPriceTomans);
    const features = [
      months === 12
        ? "برنامه‌ریزی نامحدود مسابقات برای کل طول سال"
        : "برنامه‌ریزی نامحدود مسابقات (تمام فرمت‌ها)",
      months === 12
        ? "ایجاد نامحدود و رایگان لینک‌های اختصاصی تماشاگران (بدون هیچ هزینه جداگانه)"
        : "ایجاد نامحدود و رایگان لینک‌های اختصاصی تماشاگران",
      ...extra.extraFeatures.map((f) =>
        f.replace("{saved}", `${formatFaAmount(saved)} تومان`)
      ),
    ];
    return {
      id: extra.id,
      months,
      title: extra.title,
      durationLabel: extra.durationLabel,
      basePriceTomans,
      discountPercent,
      finalPriceTomans,
      monthlyEquivalentTomans,
      tag: discountPercent > 0 ? `${discountPercent}٪ تخفیف` : undefined,
      features,
    };
  };

  return [
    make(1, 0, {
      id: "vip-1m",
      title: "کاربر ویژه ۱ ماهه",
      durationLabel: "۱ ماه (۳۰ روز)",
      extraFeatures: ["نشان اختصاصی کاربر ویژه VIP", "پشتیبانی آنلاین و اولویت‌دار"],
    }),
    make(3, s.vipDiscount3mPercent, {
      id: "vip-3m",
      title: "کاربر ویژه ۳ ماهه",
      durationLabel: "۳ ماه (۹۰ روز)",
      extraFeatures: ["{saved} صرفه‌جویی نسبت به اشتراک ماهانه", "مناسب دوره‌های مسابقاتی و جام‌های ورزشی فصلی"],
    }),
    make(6, s.vipDiscount6mPercent, {
      id: "vip-6m",
      title: "کاربر ویژه ۶ ماهه",
      durationLabel: "۶ ماه (۱۸۰ روز)",
      extraFeatures: ["{saved} صرفه‌جویی ویژه", "مناسب ترم‌های آموزشی، مدارس فوتبال و باشگاه‌ها"],
    }),
    make(12, s.vipDiscount12mPercent, {
      id: "vip-12m",
      title: "کاربر ویژه ۱ ساله (طلایی)",
      durationLabel: "۱ سال (۳۶۵ روز)",
      extraFeatures: [
        "{saved} تخفیف ویژه سالانه",
        "دسترسی زودهنگام به تمام امکانات و فرمت‌های جدید",
        "خط پشتیبانی VIP اختصاصی",
      ],
    }),
  ];
}

export const VIP_PLANS: VipPlan[] = buildVipPlans();

export function buildClubProPlans(settings?: Partial<PricingSettings> | null): VipPlan[] {
  const s = sanitizePricingSettings(settings);
  const monthly = s.clubProMonthlyTomans;

  const make = (
    months: number,
    discountPercent: number,
    extra: { id: string; title: string; durationLabel: string; extraFeatures: string[] }
  ): VipPlan => {
    const basePriceTomans = monthly * months;
    const finalPriceTomans = Math.round(basePriceTomans * (1 - discountPercent / 100));
    const monthlyEquivalentTomans = Math.round(finalPriceTomans / months);
    const saved = Math.max(0, basePriceTomans - finalPriceTomans);
    const features = [
      "باشگاه نامحدود (ایجاد باشگاه همچنان رایگان است)",
      "تیم، بازیکن و مربی نامحدود در هر باشگاه",
      "فعال‌سازی رایگان صفحه عمومی باشگاه (/c/)",
      "جدا از اشتراک VIP برگزارکننده — روی برنامه‌ریزی مسابقه اثر ندارد",
      ...extra.extraFeatures.map((f) => f.replace("{saved}", `${formatFaAmount(saved)} تومان`)),
    ];
    return {
      id: extra.id,
      months,
      title: extra.title,
      durationLabel: extra.durationLabel,
      basePriceTomans,
      discountPercent,
      finalPriceTomans,
      monthlyEquivalentTomans,
      tag: discountPercent > 0 ? `${discountPercent}٪ تخفیف` : undefined,
      features,
    };
  };

  return [
    make(1, 0, {
      id: "clubpro-1m",
      title: "Club Pro یک‌ماهه",
      durationLabel: "۱ ماه (۳۰ روز)",
      extraFeatures: ["مناسب تست و فصل کوتاه"],
    }),
    make(3, s.clubProDiscount3mPercent, {
      id: "clubpro-3m",
      title: "Club Pro سه‌ماهه",
      durationLabel: "۳ ماه (۹۰ روز)",
      extraFeatures: ["{saved} صرفه‌جویی نسبت به ماهانه"],
    }),
    make(6, s.clubProDiscount6mPercent, {
      id: "clubpro-6m",
      title: "Club Pro شش‌ماهه",
      durationLabel: "۶ ماه (۱۸۰ روز)",
      extraFeatures: ["{saved} صرفه‌جویی ویژه"],
    }),
    make(12, s.clubProDiscount12mPercent, {
      id: "clubpro-12m",
      title: "Club Pro یک‌ساله",
      durationLabel: "۱ سال (۳۶۵ روز)",
      extraFeatures: ["{saved} تخفیف سالانه"],
    }),
  ];
}

export const CLUB_PRO_PLANS: VipPlan[] = buildClubProPlans();

/**
 * Calculates credit package price with dynamic tiered discount.
 * Coupon codes (if any) MUST be applied later on `finalPrice`, never on the raw base.
 */
export function calculateCreditPrice(count: number, settings?: Partial<PricingSettings> | null) {
  const s = sanitizePricingSettings(settings);
  const safeCount = Math.max(1, Math.floor(Number(count) || 1));
  const unit = s.creditPriceTomans;
  const everyN = Math.max(1, s.creditDiscountEvery);
  const perStep = Math.max(0, s.creditDiscountPercent);
  const baseTotal = safeCount * unit;

  const cap = Math.max(0, Math.min(90, s.creditDiscountMaxPercent));
  const discountPercent = Math.min(cap, Math.floor(safeCount / everyN) * perStep);
  const discountTomans = Math.round((baseTotal * discountPercent) / 100);
  const finalPrice = Math.max(0, baseTotal - discountTomans);

  return {
    count: safeCount,
    pricePerUnit: unit,
    baseTotal,
    discountPercent,
    discountTomans,
    finalPrice,
  };
}

/** Apply a coupon percent on top of an already-discounted final amount. */
export function applyCouponOnFinal(finalAmount: number, couponPercent: number) {
  const base = Math.max(0, Math.round(Number(finalAmount) || 0));
  const percent = Math.min(100, Math.max(0, Number(couponPercent) || 0));
  const discountAmount = Math.round((base * percent) / 100);
  return {
    discountAmount,
    finalAmount: Math.max(0, base - discountAmount),
  };
}
