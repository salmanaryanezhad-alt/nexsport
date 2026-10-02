"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CommunityChrome } from "@/components/community/CommunityChrome";
import { SERVICE_CATEGORIES } from "@/lib/community/catalog";
import { TEAM_SPORTS } from "@/lib/teams/catalog";
import { useAuth } from "@/components/auth/AuthContext";

export default function NewServicePage() {
  const { user, loading, openAuthModal } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    category: "tournament_ad",
    title: "",
    body: "",
    city: "",
    sport: "فوتبال",
    contact_name: "",
    mobile: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (loading) {
    return (
      <CommunityChrome subtitle="ثبت خدمت">
        <p className="text-sm text-slate-500">در حال بررسی حساب…</p>
      </CommunityChrome>
    );
  }

  if (!user) {
    return (
      <CommunityChrome subtitle="ثبت خدمت">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center space-y-3">
          <p className="font-black">برای ثبت آگهی وارد شوید</p>
          <button type="button" onClick={() => openAuthModal("login")} className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-black text-white cursor-pointer">
            ورود / ثبت‌نام
          </button>
        </div>
      </CommunityChrome>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/services/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "ثبت ناموفق بود.");
        return;
      }
      router.push(
        data.needsSlotPayment
          ? `/services/${data.listing.id}?slot=1`
          : `/services/${data.listing.id}`
      );
    } catch {
      setError("خطا در ارتباط با سرور.");
    } finally {
      setSaving(false);
    }
  }

  const input = "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium focus:border-amber-500 focus:outline-none";

  return (
    <CommunityChrome subtitle="ثبت آگهی خدمت">
      <form onSubmit={submit} className="max-w-xl rounded-3xl border border-slate-200 bg-white p-6 space-y-3 shadow-card">
        <h1 className="text-xl font-black">ثبت آگهی در خدمات NexSport</h1>
        <p className="text-xs text-slate-600 leading-relaxed">اولین آگهی فعال هر حساب رایگان است. آگهی‌های هم‌زمان اضافه بعد از ثبت با پرداخت فعال می‌شوند.</p>
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">{error}</div>}
        <label className="block text-xs font-bold">
          دسته
          <select className={input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {SERVICE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-bold">
          عنوان
          <input className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </label>
        <label className="block text-xs font-bold">
          توضیحات
          <textarea className={`${input} min-h-[120px]`} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-bold">
            شهر
            <input className={input} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </label>
          <label className="block text-xs font-bold">
            رشته
            <select className={input} value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })}>
              {TEAM_SPORTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-bold">
            نام رابط
            <input className={input} value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
          </label>
          <label className="block text-xs font-bold">
            موبایل تماس
            <input className={input} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} dir="ltr" />
          </label>
        </div>
        <button type="submit" disabled={saving} className="rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-black text-white hover:bg-amber-700 disabled:opacity-50 cursor-pointer">
          {saving ? "در حال ثبت…" : "انتشار آگهی"}
        </button>
      </form>
    </CommunityChrome>
  );
}
