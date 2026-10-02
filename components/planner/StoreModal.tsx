"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { toPersianDigits } from "@/lib/digits";
import {
  CREDIT_PRESETS,
  VIP_PLANS,
  DEFAULT_PRICING_SETTINGS,
  PricingSettings,
  calculateCreditPrice,
  VipPlan,
  LINK_ACTIVATION_CREDIT_COST,
} from "@/lib/payment/pricing";

interface StoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "credits" | "vip";
  initialSuccess?: {
    type: "credits" | "vip";
    count?: number;
    totalCredits?: number;
    title?: string;
    refId?: string;
  } | null;
  onSuccess?: () => void;
}

export function StoreModal({
  isOpen,
  onClose,
  initialTab = "credits",
  initialSuccess = null,
  onSuccess,
}: StoreModalProps) {
  const { user, openAuthModal, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<"credits" | "vip">(initialTab);

  // Credit Tab State
  const [selectedPreset, setSelectedPreset] = useState<number>(10);
  const [customCount, setCustomCount] = useState<string>("10");
  const [isCustomMode, setIsCustomMode] = useState(false);

  // VIP Tab State
  const [selectedVipPlan, setSelectedVipPlan] = useState<string>("vip-12m");

  // User Quota State
  const [quota, setQuota] = useState<{
    isGuest: boolean;
    planningCredits?: number;
    freeLinkAvailable?: boolean;
    isVip?: boolean;
    unlimitedPlanning?: boolean;
    vipExpiresAt?: string | null;
    remaining?: number;
    guestCount?: number;
    guestLimit?: number;
  } | null>(null);

  const [loadingQuota, setLoadingQuota] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [successInfo, setSuccessInfo] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Discount code state
  const [discountCodeInput, setDiscountCodeInput] = useState("");
  const [validatingDiscount, setValidatingDiscount] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    discountPercent: number;
  } | null>(null);

  const [pricingSettings, setPricingSettings] = useState<PricingSettings>({ ...DEFAULT_PRICING_SETTINGS });
  const [vipPlans, setVipPlans] = useState<VipPlan[]>(VIP_PLANS);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const purchaseResultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    setSuccessInfo(initialSuccess || null);
    setError(null);
    setAppliedDiscount(null);
    setDiscountError(null);
    loadQuota();
    loadPricing();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || (!successInfo && !error)) return;
    const id = window.requestAnimationFrame(() => {
      bodyScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [isOpen, successInfo, error]);

  async function loadPricing() {
    try {
      const res = await fetch("/api/pricing/", { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) setPricingSettings(data.settings);
        if (Array.isArray(data.vipPlans) && data.vipPlans.length) setVipPlans(data.vipPlans);
      }
    } catch {}
  }

  async function loadQuota() {
    setLoadingQuota(true);
    try {
      const res = await fetch("/api/tournaments/quota/", { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        if (data.isGuest && user) {
          setQuota({
            isGuest: false,
            planningCredits: isAdmin ? 999999 : 5,
            freeLinkAvailable: true,
            isVip: false,
            unlimitedPlanning: isAdmin,
          });
        } else {
          setQuota(data);
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoadingQuota(false);
    }
  }

  // Active count calculation
  const activeCount = isCustomMode
    ? Math.max(1, parseInt(customCount, 10) || 1)
    : selectedPreset;

  const creditPricing = calculateCreditPrice(activeCount, pricingSettings);
  const selectedVip = vipPlans.find((p) => p.id === selectedVipPlan) || vipPlans[3] || vipPlans[0];

  // Dynamic discount amounts
  const creditDiscountAmount = appliedDiscount
    ? Math.round((creditPricing.finalPrice * appliedDiscount.discountPercent) / 100)
    : 0;
  const creditFinalPay = appliedDiscount
    ? Math.max(0, creditPricing.finalPrice - creditDiscountAmount)
    : creditPricing.finalPrice;

  const vipDiscountAmount = appliedDiscount
    ? Math.round((selectedVip.finalPriceTomans * appliedDiscount.discountPercent) / 100)
    : 0;
  const vipFinalPay = appliedDiscount
    ? Math.max(0, selectedVip.finalPriceTomans - vipDiscountAmount)
    : selectedVip.finalPriceTomans;

  function handleSelectPreset(count: number) {
    setSelectedPreset(count);
    setCustomCount(String(count));
    setIsCustomMode(false);
  }

  function handleCustomCountChange(val: string) {
    const sanitized = val.replace(/[^0-9]/g, "");
    setCustomCount(sanitized);
    setIsCustomMode(true);
  }

  async function handleApplyDiscount() {
    const rawCode = discountCodeInput.trim().toUpperCase();
    if (!rawCode) {
      setDiscountError("لطفاً کد تخفیف را وارد نمایید.");
      return;
    }

    setValidatingDiscount(true);
    setDiscountError(null);

    try {
      const baseAmt = activeTab === "credits" ? creditPricing.finalPrice : selectedVip.finalPriceTomans;
      const res = await fetch("/api/discount/validate/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: rawCode,
          itemType: activeTab === "credits" ? "credits" : "vip",
          baseAmount: baseAmt,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.valid) {
        setDiscountError(data.error || "کد تخفیف معتبر نمی‌باشد یا منقضی شده است.");
        setAppliedDiscount(null);
        return;
      }

      setAppliedDiscount({
        code: data.code,
        discountPercent: data.discountPercent,
      });
      setDiscountError(null);
    } catch {
      setDiscountError("خطا در بررسی کد تخفیف.");
    } finally {
      setValidatingDiscount(false);
    }
  }

  function handleRemoveDiscount() {
    setAppliedDiscount(null);
    setDiscountCodeInput("");
    setDiscountError(null);
  }

  async function handlePurchaseCredits() {
    if (!user) {
      onClose();
      openAuthModal("login");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const res = await fetch("/api/payment/create/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType: "planning_credits",
          creditCount: creditPricing.count,
          discountCode: appliedDiscount ? appliedDiscount.code : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "خطا در پردازش خرید بسته اعتباری.");
        setProcessing(false);
        return;
      }

      if (data.paymentUrl && !data.isDirectSuccess) {
        window.location.href = data.paymentUrl;
        return;
      }

      const added = Number(data.addedCredits) > 0 ? Number(data.addedCredits) : creditPricing.count;
      const previous =
        typeof quota?.planningCredits === "number" ? quota.planningCredits : 5;
      const reportedTotal = Number(data.newTotalCredits);
      setSuccessInfo({
        type: "credits",
        count: added,
        totalCredits: reportedTotal > 0 ? reportedTotal : previous + added,
        amount: creditFinalPay,
        refId: data.refId,
      });

      await loadQuota();
      if (onSuccess) onSuccess();
    } catch {
      setError("خطا در برقراری ارتباط با درگاه پرداخت.");
    } finally {
      setProcessing(false);
    }
  }

  async function handlePurchaseVip() {
    if (!user) {
      onClose();
      openAuthModal("login");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const res = await fetch("/api/payment/create/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType: "vip_subscription",
          vipPlanId: selectedVip.id,
          discountCode: appliedDiscount ? appliedDiscount.code : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "خطا در پردازش اشتراک ویژه.");
        setProcessing(false);
        return;
      }

      if (data.paymentUrl && !data.isDirectSuccess) {
        window.location.href = data.paymentUrl;
        return;
      }

      setSuccessInfo({
        type: "vip",
        title: selectedVip.title,
        months: selectedVip.months,
        expiresAt: data.expiresAt,
        amount: vipFinalPay,
        refId: data.refId,
      });

      await loadQuota();
      if (onSuccess) onSuccess();
    } catch {
      setError("خطا در برقراری ارتباط با درگاه پرداخت.");
    } finally {
      setProcessing(false);
    }
  }

  const purchaseResultBanner =
    successInfo || error ? (
      <div ref={purchaseResultRef} className="space-y-2">
        {successInfo && (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-3.5 text-emerald-950 space-y-1.5 animate-in zoom-in-95">
            <div className="flex items-center gap-2 font-black text-sm text-emerald-900">
              <span className="text-lg">🎉</span>
              <span>پرداخت با موفقیت انجام شد</span>
            </div>
            {successInfo.type === "credits" ? (
              <p className="text-xs text-emerald-900 leading-relaxed">
                تعداد <strong>{toPersianDigits(successInfo.count)}</strong> مسابقه به حساب شما اضافه شد. موجودی جدید شما:{" "}
                <strong>{toPersianDigits(successInfo.totalCredits)}</strong> مسابقه (بدون تاریخ انقضا).
              </p>
            ) : (
              <p className="text-xs text-emerald-900 leading-relaxed">
                اشتراک <strong>{successInfo.title}</strong> شما فعال گردید. از این لحظه برنامه‌ریزی مسابقات و ایجاد لینک‌های اختصاصی برای شما کاملاً نامحدود و رایگان است!
              </p>
            )}
            {successInfo.refId && (
              <p className="text-[11px] text-emerald-800 font-mono dir-ltr">
                کد پیگیری: {toPersianDigits(successInfo.refId)}
              </p>
            )}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-rose-800 text-xs font-bold flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
      </div>
    ) : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden text-right"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-teal-50 to-white px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm text-xl">
              💎
            </div>
            <div>
              <h2 className="font-black text-sm sm:text-base text-slate-900">
                فروشگاه و ارتقای خدمات NexSport
              </h2>
              <p className="text-[11px] text-slate-500">
                بسته‌های اعتباری مسابقات و اشتراک‌های ویژه VIP
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            title="بستن"
          >
            ✕
          </button>
        </div>

        {!user ? (
          <div className="p-6 space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-center space-y-3">
              <div className="text-3xl">👤</div>
              <h3 className="font-black text-sm text-slate-900">
                برای ادامه وارد حساب کاربری شوید
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                کاربران مهمان می‌توانند تا ۲ مسابقه رایگان برنامه‌ریزی کنند. خرید اعتبار، اشتراک VIP و ایجاد لینک اختصاصی فقط پس از ورود به حساب کاربری در دسترس است.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openAuthModal("login");
                  }}
                  className="w-full sm:flex-1 rounded-xl bg-emerald-600 py-2.5 px-4 font-black text-xs text-white hover:bg-emerald-700 shadow-sm transition-all cursor-pointer"
                >
                  ورود به حساب کاربری
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openAuthModal("register");
                  }}
                  className="w-full sm:flex-1 rounded-xl border border-emerald-300 bg-white py-2.5 px-4 font-black text-xs text-emerald-800 hover:bg-emerald-50 transition-all cursor-pointer"
                >
                  ثبت‌نام رایگان
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
        {/* User Balance Overview Strip */}
        <div className="bg-slate-50 border-b border-slate-200/80 px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          {quota?.isVip ? (
            <div className="flex items-center gap-2 text-amber-900 font-bold">
              <span className="text-amber-500">👑</span>
              <span>اشتراک ویژه VIP فعال است (برنامه‌ریزی و لینک اختصاصی نامحدود)</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-slate-700">
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-600 font-black">⚽</span>
                <span>
                  موجودی برنامه‌ریزی:{" "}
                  <strong className="text-emerald-700 font-black">
                    {isAdmin || quota?.unlimitedPlanning
                      ? "نامحدود"
                      : `${toPersianDigits(quota?.planningCredits ?? 5)} مسابقه`}
                  </strong>
                </span>
              </span>
              <span className="text-slate-300">|</span>
              <span className="flex items-center gap-1.5">
                <span>🎁</span>
                <span>
                  لینک هدیه ثبت‌نام:{" "}
                  <strong className={quota?.freeLinkAvailable ? "text-emerald-700" : "text-slate-400"}>
                    {quota?.freeLinkAvailable ? "آماده استفاده (رایگان)" : "استفاده شده"}
                  </strong>
                </span>
              </span>
            </div>
          )}

        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 px-5 pt-3 gap-2 bg-white shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab("credits");
              setSuccessInfo(null);
              setError(null);
              setAppliedDiscount(null);
              setDiscountError(null);
            }}
            className={`flex items-center gap-2 pb-3 px-3 font-black text-xs sm:text-sm border-b-2 transition-all cursor-pointer ${
              activeTab === "credits"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>📦</span>
            <span>بسته‌های اعتباری مسابقه</span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
              بدون انقضا
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("vip");
              setSuccessInfo(null);
              setError(null);
              setAppliedDiscount(null);
              setDiscountError(null);
            }}
            className={`flex items-center gap-2 pb-3 px-3 font-black text-xs sm:text-sm border-b-2 transition-all cursor-pointer ${
              activeTab === "vip"
                ? "border-amber-500 text-amber-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>👑</span>
            <span>اشتراک کاربر ویژه VIP</span>
            <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-bold">
              لینک رایگان نامحدود
            </span>
          </button>
        </div>

        {/* Content Body */}
        <div ref={bodyScrollRef} className="p-5 space-y-4 overflow-y-auto text-xs">
          {purchaseResultBanner}

          {/* TAB 1: CREDIT PACKAGES */}
          {activeTab === "credits" && (
            <div className="space-y-4">
              <div className="text-slate-600 text-xs leading-relaxed">
                هر واحد اعتبار به شما امکان برنامه‌ریزی و ایجاد یک مسابقه کامل را می‌دهد. این بسته‌ها{" "}
                <strong>بدون تاریخ انقضا</strong> هستند و هر زمان مایل باشید می‌توانید از آن‌ها استفاده کنید:
              </div>

              {/* Preset Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {CREDIT_PRESETS.map((preset) => {
                  const pricing = calculateCreditPrice(preset.count, pricingSettings);
                  const isSelected = !isCustomMode && selectedPreset === preset.count;

                  return (
                    <div
                      key={preset.count}
                      onClick={() => handleSelectPreset(preset.count)}
                      className={`relative rounded-2xl border p-3.5 flex flex-col justify-between transition-all cursor-pointer ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/30 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs"
                      }`}
                    >
                      <div>
                        <div className="font-black text-sm text-slate-900 mb-0.5">
                          {preset.label}
                        </div>
                        {pricing.discountPercent > 0 && (
                          <div className="inline-block bg-rose-100 text-rose-700 font-black text-[10px] px-1.5 py-0.5 rounded-md mb-1.5">
                            {toPersianDigits(pricing.discountPercent)}٪ تخفیف
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 mt-2">
                        <div className="font-black text-xs text-emerald-800">
                          {toPersianDigits(pricing.finalPrice.toLocaleString("en-US"))} تومان
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom Quantity Input Box */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="font-black text-xs text-slate-800">
                    یا تعداد دلخواه مسابقات را بنویسید (حتی غیر رند):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={customCount}
                      onChange={(e) => handleCustomCountChange(e.target.value)}
                      placeholder="مثلاً ۲۵"
                      className="w-24 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-center font-black text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                    />
                    <span className="text-slate-600 font-bold">مسابقه</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  💡 <strong>قانون تخفیف پلکانی:</strong> به ازای هر {toPersianDigits(pricingSettings.creditDiscountEvery)} مسابقه {toPersianDigits(pricingSettings.creditDiscountPercent)}٪ تخفیف اعمال می‌شود (سقف تخفیف {toPersianDigits(pricingSettings.creditDiscountMaxPercent)}٪).
                </p>
              </div>

              {/* Pricing Summary Box */}
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/40 to-white p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-700">
                  <span>تعداد مسابقات انتخابی:</span>
                  <strong className="font-black text-slate-900">
                    {toPersianDigits(creditPricing.count)} مسابقه
                  </strong>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-700">
                  <span>قیمت پایه (هر مسابقه {toPersianDigits(pricingSettings.creditPriceTomans.toLocaleString("en-US"))} تومان):</span>
                  <span>{toPersianDigits(creditPricing.baseTotal.toLocaleString("en-US"))} تومان</span>
                </div>

                {creditPricing.discountPercent > 0 && (
                  <div className="flex items-center justify-between text-xs text-rose-700 font-bold">
                    <span>تخفیف بسته ({toPersianDigits(creditPricing.discountPercent)}٪):</span>
                    <span>- {toPersianDigits(creditPricing.discountTomans.toLocaleString("en-US"))} تومان</span>
                  </div>
                )}

                {appliedDiscount ? (
                  <>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>مبلغ بدون کد تخفیف:</span>
                      <del className="line-through font-bold">
                        {toPersianDigits(creditPricing.finalPrice.toLocaleString("en-US"))} تومان
                      </del>
                    </div>
                    <div className="flex items-center justify-between text-xs text-rose-700 font-bold">
                      <span>کد تخفیف ({toPersianDigits(appliedDiscount.discountPercent)}٪):</span>
                      <span>- {toPersianDigits(creditDiscountAmount.toLocaleString("en-US"))} تومان</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-emerald-100 font-black text-sm sm:text-base text-slate-900">
                      <span>مبلغ نهایی قابل پرداخت:</span>
                      <div className="text-emerald-700 text-lg sm:text-xl font-black">
                        {toPersianDigits(creditFinalPay.toLocaleString("en-US"))} تومان
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between pt-2 border-t border-emerald-100 font-black text-sm sm:text-base text-slate-900">
                    <span>مبلغ قابل پرداخت:</span>
                    <div className="text-emerald-700 text-lg">
                      {toPersianDigits(creditPricing.finalPrice.toLocaleString("en-US"))} تومان
                    </div>
                  </div>
                )}
              </div>

              {/* Discount Code Input Box */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
                <label className="block text-[11px] font-bold text-slate-700">
                  کد تخفیف دارید؟
                </label>
                {appliedDiscount ? (
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-300 p-2.5 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                      <span>✓</span>
                      <span>
                        کد تخفیف «{appliedDiscount.code}» اعمال شد ({toPersianDigits(appliedDiscount.discountPercent)}٪ تخفیف)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveDiscount}
                      className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                    >
                      ✕ حذف
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={discountCodeInput}
                        onChange={(e) => {
                          setDiscountCodeInput(e.target.value.toUpperCase());
                          if (discountError) setDiscountError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleApplyDiscount();
                          }
                        }}
                        placeholder="کد تخفیف را وارد کنید (مثلاً OFF50)"
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-emerald-600 focus:outline-none uppercase placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        disabled={validatingDiscount || !discountCodeInput.trim()}
                        onClick={handleApplyDiscount}
                        className="rounded-xl bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shrink-0"
                      >
                        {validatingDiscount ? "بررسی..." : "اعمال تخفیف"}
                      </button>
                    </div>
                    {discountError && (
                      <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1 pt-0.5">
                        <span>⚠️</span>
                        <span>{discountError}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Note on Dedicated Links */}
              <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-2.5 text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
                <span>ℹ️</span>
                <span>
                  <strong>نکته:</strong> بسته‌های اعتباری مربوط به برنامه‌ریزی و تولید جداول مسابقات است. ایجاد لینک اختصاصی تماشاگران برای هر مسابقه همان {toPersianDigits(pricingSettings.linkPriceTomans.toLocaleString("en-US"))} تومان جداگانه است (به جز ۱ مسابقه اول که هدیه رایگان ثبت‌نام شماست)، یا می‌توانید با کسر {toPersianDigits(LINK_ACTIVATION_CREDIT_COST)} سهمیه اعتبار همان لینک را فعال کنید. در صورتی که مایلید تمام لینک‌ها رایگان باشند، به <strong>اشتراک ویژه VIP</strong> ارتقا دهید.
                </span>
              </div>

              {/* Purchase Action Button */}
              <button
                type="button"
                onClick={handlePurchaseCredits}
                disabled={processing}
                className="w-full rounded-2xl bg-emerald-600 py-3 text-center font-black text-sm text-white hover:bg-emerald-700 shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {processing ? (
                  <span>در حال انتقال به درگاه پرداخت...</span>
                ) : (
                  <>
                    <span>خرید اعتبار و فعال‌سازی فوری</span>
                    <span>({toPersianDigits(creditFinalPay.toLocaleString("en-US"))} تومان)</span>
                    <span>←</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 2: VIP SUBSCRIPTION */}
          {activeTab === "vip" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-white p-3.5 space-y-1.5">
                <div className="font-black text-xs text-amber-950 flex items-center gap-1.5">
                  <span>👑</span>
                  <span>مزایای بی‌نظیر اشتراک کاربر ویژه (VIP)</span>
                </div>
                <div className="text-[11px] text-amber-900 leading-relaxed space-y-1">
                  <div>✓ <strong>برنامه‌ریزی نامحدود مسابقات:</strong> ایجاد هر تعداد مسابقه در تمام فرمت‌ها بدون کسر اعتبار.</div>
                  <div>✓ <strong>ایجاد نامحدود لینک‌های اختصاصی کاملاً رایگان:</strong> دیگر نیازی به پرداخت هزینه {toPersianDigits(pricingSettings.linkPriceTomans.toLocaleString("en-US"))} تومانی برای هیچ مسابقه‌ای ندارید!</div>
                </div>
              </div>

              {/* Plans Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {vipPlans.map((plan) => {
                  const isSelected = selectedVipPlan === plan.id;

                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedVipPlan(plan.id)}
                      className={`relative rounded-2xl border p-4 flex flex-col justify-between transition-all cursor-pointer ${
                        isSelected
                          ? "border-amber-500 bg-amber-50/40 ring-2 ring-amber-400/40 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      {plan.discountPercent > 0 && (
                        <span className="absolute -top-2.5 left-3 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full shadow-2xs">
                          {toPersianDigits(plan.discountPercent)}٪ تخفیف
                        </span>
                      )}

                      <div>
                        <div className="font-black text-sm text-slate-900 mb-1">
                          {plan.title}
                        </div>
                        <div className="text-[11px] text-slate-500 mb-2">
                          {plan.durationLabel}
                        </div>

                        <ul className="space-y-1 text-[11px] text-slate-600 mb-3">
                          {plan.features.slice(0, 3).map((f, idx) => (
                            <li key={idx} className="flex items-center gap-1.5">
                              <span className="text-emerald-600 font-bold">✓</span>
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                        <div>
                          {plan.discountPercent > 0 && (
                            <span className="text-[10px] text-slate-400 line-through ml-1">
                              {toPersianDigits(plan.basePriceTomans.toLocaleString("en-US"))}
                            </span>
                          )}
                          <span className="font-black text-sm text-amber-900">
                            {toPersianDigits(plan.finalPriceTomans.toLocaleString("en-US"))} تومان
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          ماهیانه {toPersianDigits(plan.monthlyEquivalentTomans.toLocaleString("en-US"))}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* VIP Selected Plan Summary & Discount */}
              <div className="rounded-2xl border border-amber-300 bg-amber-50/40 p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-800">
                  <span className="font-bold">پلن انتخابی:</span>
                  <strong className="font-black text-amber-950">
                    {selectedVip.title} ({selectedVip.durationLabel})
                  </strong>
                </div>

                {appliedDiscount ? (
                  <>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>مبلغ پلن:</span>
                      <del className="line-through font-bold">
                        {toPersianDigits(selectedVip.finalPriceTomans.toLocaleString("en-US"))} تومان
                      </del>
                    </div>
                    <div className="flex items-center justify-between text-xs text-rose-700 font-bold">
                      <span>کد تخفیف ({toPersianDigits(appliedDiscount.discountPercent)}٪):</span>
                      <span>- {toPersianDigits(vipDiscountAmount.toLocaleString("en-US"))} تومان</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-amber-200 font-black text-sm sm:text-base text-slate-900">
                      <span>مبلغ نهایی قابل پرداخت:</span>
                      <div className="text-amber-900 text-lg sm:text-xl font-black">
                        {toPersianDigits(vipFinalPay.toLocaleString("en-US"))} تومان
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between pt-2 border-t border-amber-200 font-black text-sm sm:text-base text-slate-900">
                    <span>مبلغ قابل پرداخت:</span>
                    <div className="text-amber-900 text-lg">
                      {toPersianDigits(selectedVip.finalPriceTomans.toLocaleString("en-US"))} تومان
                    </div>
                  </div>
                )}
              </div>

              {/* Discount Code Input Box */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
                <label className="block text-[11px] font-bold text-slate-700">
                  کد تخفیف دارید؟
                </label>
                {appliedDiscount ? (
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-300 p-2.5 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                      <span>✓</span>
                      <span>
                        کد تخفیف «{appliedDiscount.code}» اعمال شد ({toPersianDigits(appliedDiscount.discountPercent)}٪ تخفیف)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveDiscount}
                      className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                    >
                      ✕ حذف
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={discountCodeInput}
                        onChange={(e) => {
                          setDiscountCodeInput(e.target.value.toUpperCase());
                          if (discountError) setDiscountError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleApplyDiscount();
                          }
                        }}
                        placeholder="کد تخفیف را وارد کنید (مثلاً VIP30)"
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-amber-500 focus:outline-none uppercase placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        disabled={validatingDiscount || !discountCodeInput.trim()}
                        onClick={handleApplyDiscount}
                        className="rounded-xl bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shrink-0"
                      >
                        {validatingDiscount ? "بررسی..." : "اعمال تخفیف"}
                      </button>
                    </div>
                    {discountError && (
                      <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1 pt-0.5">
                        <span>⚠️</span>
                        <span>{discountError}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Purchase Action Button */}
              <button
                type="button"
                onClick={handlePurchaseVip}
                disabled={processing}
                className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-center font-black text-sm text-slate-950 hover:from-amber-400 hover:to-amber-500 shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {processing ? (
                  <span>در حال انتقال به درگاه پرداخت...</span>
                ) : (
                  <>
                    <span>ارتقا به کاربر ویژه {selectedVip.title}</span>
                    <span>({toPersianDigits(vipFinalPay.toLocaleString("en-US"))} تومان)</span>
                    <span>←</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
}
