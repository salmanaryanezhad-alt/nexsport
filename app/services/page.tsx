"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CommunityChrome } from "@/components/community/CommunityChrome";
import { SERVICE_CATEGORIES, serviceCategoryLabel } from "@/lib/community/catalog";
import { useAuth } from "@/components/auth/AuthContext";

export default function ServicesPage() {
  const { user, openAuthModal } = useAuth();
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (category) params.set("category", category);
      fetch(`/api/services/?${params.toString()}`, { credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setListings(Array.isArray(d?.listings) ? d.listings : []))
        .catch(() => setListings([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q, category]);

  return (
    <CommunityChrome subtitle="خدمات NexSport">
      <div className="space-y-5">
        <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 sm:p-6 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-black">خدمات ورزشی</h1>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed max-w-2xl">
                تبلیغ مسابقات، معرفی باشگاه، آموزش، مربی و متخصص، مشاور و خدمات مرتبط با ورزشکاران و برگزارکنندگان.
              </p>
            </div>
            <button
              type="button"
              onClick={() => (user ? (window.location.href = "/services/new") : openAuthModal("login"))}
              className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-black text-white hover:bg-amber-700 cursor-pointer"
            >
              ثبت آگهی جدید
            </button>
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جست‌وجو در خدمات…"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => setCategory("")}
            className={`rounded-2xl border p-4 text-right cursor-pointer ${!category ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white hover:border-amber-200"}`}
          >
            <div className="font-black text-sm">همه دسته‌ها</div>
            <p className="text-[11px] text-slate-500 mt-1">نمایش تمام آگهی‌های فعال</p>
          </button>
          {SERVICE_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`rounded-2xl border p-4 text-right cursor-pointer ${category === c.id ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white hover:border-amber-200"}`}
            >
              <div className="font-black text-sm">
                {c.icon} {c.label}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">{c.desc}</p>
            </button>
          ))}
        </div>

        {loading && <p className="text-sm font-bold text-slate-500">در حال بارگذاری…</p>}
        {!loading && listings.length === 0 && <p className="text-sm text-slate-500">هنوز آگهی‌ای در این دسته ثبت نشده است.</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          {listings.map((s) => (
            <Link key={s.id} href={`/services/${s.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-amber-300 space-y-1">
              <p className="text-[11px] font-black text-amber-700">{serviceCategoryLabel(s.category)}</p>
              <div className="font-black">{s.title}</div>
              <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">{s.body}</p>
              <p className="text-[11px] text-slate-400">
                {[s.city, s.sport, s.owner_name].filter(Boolean).join(" • ")}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </CommunityChrome>
  );
}
