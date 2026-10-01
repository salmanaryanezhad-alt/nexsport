"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { NexSportIcon } from "@/components/NexSportLogo";
import { toPersianDigits } from "@/lib/digits";

interface DiscountCodeItem {
  id: string;
  code: string;
  discount_percent: number;
  applies_to: "credits" | "vip" | "link" | "planning" | "all";
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  created_by?: string | null;
}

export function AdminDiscountsModal() {
  const { isDiscountsModalOpen, closeDiscountsModal, isAdmin } = useAuth();
  const [discounts, setDiscounts] = useState<DiscountCodeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // New Code Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newPercent, setNewPercent] = useState<string>("20");
  const [newAppliesTo, setNewAppliesTo] = useState<"credits" | "vip" | "link" | "planning" | "all">("all");
  const [hasExpiry, setHasExpiry] = useState(false);
  const [newExpiryDate, setNewExpiryDate] = useState("");
  const [submittingNew, setSubmittingNew] = useState(false);

  const fetchDiscounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/discounts");
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        setError(data.error || `خطا در دریافت کدهای تخفیف (کد ${res.status})`);
        return;
      }

      if (data.discounts && Array.isArray(data.discounts)) {
        setDiscounts(data.discounts);
      }
    } catch {
      setError("خطا در برقراری ارتباط با سرور.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isDiscountsModalOpen && isAdmin) {
      fetchDiscounts();
    }
  }, [isDiscountsModalOpen, isAdmin]);

  useEffect(() => {
    if (actionMessage) {
      const t = setTimeout(() => setActionMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [actionMessage]);

  const handleToggleActive = async (target: DiscountCodeItem) => {
    const nextState = !target.is_active;
    setActionLoadingId(target.id);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/admin/discounts/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextState }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionMessage({
          type: "error",
          text: data.error || "خطا در تغییر وضعیت کد تخفیف.",
        });
        return;
      }

      setDiscounts((prev) =>
        prev.map((d) => (d.id === target.id ? { ...d, is_active: nextState } : d))
      );

      setActionMessage({
        type: "success",
        text: nextState
          ? `کد تخفیف «${target.code}» با موفقیت فعال شد.`
          : `کد تخفیف «${target.code}» با موفقیت غیرفعال شد.`,
      });
    } catch {
      setActionMessage({
        type: "error",
        text: "خطای ارتباط با سرور هنگام تغییر وضعیت کد تخفیف.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (target: DiscountCodeItem) => {
    const confirmDelete = window.confirm(
      `آیا از حذف کامل کد تخفیف «${target.code}» اطمینان دارید؟ این عمل غیرقابل بازگشت است.`
    );
    if (!confirmDelete) return;

    setActionLoadingId(target.id);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/admin/discounts/${target.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionMessage({
          type: "error",
          text: data.error || "خطا در حذف کد تخفیف.",
        });
        return;
      }

      setDiscounts((prev) => prev.filter((d) => d.id !== target.id));
      setActionMessage({
        type: "success",
        text: `کد تخفیف «${target.code}» با موفقیت حذف گردید.`,
      });
    } catch {
      setActionMessage({
        type: "error",
        text: "خطا در ارتباط با سرور هنگام حذف کد تخفیف.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = newCode.trim().toUpperCase();
    if (!cleanCode) {
      alert("لطفاً عبارت کد تخفیف را وارد نمایید.");
      return;
    }

    const percent = parseInt(newPercent, 10);
    if (isNaN(percent) || percent < 1 || percent > 100) {
      alert("درصد تخفیف باید بین ۱ تا ۱۰۰ باشد.");
      return;
    }

    setSubmittingNew(true);
    setActionMessage(null);

    try {
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: cleanCode,
          discountPercent: percent,
          appliesTo: newAppliesTo,
          expiresAt: hasExpiry && newExpiryDate ? new Date(newExpiryDate).toISOString() : null,
          isActive: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionMessage({
          type: "error",
          text: data.error || "خطا در ایجاد کد تخفیف جدید.",
        });
        setSubmittingNew(false);
        return;
      }

      if (data.discount) {
        setDiscounts((prev) => [data.discount, ...prev]);
      } else {
        await fetchDiscounts();
      }

      setActionMessage({
        type: "success",
        text: `کد تخفیف «${cleanCode}» با موفقیت ایجاد و فعال گردید.`,
      });

      // Reset form
      setNewCode("");
      setNewPercent("20");
      setNewAppliesTo("all");
      setHasExpiry(false);
      setNewExpiryDate("");
      setShowAddForm(false);
    } catch {
      setActionMessage({
        type: "error",
        text: "خطا در برقراری ارتباط با سرور هنگام ایجاد کد تخفیف.",
      });
    } finally {
      setSubmittingNew(false);
    }
  };

  const filteredDiscounts = useMemo(() => {
    if (!searchQuery.trim()) return discounts;
    const q = searchQuery.trim().toLowerCase();
    return discounts.filter((d) => d.code.toLowerCase().includes(q));
  }, [discounts, searchQuery]);

  if (!isDiscountsModalOpen || !isAdmin) return null;

  // Stats
  const totalCount = discounts.length;
  const now = new Date();
  const expiredCount = discounts.filter(
    (d) => d.expires_at && new Date(d.expires_at) < now
  ).length;
  const activeCount = discounts.filter(
    (d) => d.is_active && (!d.expires_at || new Date(d.expires_at) >= now)
  ).length;
  const inactiveCount = discounts.filter((d) => !d.is_active).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-ink/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white shadow-2xl border border-line flex flex-col overflow-hidden text-right" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line/70 bg-chalk/70 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <NexSportIcon size={26} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-pitch">مدیریت کدهای تخفیف NexSport</h2>
                <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-black border border-emerald-300">
                  فقط دسترسی مدیر
                </span>
              </div>
              <p className="text-[11px] text-ink/60 mt-0.5">
                ایجاد، فعال‌سازی، غیرفعال‌سازی و تنظیم درصد تخفیف مسابقات و اشتراک‌ها
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeDiscountsModal}
            className="rounded-lg p-1.5 text-ink/40 hover:bg-chalk hover:text-ink transition-colors cursor-pointer"
            title="بستن پنجره"
          >
            ✕
          </button>
        </div>

        {/* Top Summary Stats Strip */}
        <div className="border-b border-line bg-chalk/30 px-5 py-3 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
            {/* Total Codes */}
            <div className="rounded-xl border border-line/80 bg-white p-3 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] text-ink/60 font-semibold">کل کدهای تخفیف</p>
                <p className="text-xl font-black text-pitch mt-0.5">
                  {toPersianDigits(totalCount)}
                  <span className="text-xs font-normal text-ink/50 mr-1">کد</span>
                </p>
              </div>
              <span className="text-2xl opacity-75">🏷️</span>
            </div>

            {/* Active Codes */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] text-emerald-800 font-semibold">کدهای فعال</p>
                <p className="text-xl font-black text-emerald-700 mt-0.5">
                  {toPersianDigits(activeCount)}
                  <span className="text-xs font-normal text-emerald-600 mr-1">کد</span>
                </p>
              </div>
              <span className="text-2xl text-emerald-600">✓</span>
            </div>

            {/* Inactive Codes */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] text-amber-800 font-semibold">غیرفعال‌شده</p>
                <p className="text-xl font-black text-amber-700 mt-0.5">
                  {toPersianDigits(inactiveCount)}
                  <span className="text-xs font-normal text-amber-600 mr-1">کد</span>
                </p>
              </div>
              <span className="text-2xl text-amber-600">⏸</span>
            </div>

            {/* Expired Codes */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] text-rose-800 font-semibold">منقضی‌شده</p>
                <p className="text-xl font-black text-rose-700 mt-0.5">
                  {toPersianDigits(expiredCount)}
                  <span className="text-xs font-normal text-rose-600 mr-1">کد</span>
                </p>
              </div>
              <span className="text-2xl text-rose-600">⏳</span>
            </div>
          </div>
        </div>

        {/* Toolbar: Search, Refresh, and Add Button */}
        <div className="p-4 border-b border-line bg-white flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی کد تخفیف..."
                className="w-full rounded-xl border border-line bg-white px-3.5 py-2 text-xs text-ink focus:border-emerald-600 focus:outline-none placeholder:text-ink/40"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink/40 hover:text-ink cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={fetchDiscounts}
              disabled={loading}
              title="به‌روزرسانی فهرست"
              className="rounded-xl border border-line bg-white hover:bg-chalk px-3 py-2 text-xs font-bold text-ink transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <span className={loading ? "animate-spin" : ""}>🔄</span>
              <span className="hidden sm:inline">بروزرسانی</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
              showAddForm
                ? "bg-slate-200 text-slate-800 hover:bg-slate-300"
                : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-700/20"
            }`}
          >
            <span>{showAddForm ? "✕" : "➕"}</span>
            <span>{showAddForm ? "بستن فرم ایجاد کد" : "تعریف کد تخفیف جدید"}</span>
          </button>
        </div>

        {/* Action feedback banner */}
        {actionMessage && (
          <div
            className={`mx-5 mt-3 p-3 rounded-xl border text-xs font-bold flex items-center justify-between animate-in fade-in ${
              actionMessage.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{actionMessage.type === "success" ? "✓" : "⚠️"}</span>
              <span>{actionMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="text-ink/40 hover:text-ink cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Creation Form (Collapsible) */}
        {showAddForm && (
          <form
            onSubmit={handleCreateCode}
            className="m-5 rounded-2xl border border-emerald-300 bg-emerald-50/40 p-4 space-y-3 shadow-xs shrink-0"
          >
            <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
              <h3 className="font-bold text-xs sm:text-sm text-emerald-950 flex items-center gap-2">
                <span>🏷️</span>
                <span>مشخصات کد تخفیف جدید</span>
              </h3>
              <span className="text-[11px] text-emerald-800">
                کد تخفیف به محض ایجاد فعال خواهد بود
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Code string */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  کد تخفیف (حروف لاتین یا اعداد):
                </label>
                <input
                  type="text"
                  required
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="مثال: OFF50 یا VIP30"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-emerald-600 focus:outline-none uppercase"
                />
              </div>

              {/* Discount Percentage */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  درصد تخفیف (۱ تا ۱۰۰):
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={newPercent}
                    onChange={(e) => setNewPercent(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                  <span className="text-xs font-bold text-slate-600">درصد</span>
                </div>
              </div>

              {/* Applies to */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  اعمال روی کدام بخش:
                </label>
                <select
                  value={newAppliesTo}
                  onChange={(e) => setNewAppliesTo(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-none cursor-pointer"
                >
                  <option value="credits">بسته‌های اعتباری</option>
                  <option value="vip">حساب VIP</option>
                  <option value="link">ایجاد لینک</option>
                  <option value="planning">برنامه‌ریزی (اعتباری و VIP)</option>
                  <option value="all">هر سه مورد</option>
                </select>
              </div>
            </div>

            {/* Expiry Date Setting */}
            <div className="pt-2 border-t border-emerald-200/50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasExpiryCheckbox"
                  checked={hasExpiry}
                  onChange={(e) => setHasExpiry(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="hasExpiryCheckbox" className="text-xs font-bold text-slate-700 cursor-pointer">
                  دارای تاریخ انقضا باشد
                </label>
              </div>

              {hasExpiry && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-semibold">تاریخ پایان اعتبار:</span>
                  <input
                    type="date"
                    required={hasExpiry}
                    value={newExpiryDate}
                    onChange={(e) => setNewExpiryDate(e.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              )}

              <div className="mr-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-emerald-100/60 transition cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submittingNew}
                  className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {submittingNew ? "در حال ایجاد..." : "✓ ثبت و ایجاد کد تخفیف"}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* List of Discounts */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3">
          {loading && discounts.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 rounded-full border-3 border-emerald-600 border-t-transparent animate-spin" />
              <p className="text-xs font-bold text-slate-600">در حال بارگذاری کدهای تخفیف...</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center text-rose-800 space-y-2">
              <p className="font-bold text-xs">{error}</p>
              <button
                type="button"
                onClick={fetchDiscounts}
                className="rounded-lg bg-rose-600 text-white font-bold px-3 py-1.5 text-xs hover:bg-rose-700 cursor-pointer"
              >
                تلاش مجدد
              </button>
            </div>
          ) : filteredDiscounts.length === 0 ? (
            <div className="py-12 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center space-y-2">
              <span className="text-3xl">🏷️</span>
              <p className="font-bold text-xs text-slate-700">
                {searchQuery ? "کد تخفیفی با این عنوان یافت نشد." : "هیچ کد تخفیفی تاکنون ایجاد نشده است."}
              </p>
              <p className="text-[11px] text-slate-500">
                برای تعریف اولین کد تخفیف، روی دکمه «تعریف کد تخفیف جدید» در بالای صفحه کلیک فرمایید.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredDiscounts.map((item) => {
                const isItemExpired = Boolean(
                  item.expires_at && new Date(item.expires_at) < now
                );
                const isLoading = actionLoadingId === item.id;

                let appliesLabel = "هر سه مورد";
                if (item.applies_to === "credits") appliesLabel = "بسته‌های اعتباری";
                if (item.applies_to === "vip") appliesLabel = "حساب VIP";
                if (item.applies_to === "link") appliesLabel = "ایجاد لینک";
                if (item.applies_to === "planning") appliesLabel = "برنامه‌ریزی (اعتباری و VIP)";

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-3.5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      !item.is_active
                        ? "bg-slate-50/70 border-slate-200 opacity-80"
                        : isItemExpired
                        ? "bg-rose-50/40 border-rose-200"
                        : "bg-white border-slate-200 hover:border-emerald-300 hover:shadow-2xs"
                    }`}
                  >
                    {/* Left: Code info */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-black text-sm sm:text-base text-slate-900 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded-lg select-all">
                          {item.code}
                        </span>

                        <span className="bg-emerald-100 text-emerald-800 font-black text-xs px-2 py-0.5 rounded-md border border-emerald-300">
                          {toPersianDigits(item.discount_percent)}٪ تخفیف
                        </span>

                        {/* Status Badge */}
                        {isItemExpired ? (
                          <span className="bg-rose-100 text-rose-800 font-bold text-[10px] px-2 py-0.5 rounded-full border border-rose-300 flex items-center gap-1">
                            <span>⏳</span>
                            <span>منقضی شده</span>
                          </span>
                        ) : item.is_active ? (
                          <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                            <span>●</span>
                            <span>فعال</span>
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 font-bold text-[10px] px-2 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                            <span>⏸</span>
                            <span>غیرفعال</span>
                          </span>
                        )}

                        <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {appliesLabel}
                        </span>
                      </div>

                      {/* Expiry and details */}
                      <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-3">
                        <span>
                          تاریخ انقضا:{" "}
                          <strong className={isItemExpired ? "text-rose-700" : "text-slate-800"}>
                            {item.expires_at
                              ? new Date(item.expires_at).toLocaleDateString("fa-IR")
                              : "نامحدود (بدون انقضا)"}
                          </strong>
                        </span>

                        <span>•</span>

                        <span>
                          تاریخ ایجاد:{" "}
                          {new Date(item.created_at).toLocaleDateString("fa-IR")}
                        </span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      {/* Single Toggle Button: Red when active ("غیرفعال‌سازی"), Green when inactive ("فعال‌سازی") */}
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleToggleActive(item)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50 ${
                          item.is_active
                            ? "bg-rose-600 text-white hover:bg-rose-700 shadow-rose-700/20"
                            : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-700/20"
                        }`}
                        title={item.is_active ? "غیرفعال‌سازی کد تخفیف" : "فعال‌سازی کد تخفیف"}
                      >
                        {isLoading ? (
                          <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        ) : item.is_active ? (
                          <>
                            <span>⏹</span>
                            <span>غیرفعال‌سازی</span>
                          </>
                        ) : (
                          <>
                            <span>▶</span>
                            <span>فعال‌سازی</span>
                          </>
                        )}
                      </button>

                      {/* Delete button */}
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleDelete(item)}
                        className="rounded-xl border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                        title="حذف دائمی کد تخفیف"
                      >
                        <span>🗑️</span>
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-line bg-chalk/50 px-5 py-3 shrink-0 flex items-center justify-between">
          <p className="text-[11px] text-ink/50">
            سامانه تخفیفات پیشرفته NexSport — مدیریت درگاه و کمپین‌های تبلیغاتی
          </p>
          <button
            type="button"
            onClick={closeDiscountsModal}
            className="rounded-xl border border-line bg-white hover:bg-chalk px-4 py-1.5 text-xs font-bold text-ink transition-colors cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
}
