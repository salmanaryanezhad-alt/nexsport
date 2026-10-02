"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ClubChrome } from "@/components/clubs/ClubChrome";
import { useAuth } from "@/components/auth/AuthContext";
import { toPersianDigits } from "@/lib/digits";
import { playerStatusLabel } from "@/lib/teams/catalog";
import { ClubPagePaywall } from "@/components/clubs/ClubPagePaywall";

export default function PublicClubPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/clubs/${id}/`, { credentials: "same-origin" })
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(json.error || "باشگاه یافت نشد.");
        setData(json);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  return (
    <ClubChrome subtitle={data?.club?.name || "صفحه باشگاه"}>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-800">{error}</div>}
      {!data && !error && <p className="text-sm font-bold text-slate-500">در حال بارگذاری باشگاه…</p>}
      {data?.locked && data?.club && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card space-y-3">
          <p className="text-[11px] font-black text-emerald-700">{data.club.sport}</p>
          <h1 className="text-2xl font-black">{data.club.name}</h1>
          <p className="text-sm text-slate-500">{data.club.city || "—"}</p>
          <p className="text-sm text-slate-600 leading-relaxed">
            صفحه عمومی این باشگاه هنوز فعال نشده است. تیم‌ها، بازیکنان و مسابقات پس از فعال‌سازی برای عموم دیده می‌شود.
          </p>
          {data.canEdit ? (
            <ClubPagePaywall clubId={id} pagePaid={false} onActivated={() => window.location.reload()} />
          ) : (
            <p className="text-xs text-slate-400">اگر مدیر باشگاه هستید وارد شوید و صفحه را فعال کنید.</p>
          )}
        </div>
      )}
      {data?.club && !data.locked && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black text-emerald-700">{data.club.sport}</p>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{data.club.name}</h1>
                <p className="text-sm text-slate-500 mt-1">
                  {data.club.city || "—"}
                  {data.club.founded_year ? ` • تأسیس ${toPersianDigits(data.club.founded_year)}` : ""}
                  {data.club.venue ? ` • ${data.club.venue}` : ""}
                </p>
              </div>
              {data.canEdit && (
                <Link href={`/c/${id}/manage`} className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white">
                  مدیریت باشگاه
                </Link>
              )}
            </div>
            {data.club.description && <p className="text-sm text-slate-700 leading-relaxed">{data.club.description}</p>}
            {data.club.contact_name && <p className="text-xs text-slate-500">رابط: {data.club.contact_name}</p>}
          </div>

          <section className="space-y-2">
            <h2 className="font-black">تیم‌های باشگاه ({toPersianDigits(data.teams?.length || 0)})</h2>
            {(!data.teams || data.teams.length === 0) && <p className="text-sm text-slate-500">هنوز تیمی متصل نشده است.</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {(data.teams || []).map((t: any) => (
                <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="font-black">{t.name}</div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {t.sport} {t.city ? `• ${t.city}` : ""} • {toPersianDigits(t.player_count || 0)} بازیکن
                    {t.coach ? ` • مربی: ${t.coach}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="font-black">بازیکنان</h2>
            {(!data.players || data.players.length === 0) && <p className="text-sm text-slate-500">بازیکنی ثبت نشده است.</p>}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              {(data.players || []).length > 0 && (
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      {["بازیکن", "تیم", "شماره", "پست", "وضعیت"].map((h) => (
                        <th key={h} className="px-3 py-2 text-right font-black">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.players.map((p: any) => (
                      <tr key={p.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-black">{p.name}</td>
                        <td className="px-3 py-2">{p.team_name}</td>
                        <td className="px-3 py-2">{p.jersey_number ? toPersianDigits(p.jersey_number) : "—"}</td>
                        <td className="px-3 py-2">{p.position || "—"}</td>
                        <td className="px-3 py-2">{playerStatusLabel(p.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="font-black">مربیان</h2>
            {(!data.coaches || data.coaches.length === 0) && <p className="text-sm text-slate-500">مربی ثبت نشده است.</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {(data.coaches || []).map((c: any) => (
                <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="font-black">{c.name}</div>
                  <p className="text-[11px] text-slate-500">{c.title}{c.notes ? ` • ${c.notes}` : ""}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="font-black">مسابقات باشگاه</h2>
            {(!data.tournaments || data.tournaments.length === 0) && <p className="text-sm text-slate-500">مسابقه‌ای متصل نشده است.</p>}
            <div className="space-y-2">
              {(data.tournaments || []).map((t: any) => (
                <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-black">{t.title}</div>
                    <p className="text-[11px] text-slate-500">{t.formatLabel} • {toPersianDigits(t.teamCount)} تیم</p>
                  </div>
                  {t.spectatorPaid ? (
                    <Link href={`/t/${t.id}`} className="rounded-xl bg-sky-700 px-3 py-1.5 text-xs font-black text-white">مشاهده جدول</Link>
                  ) : (
                    <span className="text-[11px] font-bold text-slate-400">لینک تماشاگر فعال نیست</span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {!user && (
            <p className="text-xs text-slate-400">برای عضویت در باشگاه باید حساب کاربری داشته باشید و از طرف مدیر دعوت شوید.</p>
          )}
        </div>
      )}
    </ClubChrome>
  );
}
