"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CommunityChrome } from "@/components/community/CommunityChrome";
import { toPersianDigits } from "@/lib/digits";
import { tournamentFormatLabel } from "@/lib/community/catalog";
import { serviceCategoryLabel } from "@/lib/community/catalog";
import { playerStatusLabel } from "@/lib/teams/catalog";

const TABS = [
  { id: "all", label: "همه" },
  { id: "tournaments", label: "مسابقات" },
  { id: "teams", label: "تیم‌ها" },
  { id: "clubs", label: "باشگاه‌ها" },
  { id: "players", label: "بازیکنان" },
  { id: "services", label: "خدمات" },
] as const;

export default function ExplorePage() {
  const [q, setQ] = useState("");
  const [type, setType] = useState<(typeof TABS)[number]["id"]>("all");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/community/search/?q=${encodeURIComponent(q)}&type=${type}`, { credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setData(d))
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, type]);

  const empty =
    data &&
    !(data.tournaments?.length || data.teams?.length || data.clubs?.length || data.players?.length || data.services?.length);

  return (
    <CommunityChrome subtitle="جست‌وجوی جامعه ورزشی">
      <div className="space-y-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card space-y-3">
          <h1 className="text-xl sm:text-2xl font-black">جامعه ورزشی NexSport</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            مسابقات با لینک تماشاگر فعال، تیم‌ها و بازیکنان منتشرشده، باشگاه‌های با صفحه عمومی، و خدمات ورزشی را پیدا کنید.
          </p>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جست‌وجوی نام مسابقه، تیم، باشگاه، بازیکن یا خدمت…"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium focus:border-emerald-500 focus:outline-none"
          />
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setType(tab.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-black cursor-pointer ${
                  type === tab.id ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading && <p className="text-sm font-bold text-slate-500">در حال جست‌وجو…</p>}
        {empty && !loading && <p className="text-sm text-slate-500">موردی مطابق جست‌وجو پیدا نشد.</p>}

        {data?.tournaments?.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-black">مسابقات</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.tournaments.map((t: any) => (
                <Link key={t.id} href={`/t/${t.id}`} className={`rounded-2xl border bg-white p-4 hover:border-emerald-300 ${t.featuredUntil ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200"}`}>
                  <div className="flex items-center gap-2">
                    <div className="font-black">{t.title}</div>
                    {t.featuredUntil && <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-black">ویژه</span>}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {tournamentFormatLabel(t.format)} • {toPersianDigits(t.team_count)} تیم
                    {t.sport ? ` • ${t.sport}` : ""}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {data?.clubs?.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-black">باشگاه‌ها</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.clubs.map((c: any) => (
                <Link key={c.id} href={`/c/${c.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-emerald-300">
                  <p className="text-[11px] font-black text-emerald-700">{c.sport}</p>
                  <div className="font-black">{c.name}</div>
                  <p className="text-[11px] text-slate-500 mt-1">{c.city || "—"}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {data?.teams?.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-black">تیم‌ها</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.teams.map((t: any) => (
                <Link key={t.id} href={`/tm/${t.id}`} className={`rounded-2xl border bg-white p-4 hover:border-emerald-300 ${t.featuredUntil ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200"}`}>
                  <p className="text-[11px] font-black text-emerald-700">{t.sport}</p>
                  <div className="flex items-center gap-2">
                    <div className="font-black">{t.name}</div>
                    {t.featuredUntil && <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-black">ویژه</span>}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {t.city || "—"} • {toPersianDigits(t.player_count || 0)} بازیکن
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {data?.players?.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-black">بازیکنان</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.players.map((p: any) => (
                <Link key={p.id} href={`/p/${p.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-emerald-300">
                  <div className="font-black">{p.name}</div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {p.team_name || "تیم"} {p.jersey_number ? `• شماره ${toPersianDigits(p.jersey_number)}` : ""} • {playerStatusLabel(p.status)}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {data?.services?.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-black">خدمات</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.services.map((s: any) => (
                <Link key={s.id} href={`/services/${s.id}`} className={`rounded-2xl border bg-white p-4 hover:border-amber-300 ${s.featuredUntil ? "border-amber-400 ring-1 ring-amber-200" : "border-slate-200"}`}>
                  <p className="text-[11px] font-black text-amber-700">
                    {serviceCategoryLabel(s.category)}
                    {s.featuredUntil ? " • ویژه" : ""}
                  </p>
                  <div className="font-black">{s.title}</div>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{s.body}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </CommunityChrome>
  );
}
