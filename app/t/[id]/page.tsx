import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { PublicTournamentViewer, PublicTournamentData } from "@/components/public/PublicTournamentViewer";
import { NexSportIcon } from "@/components/NexSportLogo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}): Promise<Metadata> {
  const resolved = await Promise.resolve(params);
  const id = resolved.id;
  const t = await db.getPublicTournament(id);

  const title = t?.title
    ? `${t.title} | برنامه و نتایج مسابقات | NexSport`
    : "مشاهده مسابقات ورزشی | NexSport";

  return {
    title,
    description: "مشاهده برنامه مسابقات، جدول رده‌بندی زنده و مراحل حذفی در سامانه ورزشی NexSport.",
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
        "max-video-preview": -1,
        "max-image-preview": "none",
        "max-snippet": -1,
      },
    },
  };
}

export default async function PublicTournamentPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const resolved = await Promise.resolve(params);
  const id = resolved.id;

  const tournamentRecord = await db.getPublicTournament(id);

  if (!tournamentRecord) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 text-center space-y-4 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 text-2xl">
            🔍
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-black text-slate-900">
              مسابقه یافت نشد
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              این مسابقه وجود ندارد یا ممکن است توسط برگزارکننده آن حذف شده باشد.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            <Link
              href="/"
              className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              صفحه اصلی
            </Link>
            <Link
              href="/planner"
              className="w-full sm:w-auto rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-black transition-colors"
            >
              برنامه‌ریزی مسابقه جدید
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const publicData: PublicTournamentData = {
    id: tournamentRecord.id,
    title: tournamentRecord.title,
    format: tournamentRecord.format,
    sport: tournamentRecord.sport,
    teamCount: tournamentRecord.team_count,
    state: tournamentRecord.state,
    createdAt: tournamentRecord.created_at,
    updatedAt: tournamentRecord.updated_at,
  };

  return <PublicTournamentViewer initialTournament={publicData} />;
}
