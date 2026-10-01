/**
 * NexSport Pricing, Plans & Quota Rules
 * 
 * Rules:
 * 1. Guests (unregistered): Max 2 tournament creations across all formats (IP-tracked).
 * 2. Registered users: 5 free tournament plannings + 1 free dedicated spectator link gift.
 * 3. Credit Packages: 50,000 Tomans per tournament. No expiration date.
 *    For every 5 credits, increase discount by 1% (e.g. 5 -> 1%, 10 -> 2%, 50 -> 10%, 100 -> 20%).
 *    Supports custom integer count. Dedicated link costs 150,000 Tomans per tournament.
 * 4. VIP Subscription: 1 Month, 3 Months, 6 Months, 1 Year with progressive discounts.
 *    VIP members get UNLIMITED plannings + 100% FREE dedicated tournament links.
 */

export const DEDICATED_LINK_PRICE_TOMANS = 150_000;
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

export const VIP_PLANS: VipPlan[] = [
  {
    id: "vip-1m",
    months: 1,
    title: "کاربر ویژه ۱ ماهه",
    durationLabel: "۱ ماه (۳۰ روز)",
    basePriceTomans: 350_000,
    discountPercent: 0,
    finalPriceTomans: 350_000,
    monthlyEquivalentTomans: 350_000,
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
    basePriceTomans: 1_050_000,
    discountPercent: 20,
    finalPriceTomans: 840_000,
    monthlyEquivalentTomans: 280_000,
    tag: "۲۰٪ تخفیف فصلی",
    features: [
      "برنامه‌ریزی نامحدود مسابقات (تمام فرمت‌ها)",
      "ایجاد نامحدود و رایگان لینک‌های اختصاصی تماشاگران",
      "۲۱۰,۰۰۰ تومان صرفه‌جویی نسبت به اشتراک ماهانه",
      "مناسب دوره‌های مسابقاتی و جام‌های ورزشی فصلی",
    ],
  },
  {
    id: "vip-6m",
    months: 6,
    title: "کاربر ویژه ۶ ماهه",
    durationLabel: "۶ ماه (۱۸۰ روز)",
    basePriceTomans: 2_100_000,
    discountPercent: 30,
    finalPriceTomans: 1_470_000,
    monthlyEquivalentTomans: 245_000,
    tag: "۳۰٪ تخفیف نیم‌سال",
    features: [
      "برنامه‌ریزی نامحدود مسابقات (تمام فرمت‌ها)",
      "ایجاد نامحدود و رایگان لینک‌های اختصاصی تماشاگران",
      "۶۳۰,۰۰۰ تومان صرفه‌جویی ویژه",
      "مناسب ترم‌های آموزشی، مدارس فوتبال و باشگاه‌ها",
    ],
  },
  {
    id: "vip-12m",
    months: 12,
    title: "کاربر ویژه ۱ ساله (طلایی)",
    durationLabel: "۱ سال (۳۶۵ روز)",
    basePriceTomans: 4_200_000,
    discountPercent: 40,
    finalPriceTomans: 2_520_000,
    monthlyEquivalentTomans: 210_000,
    tag: "۴۰٪ تخفیف - اقتصادی‌ترین",
    isPopular: true,
    features: [
      "برنامه‌ریزی نامحدود مسابقات برای کل طول سال",
      "ایجاد نامحدود و رایگان لینک‌های اختصاصی تماشاگران (بدون هیچ هزینه جداگانه)",
      "۱,۶۸۰,۰۰۰ تومان تخفیف ویژه سالانه",
      "دسترسی زودهنگام به تمام امکانات و فرمت‌های جدید",
      "خط پشتیبانی VIP اختصاصی",
    ],
  },
];

/**
 * Calculates credit package price with dynamic tiered discount:
 * 1% extra discount for every 5 tournaments (e.g. 5 -> 1%, 50 -> 10%, 100 -> 20%).
 */
export function calculateCreditPrice(count: number) {
  const safeCount = Math.max(1, Math.floor(Number(count) || 1));
  const baseTotal = safeCount * BASE_PLANNING_PRICE_TOMANS;

  // 1% discount for every 5 credits (capped at 50%)
  const discountPercent = Math.min(50, Math.floor(safeCount / 5));

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
