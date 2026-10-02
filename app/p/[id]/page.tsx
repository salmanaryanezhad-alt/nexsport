"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CommunityChrome } from "@/components/community/CommunityChrome";
import { toPersianDigits } from "@/lib/digits";
import { playerStatusLabel } from "@/lib/teams/catalog";
import { formatDateJalali, parseGregorianYmd } from "@/lib/jalali";

function birthLabel(ymd?: string) {
  if (!ymd) return "—";
  const d = parseGregorianYmd(ymd);
  return d ? formatDateJalali(d) : ymd;
}

export default function PublicPlayerPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/community/players/${id}/`, { credentials: "same-origin" })
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(json.error || "بازیکن یافت نشد.");
        setData(json);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  return (
    <CommunityChrome subtitle={data?.player?.name || "صفحه بازیکن"}>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-800">{error}</div>}
      {!data && !error && <p className="text-sm font-bold text-slate-500">در حال بارگذاری بازیکن…</p>}
      {data?.player && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card space-y-4 max-w-xl">
          <h1 className="text-2xl font-black">{data.player.name}</h1>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[11px] font-bold text-slate-500">تیم</dt>
              <dd className="font-black">
                {data.team ? <Link href={`/tm/${data.team.id}`} className="text-emerald-800">{data.team.name}</Link> : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold text-slate-500">شماره</dt>
              <dd className="font-black">{data.player.jersey_number ? toPersianDigits(data.player.jersey_number) : "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold text-slate-500">پست</dt>
              <dd className="font-black">{data.player.position || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold text-slate-500">وضعیت</dt>
              <dd className="font-black">{playerStatusLabel(data.player.status)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold text-slate-500">تاریخ تولد</dt>
              <dd className="font-black">{birthLabel(data.player.birth_date)}</dd>
            </div>
          </dl>
          <p className="text-[11px] text-slate-400">شماره تماس و کد ملی در صفحه عمومی نمایش داده نمی‌شود.</p>
        </div>
      )}
    </CommunityChrome>
  );
}
