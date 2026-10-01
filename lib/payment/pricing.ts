/**
 * NexSport Pricing, Plans & Quota Rules
 *
 * Admin-configurable defaults (editable from the financial plans panel):
 * 1. Credit packages: 50,000 Tomans per tournament. 1% extra discount for every 5 credits.
 * 2. VIP: 350,000 Tomans / month with 20% (3m), 30% (6m), 40% (1y) discounts.
 * 3. Dedicated spectator link: 150,000 Tomans.
 */

export const DEDICATED_LINK_PRICE_TOMANS = 150_000;
export const BASE_PLANNING_PRICE_TOMANS = 50_000;
export const GUEST_MAX_TOURNAMENTS = 2;
export const USER_FREE_PLANNINGS = 5;
export const USER_FREE_LINKS = 1;

export type DiscountItemType = "credits" | "vip" | "link";
export type DiscountAppliesTo = DiscountItemType | "planning" | "all";

export const DISCOUNT_APPLIES_OPTIONS: { value: DiscountAppliesTo; label: string }[] = [
  { value: "credits", label: "بسته‌های اعتباری" },
  { value: "vip", label: "حساب VIP" },
  { value: "link", label: "ایجاد لینک" },
  { value: "planning", label: "برنامه‌ریزی (اعتباری و VIP)" },
  { value: "all", label: "هر سه مورد" },
];

export const DISCOUNT_APPLIES_LABELS: Record<DiscountAppliesTo, string> = {
  credits: "فقط بسته‌های اعتباری",
  vip: "فقط حساب VIP",
  link: "فقط ایجاد لینک",
  planning: "برنامه‌ریزی (اعتباری و VIP)",
  all: "هر سه مورد",
};

export function discountAppliesToItem(
  appliesTo: string | null | undefined,
  itemType: DiscountItemType | "planning"
): boolean {
  const scope = (appliesTo || "all") as DiscountAppliesTo;
  if (scope === "all") return true;
  if (scope === itemType) return true;
  if (scope === "planning" && (itemType === "credits" || itemType === "vip" || itemType === "planning")) {
    return true;
  }
  if (itemType === "planning" && (scope === "credits" || scope === "vip" || scope === "planning")) {
    return true;
  }
  return false;
}

export function mismatchDiscountMessage(appliesTo: string | null | undefined): string {
  const scope = (appliesTo || "all") as DiscountAppliesTo;
  if (scope === "credits") return "این کد تخفیف فقط برای بسته‌های اعتباری مسابقه قابل استفاده است.";
  if (scope === "vip") return "این کد تخفیف فقط برای اشتراک ویژه VIP قابل استفاده است.";
  if (scope === "link") return "این کد تخفیف فقط برای فعال‌سازی لینک اختصاصی تماشاگران قابل استفاده است.";
  if (scope === "planning") return "این کد تخفیف فقط برای برنامه‌ریزی مسابقات (بسته‌های اعتباری و اشتراک VIP) قابل استفاده است.";
  return "این کد تخفیف برای این بخش قابل استفاده نیست.";
}

export interface PricingSettings {
  creditPriceTomans: number;
  creditDiscountEvery: number;
  creditDiscountPercent: number;
  vipMonthlyTomans: number;
  vipDiscount3mPercent: number;
  vipDiscount6mPercent: number;
  vipDiscount12mPercent: number;
  linkPriceTomans: number;
}

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  creditPriceTomans: 50_000,
  creditDiscountEvery: 5,
  creditDiscountPercent: 1,
  vipMonthlyTomans: 350_000,
  vipDiscount3mPercent: 20,
  vipDiscount6mPercent: 30,
  vipDiscount12mPercent: 40,
  linkPriceTomans: 150_000,
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
    vipMonthlyTomans: clampInt(src.vipMonthlyTomans, DEFAULT_PRICING_SETTINGS.vipMonthlyTomans, 1_000, 50_000_000),
    vipDiscount3mPercent: clampInt(src.vipDiscount3mPercent, DEFAULT_PRICING_SETTINGS.vipDiscount3mPercent, 0, 90),
    vipDiscount6mPercent: clampInt(src.vipDiscount6mPercent, DEFAULT_PRICING_SETTINGS.vipDiscount6mPercent, 0, 90),
    vipDiscount12mPercent: clampInt(src.vipDiscount12mPercent, DEFAULT_PRICING_SETTINGS.vipDiscount12mPercent, 0, 90),
    linkPriceTomans: clampInt(src.linkPriceTomans, DEFAULT_PRICING_SETTINGS.linkPriceTomans, 0, 50_000_000),
  };
}

export interface CreditPackagePreset {
  count: number;
  label: string;
  tag?: string;
  isPopular?: boolean;
}

export const CREDIT_PRESETS: CreditPackagePreset[] = [
  { count: 1, label: "۱ مسابقه", tag: "شروع سریع" },
  { count: 10, label: "۱۰ مسابقه", tag: "اقتصادی" },
  { count: 50, label: "۵۰ مسابقه", tag: "پرفروش‌ترین", isPopular: true },
  { count: 100, label: "۱۰۰ مسابقه", tag: "ویژه باشگاه‌ها و مدارس" },
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
    extra: { id: string; title: string; durationLabel: string; tag: string; isPopular?: boolean; extraFeatures: string[] }
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
      tag: extra.tag,
      isPopular: extra.isPopular,
      features,
    };
  };

  return [
    make(1, 0, {
      id: "vip-1m",
      title: "کاربر ویژه ۱ ماهه",
      durationLabel: "۱ ماه (۳۰ روز)",
      tag: "شروع آسان",
      extraFeatures: ["نشان اختصاصی کاربر ویژه VIP", "پشتیبانی آنلاین و اولویت‌دار"],
    }),
    make(3, s.vipDiscount3mPercent, {
      id: "vip-3m",
      title: "کاربر ویژه ۳ ماهه",
      durationLabel: "۳ ماه (۹۰ روز)",
      tag: `${s.vipDiscount3mPercent}٪ تخفیف فصلی`,
      extraFeatures: ["{saved} صرفه‌جویی نسبت به اشتراک ماهانه", "مناسب دوره‌های مسابقاتی و جام‌های ورزشی فصلی"],
    }),
    make(6, s.vipDiscount6mPercent, {
      id: "vip-6m",
      title: "کاربر ویژه ۶ ماهه",
      durationLabel: "۶ ماه (۱۸۰ روز)",
      tag: `${s.vipDiscount6mPercent}٪ تخفیف نیم‌سال`,
      extraFeatures: ["{saved} صرفه‌جویی ویژه", "مناسب ترم‌های آموزشی، مدارس فوتبال و باشگاه‌ها"],
    }),
    make(12, s.vipDiscount12mPercent, {
      id: "vip-12m",
      title: "کاربر ویژه ۱ ساله (طلایی)",
      durationLabel: "۱ سال (۳۶۵ روز)",
      tag: `${s.vipDiscount12mPercent}٪ تخفیف - اقتصادی‌ترین`,
      isPopular: true,
      extraFeatures: [
        "{saved} تخفیف ویژه سالانه",
        "دسترسی زودهنگام به تمام امکانات و فرمت‌های جدید",
        "خط پشتیبانی VIP اختصاصی",
      ],
    }),
  ];
}

export const VIP_PLANS: VipPlan[] = buildVipPlans();

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

  const discountPercent = Math.min(90, Math.floor(safeCount / everyN) * perStep);
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
