"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ScheduleResult, MatchScheduleDetail } from "@/lib/scheduling/types";
import { MatchScore } from "@/lib/scheduling/knockout";
import { ScheduleView } from "@/components/planner/ScheduleView";
import { NexSportIcon } from "@/components/NexSportLogo";
import { toPersianDigits } from "@/lib/digits";
import { ShareTournamentModal } from "@/components/planner/ShareTournamentModal";

export interface PublicTournamentData {
  id: string;
  title: string;
  format: string;
  sport?: string | null;
  teamCount: number;
  state: {
    result: ScheduleResult;
    scores?: Record<string, MatchScore>;
    matchDetails?: Record<string, MatchScheduleDetail>;
    teamNames?: string[];
    qualifiersPerGroup?: number;
    metadata?: {
      title?: string;
      venue?: string;
      date?: string;
      notes?: string;
    };
    pointsRule?: any;
    format?: string;
  };
  createdAt: string | Date;
  updatedAt: string | Date;
}

const FORMAT_TITLES: Record<string, string> = {
  knockout: "حذفی تک‌مرحله‌ای (Single Elimination)",
  "double-knockout": "دو حذفی (Double Elimination)",
  league: "لیگ دوره‌ای (تک‌بازی)",
  "double-league": "لیگ رفت‌وبرگشت",
  groups: "مرحله گروهی اختصاصی",
  "groups-knockout": "جام گروهی + مرحله حذفی",
};

export function PublicTournamentViewer({
  initialTournament,
}: {
  initialTournament: PublicTournamentData;
}) {
  const [tournament, setTournament] = useState<PublicTournamentData>(initialTournament);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const state = tournament.state || {};
  const result = state.result;
  const scores = state.scores || {};
  const matchDetails = state.matchDetails || {};
  const teamNames = state.teamNames || [];
  const qualifiersPerGroup = state.qualifiersPerGroup || 2;
  const metadata = state.metadata || {};

  // Check overall tournament progress
  let totalMatches = 0;
  let playedMatches = 0;

  if (result?.format === "league" || result?.format === "double-league") {
    for (const r of result.rounds || []) {
      for (const m of r.matches || []) {
        totalMatches++;
        if (m.id && scores[m.id] && scores[m.id].home !== null && scores[m.id].away !== null) {
          playedMatches++;
        }
      }
    }
  } else if (result?.format === "groups" || result?.format === "groups-knockout") {
    for (const g of result.groups || []) {
      for (const r of g.rounds || []) {
        for (const m of r.matches || []) {
          totalMatches++;
          if (m.id && scores[m.id] && scores[m.id].home !== null && scores[m.id].away !== null) {
            playedMatches++;
          }
        }
      }
    }
  }

  const isCompleted = totalMatches > 0 && playedMatches === totalMatches;

  // Refresh handler
  async function handleRefresh() {
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      const res = await fetch(`/api/tournaments/public/${tournament.id}?_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.tournament) {
          setTournament(data.tournament);
          setRefreshMessage("✓ آخرین نتایج با موفقیت به‌روزرسانی شدند.");
          setTimeout(() => setRefreshMessage(null), 3000);
        }
      } else {
        setRefreshMessage("خطا در به‌روزرسانی اطلاعات.");
        setTimeout(() => setRefreshMessage(null), 3000);
      }
    } catch {
      setRefreshMessage("عدم دسترسی به شبکه.");
      setTimeout(() => setRefreshMessage(null), 3000);
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleOpenPrint() {
    window.dispatchEvent(new CustomEvent("nexsport-open-print"));
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-200">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 group cursor-pointer"
            title="سامانه هوشمند مسابقات ورزشی NexSport"
          >
            <NexSportIcon size={32} />
            <div className="flex flex-col">
              <span className="font-black text-base text-slate-900 tracking-tight flex items-center gap-1">
                <span>NexSport</span>
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full border border-emerald-300">
                  تماشاگران
                </span>
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                سامانه آنلاین برنامه‌ریزی و نتایج مسابقات
              </span>
            </div>
          </Link>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
              title="بارگذاری مجدد آخرین نتایج ثبت‌شده"
            >
              <span className={isRefreshing ? "animate-spin" : ""}>🔄</span>
              <span className="hidden sm:inline">به‌روزرسانی نتایج</span>
            </button>

            <button
              type="button"
              onClick={() => setShareModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800 hover:bg-emerald-100 transition-all cursor-pointer shadow-2xs"
              title="اشتراک‌گذاری لینک اختصاصی این مسابقه"
            >
              <span>🔗</span>
              <span>اشتراک‌گذاری</span>
            </button>

            <button
              type="button"
              onClick={handleOpenPrint}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
              title="چاپ برنامه مسابقات و دریافت PDF"
            >
              <span>🖨️</span>
              <span className="hidden sm:inline">چاپ / PDF</span>
            </button>

            <Link
              href="/planner"
              className="hidden md:inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 text-xs font-black text-white transition-all shadow-xs cursor-pointer"
            >
              <span>⚡</span>
              <span>ساخت مسابقه جدید</span>
            </Link>
          </div>
        </div>

        {/* Live Refresh Notification Banner */}
        {refreshMessage && (
          <div className="bg-emerald-600 text-white text-center py-1 text-xs font-bold animate-in fade-in">
            {refreshMessage}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Tournament Hero Banner */}
        <section className="rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50 to-emerald-50/40 p-5 sm:p-7 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-[11px] font-black shadow-2xs">
                  <span>🏆</span>
                  <span>صفحه اختصاصی مسابقات</span>
                </span>

                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 text-[11px] font-bold">
                  {FORMAT_TITLES[tournament.format] || tournament.format}
                </span>

                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 text-[11px] font-bold">
                  👥 {toPersianDigits(tournament.teamCount)} تیم
                </span>

                {isCompleted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-0.5 text-[11px] font-black">
                    🏁 پایان مسابقات
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 text-[11px] font-black">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>در حال برگزاری مسابقات</span>
                  </span>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
                {tournament.title}
              </h1>

              {/* Venue and Details if available */}
              {(metadata.venue || metadata.date || metadata.notes) && (
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-1">
                  {metadata.venue && (
                    <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-xl shadow-2xs font-semibold">
                      <span>📍</span>
                      <span>{toPersianDigits(metadata.venue)}</span>
                    </span>
                  )}
                  {metadata.date && (
                    <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-xl shadow-2xs font-semibold">
                      <span>📅</span>
                      <span>{toPersianDigits(metadata.date)}</span>
                    </span>
                  )}
                  {metadata.notes && (
                    <span className="text-slate-500 italic">
                      {metadata.notes}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Spectator Mode Info Badge */}
            <div className="shrink-0 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs text-xs space-y-1.5 max-w-xs">
              <div className="flex items-center gap-1.5 font-black text-slate-800">
                <span className="text-emerald-600">👁️</span>
                <span>حالت فقط مشاهده (Spectator)</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                این صفحه برای دسترسی تماشاگران و تیم‌ها به برنامه، زمان و مکان بازی‌ها و نتایج زنده طراحی شده است.
              </p>
            </div>
          </div>
        </section>

        {/* Schedule & Standings & Brackets Viewer */}
        {result ? (
          <section className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs">
            <ScheduleView
              result={result}
              scores={scores}
              matchDetails={matchDetails}
              teams={teamNames}
              qualifiersPerGroup={qualifiersPerGroup}
              readOnly={true}
            />
          </section>
        ) : (
          <div className="p-12 text-center rounded-3xl border border-slate-200 bg-white">
            <p className="font-bold text-slate-600 text-sm">
              اطلاعات برنامه مسابقات در دسترس نیست.
            </p>
          </div>
        )}

        {/* Create Your Own Tournament Invitation */}
        <section className="rounded-3xl border border-emerald-500/20 bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800 p-6 sm:p-8 text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-6 no-print">
          <div className="space-y-1.5 text-center md:text-right">
            <h3 className="text-lg sm:text-xl font-black">
              شما هم مسابقات ورزشی خود را در کمتر از ۱ دقیقه برنامه‌ریزی کنید!
            </h3>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-xl leading-relaxed">
              تولید خودکار جدول لیگ، مسابقات حذفی و گروهی بدون بازی تکراری همراه با ثبت زنده نتایج و صفحه اختصاصی مسابقات برای اشتراک‌گذاری با بازیکنان و تماشاگران.
            </p>
          </div>

          <Link
            href="/planner"
            className="shrink-0 rounded-2xl bg-white text-emerald-900 hover:bg-emerald-50 font-black px-6 py-3.5 text-sm shadow-md transition-all cursor-pointer flex items-center gap-2"
          >
            <span>🏆 شروع ساخت مسابقه</span>
            <span>←</span>
          </Link>
        </section>
      </main>

      {/* Spectator Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <NexSportIcon size={20} />
            <span className="font-bold text-slate-700">NexSport</span>
            <span>— سامانه برنامه‌ریزی و نتایج مسابقات ورزشی</span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-emerald-700 font-bold transition-colors">
              صفحه اصلی
            </Link>
            <Link href="/planner" className="hover:text-emerald-700 font-bold transition-colors">
              برنامه‌ریز مسابقات
            </Link>
            <span className="text-slate-400">|</span>
            <span className="font-mono dir-ltr font-semibold text-slate-600">nexsport.ir</span>
          </div>
        </div>
      </footer>

      {/* Share Modal */}
      <ShareTournamentModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        tournamentId={tournament.id}
        tournamentTitle={tournament.title}
        onEnsureSaved={async () => tournament.id}
      />
    </div>
  );
}
