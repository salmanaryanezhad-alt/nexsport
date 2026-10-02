"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { toPersianDigits } from "@/lib/digits";
import { formatDateJalali } from "@/lib/jalali";

export function CommunityPayBox({
  itemType,
  targetId,
  title,
  hint,
  priceKey,
  creditKey,
  onDone,
}: {
  itemType: "team_pin" | "listing_pin" | "tournament_boost" | "extra_listing";
  targetId: string;
  title: string;
  hint: string;
  priceKey: "teamPinPriceTomans" | "listingPinPriceTomans" | "tournamentBoostPriceTomans" | "extraListingPriceTomans";
  creditKey: "teamPinCreditCost" | "listingPinCreditCost" | "tournamentBoostCreditCost" | "extraListingCreditCost";
  onDone?: () => void;
}) {
  const { user, isAdmin, openAuthModal } = useAuth();
  const [price, setPrice] = useState(0);
  const [creditsNeed, setCreditsNeed] = useState(1);
  const [creditsHave, setCreditsHave] = useState(0);
  const [featuredUntil, setFeaturedUntil] = useState<string | null>(null);
  const [discountCode, setDiscountCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const kind = itemType === "extra_listing" ? "listing_pin" : itemType;

  function load() {
    fetch("/api/pricing/", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.settings) {
          setPrice(Number(d.settings[priceKey]) || 0);
          setCreditsNeed(Number(d.settings[creditKey]) || 1);
        }
      })
      .catch(() => {});
    fetch("/api/tournaments/quota/", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCreditsHave(Number(d.planningCredits || 0)))
      .catch(() => {});
    if (itemType !== "extra_listing") {
      fetch(`/api/community/promo/?kind=${kind}&targetId=${encodeURIComponent(targetId)}`, {
        credentials: "same-origin",
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setFeaturedUntil(d?.featuredUntil || null))
        .catch(() => {});
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, itemType]);

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
          itemType,
          targetId,
          payWithCredits: withCredits,
          discountCode: discountCode.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "پرداخت ناموفق بود.");
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }
      setDone(true);
      load();
      onDone?.();
    } catch (e: any) {
      setError(e?.message || "خطا در پرداخت.");
    } finally {
      setLoading(false);
    }
  }

  const canCredits = creditsHave >= creditsNeed;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-2">
      <h3 className="font-black text-sm text-amber-950">{title}</h3>
      <p className="text-[11px] text-amber-900 leading-relaxed">{hint}</p>
      {featuredUntil && (
        <p className="text-[11px] font-bold text-emerald-800">
          ویژه تا {formatDateJalali(new Date(featuredUntil))}
        </p>
      )}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">{error}</div>}
      {done && itemType === "extra_listing" && (
        <p className="text-xs font-black text-emerald-800">آگهی فعال شد.</p>
      )}
      <p className="text-xs font-black text-slate-800">
        تعرفه: {toPersianDigits(price.toLocaleString("en-US"))} تومان یا {toPersianDigits(creditsNeed)} سهمیه
        {isAdmin ? " — حساب مدیر رایگان است" : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono flex-1 min-w-[120px]"
          placeholder="کد تخفیف"
          value={discountCode}
          onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => pay(false)}
          className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50 cursor-pointer"
        >
          {loading ? "…" : "پرداخت"}
        </button>
        <button
          type="button"
          disabled={loading || !canCredits}
          onClick={() => pay(true)}
          className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-black text-emerald-800 disabled:opacity-40 cursor-pointer"
        >
          با {toPersianDigits(creditsNeed)} اعتبار
        </button>
      </div>
    </div>
  );
}
