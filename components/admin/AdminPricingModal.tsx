"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { NexSportIcon } from "@/components/NexSportLogo";
import { toPersianDigits } from "@/lib/digits";
import {
  DEFAULT_PRICING_SETTINGS,
  PricingSettings,
  buildVipPlans,
  buildClubProPlans,
  calculateCreditPrice,
  formatFreeClubCaps,
} from "@/lib/payment/pricing";

function toman(n: number) {
  return toPersianDigits(Math.round(n || 0).toLocaleString("en-US"));
}

export function AdminPricingModal() {
  const { isPricingModalOpen, closePricingModal, isAdmin } = useAuth();
  const [form, setForm] = useState<PricingSettings>({ ...DEFAULT_PRICING_SETTINGS });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isPricingModalOpen || !isAdmin) return;
    setMessage(null);
    setLoading(true);
    fetch("/api/admin/pricing/", { credentials: "same-origin" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "خطا در دریافت تنظیمات");
        if (data.settings) setForm(data.settings);
      })
      .catch((err) => {
        setMessage({ type: "error", text: err.message || "خطا در دریافت تنظیمات مالی." });
      })
      .finally(() => setLoading(false));
  }, [isPricingModalOpen, isAdmin]);

  const previewPlans = useMemo(() => buildVipPlans(form), [form]);
  const previewClubPro = useMemo(() => buildClubProPlans(form), [form]);
  const preview100 = useMemo(() => calculateCreditPrice(100, form), [form]);
  const preview10 = useMemo(() => calculateCreditPrice(10, form), [form]);

  function update<K extends keyof PricingSettings>(key: K, raw: string) {
    const n = parseInt(String(raw).replace(/[^\d]/g, ""), 10);
    setForm((prev) => ({ ...prev, [key]: Number.isFinite(n) ? n : 0 }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/pricing/", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMessage({ type: "error", text: data.error || "خطا در ذخیره تنظیمات." });
        return;
      }
      if (data.settings) setForm(data.settings);
      setMessage({ type: "success", text: "تعرفه‌های مالی با موفقیت ذخیره شد و از این لحظه در فروشگاه اعمال می‌شود." });
    } catch {
      setMessage({ type: "error", text: "خطا در ارتباط با سرور." });
    } finally {
      setSaving(false);
    }
  }

  if (!isPricingModalOpen || !isAdmin) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-ink/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl max-h-[92vh] rounded-2xl bg-white shadow-2xl border border-line flex flex-col overflow-hidden text-right"
        dir="rtl"
      >
        <div className="flex items-center justify-between border-b border-line/70 bg-chalk/70 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <NexSportIcon size={26} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-pitch">پلن‌های مالی NexSport</h2>
                <span className="rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 text-[10px] font-black border border-amber-300">
                  فقط مدیر
                </span>
              </div>
              <p className="text-[11px] text-ink/60 mt-0.5">
                مبلغ‌ها و درصدها را خودتان تعیین کنید؛ بدون نیاز به تغییر کد
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closePricingModal}
            className="rounded-lg p-1.5 text-ink/40 hover:bg-chalk hover:text-ink cursor-pointer"
            title="بستن"
          >
            ✕
          </button>
        </div>

        {message && (
          <div
            className={`mx-5 mt-4 rounded-xl border px-3 py-2 text-xs font-bold flex items-center justify-between ${
              message.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <span>{message.text}</span>
            <button type="button" onClick={() => setMessage(null)} className="cursor-pointer">
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="py-16 text-center text-xs font-bold text-slate-500">در حال بارگذاری تعرفه‌ها...</div>
          ) : (
            <>
              {/* 1. Credits */}
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                <h3 className="font-black text-sm text-emerald-950 flex items-center gap-2">
                  <span>📦</span>
                  <span>بسته‌های اعتباری</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <label className="block text-[11px] font-bold text-slate-700">
                    مبلغ هر مسابقه (تومان)
                    <input
                      type="number"
                      min={1000}
                      required
                      value={form.creditPriceTomans}
                      onChange={(e) => update("creditPriceTomans", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </label>
                  <label className="block text-[11px] font-bold text-slate-700">
                    تخفیف به ازای هر چند مسابقه
                    <input
                      type="number"
                      min={1}
                      required
                      value={form.creditDiscountEvery}
                      onChange={(e) => update("creditDiscountEvery", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </label>
                  <label className="block text-[11px] font-bold text-slate-700">
                    درصد تخفیف در هر پله
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        required
                        value={form.creditDiscountPercent}
                        onChange={(e) => update("creditDiscountPercent", e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                      <span className="text-xs font-bold text-slate-600">٪</span>
                    </div>
                  </label>
                  <label className="block text-[11px] font-bold text-slate-700">
                    حداکثر درصد تخفیف
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={90}
                        required
                        value={form.creditDiscountMaxPercent}
                        onChange={(e) => update("creditDiscountMaxPercent", e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                      <span className="text-xs font-bold text-slate-600">٪</span>
                    </div>
                  </label>
                </div>
                <p className="text-[11px] text-emerald-900 leading-relaxed bg-white/70 rounded-xl px-3 py-2 border border-emerald-100">
                  پیش‌نمایش: بسته ۱۰ مسابقه‌ای {toman(preview10.finalPrice)} تومان
                  ({toPersianDigits(preview10.discountPercent)}٪ تخفیف) — بسته ۱۰۰ مسابقه‌ای{" "}
                  {toman(preview100.finalPrice)} تومان ({toPersianDigits(preview100.discountPercent)}٪ تخفیف).
                </p>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <span>🎁</span>
                  <span>سهمیه‌های رایگان</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block text-[11px] font-bold text-slate-700">
                    مسابقات رایگان مهمان
                    <input
                      type="number"
                      min={0}
                      required
                      value={form.guestMaxTournaments}
                      onChange={(e) => update("guestMaxTournaments", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </label>
                  <label className="block text-[11px] font-bold text-slate-700">
                    اعتبار اولیه کاربر ثبت‌نام‌شده
                    <input
                      type="number"
                      min={0}
                      required
                      value={form.userFreePlannings}
                      onChange={(e) => update("userFreePlannings", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </label>
                  <label className="block text-[11px] font-bold text-slate-700">
                    لینک تماشاگر رایگان اولیه
                    <input
                      type="number"
                      min={0}
                      required
                      value={form.userFreeLinks}
                      onChange={(e) => update("userFreeLinks", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </label>
                </div>
                <p className="text-[11px] text-slate-600">
                  اعتبار اولیه فقط برای کاربران جدید اعمال می‌شود. لینک رایگان: ۰ یعنی بدون هدیه، ۱ یعنی اولین لینک تماشاگر رایگان.
                </p>
              </section>

              {/* 2. VIP */}
              <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
                <h3 className="font-black text-sm text-amber-950 flex items-center gap-2">
                  <span>👑</span>
                  <span>اشتراک ویژه VIP</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <label className="block text-[11px] font-bold text-slate-700">
                    مبلغ ماهانه (تومان)
                    <input
                      type="number"
                      min={1000}
                      required
                      value={form.vipMonthlyTomans}
                      onChange={(e) => update("vipMonthlyTomans", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-amber-500 focus:outline-none"
                    />
                  </label>
                  <label className="block text-[11px] font-bold text-slate-700">
                    تخفیف ۳ ماهه
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={90}
                        required
                        value={form.vipDiscount3mPercent}
                        onChange={(e) => update("vipDiscount3mPercent", e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-amber-500 focus:outline-none"
                      />
                      <span className="text-xs font-bold text-slate-600">٪</span>
                    </div>
                  </label>
                  <label className="block text-[11px] font-bold text-slate-700">
                    تخفیف ۶ ماهه
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={90}
                        required
                        value={form.vipDiscount6mPercent}
                        onChange={(e) => update("vipDiscount6mPercent", e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-amber-500 focus:outline-none"
                      />
                      <span className="text-xs font-bold text-slate-600">٪</span>
                    </div>
                  </label>
                  <label className="block text-[11px] font-bold text-slate-700">
                    تخفیف سالانه
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={90}
                        required
                        value={form.vipDiscount12mPercent}
                        onChange={(e) => update("vipDiscount12mPercent", e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-amber-500 focus:outline-none"
                      />
                      <span className="text-xs font-bold text-slate-600">٪</span>
                    </div>
                  </label>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {previewPlans.map((plan) => (
                    <div key={plan.id} className="rounded-xl border border-amber-200 bg-white p-2.5">
                      <div className="text-[10px] font-bold text-amber-900">{plan.title}</div>
                      <div className="font-black text-xs text-slate-900 mt-1">
                        {toman(plan.finalPriceTomans)} تومان
                      </div>
                      {plan.discountPercent > 0 && (
                        <div className="text-[10px] text-rose-700 font-bold mt-0.5">
                          {toPersianDigits(plan.discountPercent)}٪ تخفیف
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* 3. Link */}
              <section className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 space-y-3">
                <h3 className="font-black text-sm text-sky-950 flex items-center gap-2">
                  <span>🔗</span>
                  <span>ایجاد لینک اختصاصی</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                  <label className="block text-[11px] font-bold text-slate-700">
                    مبلغ ایجاد لینک (تومان)
                    <input
                      type="number"
                      min={0}
                      required
                      value={form.linkPriceTomans}
                      onChange={(e) => update("linkPriceTomans", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-sky-600 focus:outline-none"
                    />
                  </label>
                  <label className="block text-[11px] font-bold text-slate-700">
                    معادل سهمیه برنامه‌سازی
                    <input
                      type="number"
                      min={1}
                      required
                      value={form.linkCreditCost}
                      onChange={(e) => update("linkCreditCost", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-sky-600 focus:outline-none"
                    />
                  </label>
                </div>
                <p className="text-[11px] text-sky-900">
                  تعرفه نقدی: <strong>{toman(form.linkPriceTomans)} تومان</strong>
                  {" "}— یا کسر {toPersianDigits(form.linkCreditCost)} سهمیه برنامه‌سازی.
                </p>
              </section>

              <section className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 space-y-3">
                <h3 className="font-black text-sm text-teal-950 flex items-center gap-2">
                  <span>🏟️</span>
                  <span>صفحه عمومی باشگاه</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                  <label className="block text-[11px] font-bold text-slate-700">
                    مبلغ فعال‌سازی صفحه /c/ (تومان)
                    <input
                      type="number"
                      min={0}
                      required
                      value={form.clubPagePriceTomans}
                      onChange={(e) => update("clubPagePriceTomans", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-teal-600 focus:outline-none"
                    />
                  </label>
                  <label className="block text-[11px] font-bold text-slate-700">
                    معادل سهمیه برنامه‌سازی
                    <input
                      type="number"
                      min={1}
                      required
                      value={form.clubPageCreditCost}
                      onChange={(e) => update("clubPageCreditCost", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-teal-600 focus:outline-none"
                    />
                  </label>
                </div>
                <p className="text-[11px] text-teal-900">
                  ایجاد باشگاه رایگان است. تعرفه صفحه عمومی: <strong>{toman(form.clubPagePriceTomans)} تومان</strong>
                  {" "}یا {toPersianDigits(form.clubPageCreditCost)} سهمیه. Club Pro این فعال‌سازی را رایگان می‌کند.
                </p>
              </section>

              <section className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
                <h3 className="font-black text-sm text-indigo-950 flex items-center gap-2">
                  <span>🛡️</span>
                  <span>اشتراک Club Pro (جدا از VIP)</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <label className="block text-[11px] font-bold text-slate-700">
                    مبلغ ماهانه (تومان)
                    <input
                      type="number"
                      min={1000}
                      required
                      value={form.clubProMonthlyTomans}
                      onChange={(e) => update("clubProMonthlyTomans", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                  <label className="block text-[11px] font-bold text-slate-700">
                    تخفیف ۳ ماهه
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={90}
                        required
                        value={form.clubProDiscount3mPercent}
                        onChange={(e) => update("clubProDiscount3mPercent", e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-indigo-500 focus:outline-none"
                      />
                      <span className="text-xs font-bold text-slate-600">٪</span>
                    </div>
                  </label>
                  <label className="block text-[11px] font-bold text-slate-700">
                    تخفیف ۶ ماهه
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={90}
                        required
                        value={form.clubProDiscount6mPercent}
                        onChange={(e) => update("clubProDiscount6mPercent", e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-indigo-500 focus:outline-none"
                      />
                      <span className="text-xs font-bold text-slate-600">٪</span>
                    </div>
                  </label>
                  <label className="block text-[11px] font-bold text-slate-700">
                    تخفیف سالانه
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={90}
                        required
                        value={form.clubProDiscount12mPercent}
                        onChange={(e) => update("clubProDiscount12mPercent", e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-indigo-500 focus:outline-none"
                      />
                      <span className="text-xs font-bold text-slate-600">٪</span>
                    </div>
                  </label>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {previewClubPro.map((plan) => (
                    <div key={plan.id} className="rounded-xl border border-indigo-200 bg-white p-2.5">
                      <div className="text-[10px] font-bold text-indigo-900">{plan.title}</div>
                      <div className="font-black text-xs text-slate-900 mt-1">
                        {toman(plan.finalPriceTomans)} تومان
                      </div>
                      {plan.discountPercent > 0 && (
                        <div className="text-[10px] text-rose-700 font-bold mt-0.5">
                          {toPersianDigits(plan.discountPercent)}٪ تخفیف
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <label className="block text-[11px] font-bold text-slate-700">
                    سقف باشگاه رایگان
                    <input
                      type="number"
                      min={0}
                      required
                      value={form.freeClubLimit}
                      onChange={(e) => update("freeClubLimit", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                  <label className="block text-[11px] font-bold text-slate-700">
                    سقف تیم رایگان
                    <input
                      type="number"
                      min={0}
                      required
                      value={form.freeClubTeams}
                      onChange={(e) => update("freeClubTeams", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                  <label className="block text-[11px] font-bold text-slate-700">
                    سقف بازیکن رایگان
                    <input
                      type="number"
                      min={0}
                      required
                      value={form.freeClubPlayers}
                      onChange={(e) => update("freeClubPlayers", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                  <label className="block text-[11px] font-bold text-slate-700">
                    سقف مربی رایگان
                    <input
                      type="number"
                      min={0}
                      required
                      value={form.freeClubCoaches}
                      onChange={(e) => update("freeClubCoaches", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                </div>
                <p className="text-[11px] text-indigo-900">
                  طرح رایگان فعلی: {formatFreeClubCaps(form)}. Club Pro این سقف‌ها را برمی‌دارد. لینک ثبت‌نام مسابقه همیشه رایگان است.
                </p>
              </section>
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-1 pb-2">
            <button
              type="button"
              onClick={closePricingModal}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              بستن
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="rounded-xl bg-pitch px-5 py-2.5 text-xs font-black text-white hover:bg-pitch-light shadow-sm cursor-pointer disabled:opacity-50"
            >
              {saving ? "در حال ذخیره..." : "ذخیره تعرفه‌ها"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
