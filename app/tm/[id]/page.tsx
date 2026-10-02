"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CommunityChrome } from "@/components/community/CommunityChrome";
import { toPersianDigits } from "@/lib/digits";
import { playerStatusLabel } from "@/lib/teams/catalog";
import { tournamentFormatLabel } from "@/lib/community/catalog";

export default function PublicTeamPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/community/teams/${id}/`, { credentials: "same-origin" })
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(json.error || "تیم یافت نشد.");
        setData(json);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  return (
    <CommunityChrome subtitle={data?.team?.name || "صفحه تیم"}>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-800">{error}</div>}
      {!data && !error && <p className="text-sm font-bold text-slate-500">در حال بارگذاری تیم…</p>}
      {data?.team && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card space-y-2">
            <p className="text-[11px] font-black text-emerald-700">{data.team.sport}</p>
            <h1 className="text-2xl sm:text-3xl font-black">{data.team.name}</h1>
            <p className="text-sm text-slate-500">
              {data.team.city || "—"}
              {data.team.founded_year ? ` • تأسیس ${toPersianDigits(data.team.founded_year)}` : ""}
              {data.team.coach ? ` • مربی: ${data.team.coach}` : ""}
            </p>
            {(data.team.kit_home || data.team.kit_away) && (
              <p className="text-xs text-slate-500">
                {data.team.kit_home ? `لباس میزبان: ${data.team.kit_home}` : ""}
                {data.team.kit_away ? ` • لباس مهمان: ${data.team.kit_away}` : ""}
              </p>
            )}
            {data.team.description && <p className="text-sm text-slate-700 leading-relaxed">{data.team.description}</p>}
          </div>

          {data.clubs?.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-black">باشگاه</h2>
              <div className="flex flex-wrap gap-2">
                {data.clubs.map((c: any) => (
                  <Link key={c.id} href={`/c/${c.id}`} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">
                    {c.name}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="font-black">بازیکنان ({toPersianDigits(data.players?.length || 0)})</h2>
            {(!data.players || data.players.length === 0) && <p className="text-sm text-slate-500">بازیکنی منتشر نشده است.</p>}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              {data.players?.length > 0 && (
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      {["بازیکن", "شماره", "پست", "وضعیت"].map((h) => (
                        <th key={h} className="px-3 py-2 text-right font-black">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.players.map((p: any) => (
                      <tr key={p.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-black">
                          <Link href={`/p/${p.id}`} className="hover:text-emerald-800">{p.name}</Link>
                        </td>
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

          {data.tournaments?.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-black">مسابقات مرتبط</h2>
              {data.tournaments.map((t: any) => (
                <Link key={t.id} href={`/t/${t.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 hover:border-sky-300">
                  <div className="font-black">{t.title}</div>
                  <p className="text-[11px] text-slate-500">{tournamentFormatLabel(t.format)} • {toPersianDigits(t.team_count)} تیم</p>
                </Link>
              ))}
            </section>
          )}
        </div>
      )}
    </CommunityChrome>
  );
}
