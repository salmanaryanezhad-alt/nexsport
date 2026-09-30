/**
 * NexSport Pricing, Plans & Quota Rules
 * 
 * Rules:
 * 1. Guests (unregistered): Max 2 tournament creations across all formats (IP-tracked).
 * 2. Registered users: 5 free tournament plannings + 1 free dedicated spectator link gift.
 * 3. Credit Packages: 50,000 Tomans per tournament. No expiration date.
 *    For counts > 10: for every 10 credits, increase discount by 1% (e.g. 20 -> 2%, 50 -> 5%, 100 -> 10%).
 *    Supports custom integer count. Dedicated link still costs 200,000 Tomans per tournament.
 * 4. VIP Subscription: 1 Month, 3 Months, 6 Months, 1 Year with progressive discounts.
 *    VIP members get UNLIMITED plannings + 100% FREE dedicated tournament links.
 */

export const DEDICATED_LINK_PRICE_TOMANS = 200_000;
export const BASE_PLANNING_PRICE_TOMANS = 50_000;
export const GUEST_MAX_TOURNAMENTS = 2;
export const USER_FREE_PLANNINGS = 5;
export const USER_FREE_LINKS = 1;

export interface CreditPackagePreset {
  count: number;
  label: string;
  tag?: string;
  isPopular?: boolean;
}

export const CREDIT_PRESETS: CreditPackagePreset[] = [
  { count: 5, label: "۵ مسابقه", tag: "شروع سریع" },
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

export const VIP_PLANS: VipPlan[] = [
  {
    id: "vip-1m",
    months: 1,
    title: "کاربر ویژه ۱ ماهه",
    durationLabel: "۱ ماه (۳۰ روز)",
    basePriceTomans: 290_000,
    discountPercent: 0,
    finalPriceTomans: 290_000,
    monthlyEquivalentTomans: 290_000,
    tag: "شروع آسان",
    features: [
      "برنامه‌ریزی نامحدود مسابقات (تمام فرمت‌ها)",
      "ایجاد نامحدود و رایگان لینک‌های اختصاصی تماشاگران",
      "نشان اختصاصی کاربر ویژه VIP",
      "پشتیبانی آنلاین و اولویت‌دار",
    ],
  },
  {
    id: "vip-3m",
    months: 3,
    title: "کاربر ویژه ۳ ماهه",
    durationLabel: "۳ ماه (۹۰ روز)",
    basePriceTomans: 870_000,
    discountPercent: 20,
    finalPriceTomans: 690_000,
    monthlyEquivalentTomans: 230_000,
    tag: "۲۰٪ تخفیف فصلی",
    features: [
      "برنامه‌ریزی نامحدود مسابقات (تمام فرمت‌ها)",
      "ایجاد نامحدود و رایگان لینک‌های اختصاصی تماشاگران",
      "۱۸۰,۰۰۰ تومان صرفه‌جویی نسبت به اشتراک ماهانه",
      "مناسب دوره‌های مسابقاتی و جام‌های ورزشی فصلی",
    ],
  },
  {
    id: "vip-6m",
    months: 6,
    title: "کاربر ویژه ۶ ماهه",
    durationLabel: "۶ ماه (۱۸۰ روز)",
    basePriceTomans: 1_740_000,
    discountPercent: 31,
    finalPriceTomans: 1_190_000,
    monthlyEquivalentTomans: 198_000,
    tag: "۳۱٪ تخفیف نیم‌سال",
    features: [
      "برنامه‌ریزی نامحدود مسابقات (تمام فرمت‌ها)",
      "ایجاد نامحدود و رایگان لینک‌های اختصاصی تماشاگران",
      "۵۵۰,۰۰۰ تومان صرفه‌جویی ویژه",
      "مناسب ترم‌های آموزشی، مدارس فوتبال و باشگاه‌ها",
    ],
  },
  {
    id: "vip-12m",
    months: 12,
    title: "کاربر ویژه ۱ ساله (طلایی)",
    durationLabel: "۱ سال (۳۶۵ روز)",
    basePriceTomans: 3_480_000,
    discountPercent: 43,
    finalPriceTomans: 1_990_000,
    monthlyEquivalentTomans: 165_000,
    tag: "۴۳٪ تخفیف - اقتصادی‌ترین",
    isPopular: true,
    features: [
      "برنامه‌ریزی نامحدود مسابقات برای کل طول سال",
      "ایجاد نامحدود و رایگان لینک‌های اختصاصی تماشاگران (بدون هیچ هزینه جداگانه)",
      "۱,۴۹۰,۰۰۰ تومان تخفیف ویژه سالانه",
      "دسترسی زودهنگام به تمام امکانات و فرمت‌های جدید",
      "خط پشتیبانی VIP اختصاصی",
    ],
  },
];

/**
 * Calculates credit package price with dynamic tiered discount:
 * "برای بسته های بالاتر از ۱۰ هر ده تا میزان تخفیف رو یه درصد افزایش بده"
 */
export function calculateCreditPrice(count: number) {
  const safeCount = Math.max(1, Math.floor(Number(count) || 1));
  const baseTotal = safeCount * BASE_PLANNING_PRICE_TOMANS;

  let discountPercent = 0;
  if (safeCount > 10) {
    // 1% discount for every 10 credits (e.g. 20 -> 2%, 50 -> 5%, 100 -> 10%)
    discountPercent = Math.min(30, Math.floor(safeCount / 10));
  }

  const discountTomans = Math.round((baseTotal * discountPercent) / 100);
  const finalPrice = baseTotal - discountTomans;

  return {
    count: safeCount,
    pricePerUnit: BASE_PLANNING_PRICE_TOMANS,
    baseTotal,
    discountPercent,
    discountTomans,
    finalPrice,
  };
}
