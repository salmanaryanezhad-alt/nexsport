"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { toPersianDigits } from "@/lib/digits";
import {
  CLUB_PAGE_CREDIT_COST,
  CLUB_PAGE_PRICE_TOMANS,
  DEFAULT_PRICING_SETTINGS,
} from "@/lib/payment/pricing";

export function ClubPagePaywall({
  clubId,
  pagePaid,
  onActivated,
}: {
  clubId: string;
  pagePaid: boolean;
  onActivated?: () => void;
}) {
  const { user, isAdmin, openAuthModal } = useAuth();
  const [quota, setQuota] = useState<{
    planningCredits?: number;
    isClubPro?: boolean;
    unlimitedPlanning?: boolean;
  } | null>(null);
  const [price, setPrice] = useState(CLUB_PAGE_PRICE_TOMANS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discountCode, setDiscountCode] = useState("");
  const [paid, setPaid] = useState(pagePaid);

  useEffect(() => {
    setPaid(pagePaid);
  }, [pagePaid]);

  useEffect(() => {
    fetch("/api/tournaments/quota/", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setQuota(d))
      .catch(() => {});
    fetch("/api/pricing/", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.settings?.clubPagePriceTomans != null) setPrice(d.settings.clubPagePriceTomans);
      })
      .catch(() => {});
  }, []);

  if (paid) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-900">
        صفحه عمومی باشگاه فعال است. لینک را می‌توانید با دیگران به اشتراک بگذارید.
      </div>
    );
  }

  const adminFree = Boolean(isAdmin || quota?.unlimitedPlanning);
  const clubProFree = Boolean(quota?.isClubPro);
  const credits = quota?.planningCredits ?? 0;
  const canCredits = credits >= CLUB_PAGE_CREDIT_COST;

  async function pay(withCredits: boolean) {
    if (!user) {
      openAuthModal("login");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payment/create/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType: "club_page",
          clubId,
          payWithCredits: withCredits,
          discountCode: discountCode.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "خطا در فعال‌سازی صفحه باشگاه.");
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }
      setPaid(true);
      onActivated?.();
    } catch (e: any) {
      setError(e?.message || "خطا در فعال‌سازی.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 space-y-3">
      <div>
        <h3 className="font-black text-sm text-sky-950">فعال‌سازی صفحه عمومی باشگاه</h3>
        <p className="text-[11px] text-sky-900 mt-1 leading-relaxed">
          ایجاد باشگاه رایگان است. برای اینکه صفحه <span className="font-mono dir-ltr">/c/{clubId}</span> برای عموم
          دیده شود، باید آن را فعال کنید — مثل لینک تماشاگر. لینک ثبت‌نام مسابقه رایگان است. دعوت‌شوندگان هزینه‌ای نمی‌پردازند. اشتراک VIP
          برگزارکننده روی باشگاه اعمال نمی‌شود.
        </p>
      </div>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">{error}</div>}
      {adminFree || clubProFree ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => pay(false)}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
        >
          {loading ? "در حال فعال‌سازی…" : clubProFree && !adminFree ? "فعال‌سازی رایگان با Club Pro" : "فعال‌سازی رایگان (حساب مدیر)"}
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-black text-slate-800">
            تعرفه: {toPersianDigits((price || DEFAULT_PRICING_SETTINGS.clubPagePriceTomans).toLocaleString("en-US"))} تومان
            {" "}یا {toPersianDigits(CLUB_PAGE_CREDIT_COST)} سهمیه برنامه‌سازی
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono flex-1 min-w-[140px]"
              placeholder="کد تخفیف (اختیاری)"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => pay(false)}
              className="rounded-xl bg-sky-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
            >
              {loading ? "در حال پرداخت…" : "پرداخت و فعال‌سازی"}
            </button>
            <button
              type="button"
              disabled={loading || !canCredits}
              onClick={() => pay(true)}
              className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-black text-emerald-800 disabled:opacity-40"
              title={!canCredits ? "سهمیه کافی نیست" : ""}
            >
              پرداخت با {toPersianDigits(CLUB_PAGE_CREDIT_COST)} اعتبار
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            موجودی اعتبار: {toPersianDigits(credits)} — برای باشگاه نامحدود و فعال‌سازی رایگان، Club Pro را از فروشگاه بخرید.
          </p>
        </div>
      )}
    </div>
  );
}
