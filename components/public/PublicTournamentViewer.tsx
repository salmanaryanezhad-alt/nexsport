"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ScheduleResult, MatchScheduleDetail } from "@/lib/scheduling/types";
import { MatchScore } from "@/lib/scheduling/knockout";
import { ScheduleView } from "@/components/planner/ScheduleView";
import { NexSportIcon } from "@/components/NexSportLogo";
import { toPersianDigits } from "@/lib/digits";
import { ShareTournamentModal } from "@/components/planner/ShareTournamentModal";
import { decodeTournamentPayload, encodeTournamentPayload } from "@/lib/tournamentCodec";
import { useAuth } from "@/components/auth/AuthContext";
import { FollowButton } from "@/components/community/FollowButton";

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
    payment?: {
      isPaid?: boolean;
      amount?: number;
      refId?: string;
      paidAt?: string;
    };
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
  tournamentId,
  initialTournament,
}: {
  tournamentId: string;
  initialTournament: PublicTournamentData | null;
}) {
  const { isAdmin } = useAuth();
  const [tournament, setTournament] = useState<PublicTournamentData | null>(initialTournament);
  const [clientChecking, setClientChecking] = useState<boolean>(!initialTournament);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [unpaidAccess, setUnpaidAccess] = useState<"unknown" | "allowed" | "denied">(
    initialTournament?.state?.payment?.isPaid ? "allowed" : "unknown"
  );

  // Client recovery effect for serverless environments
  useEffect(() => {
    if (initialTournament) {
      setTournament(initialTournament);
      setClientChecking(false);
      try {
        localStorage.setItem(`nexsport_t_${tournamentId}`, JSON.stringify(initialTournament));
        const token = encodeTournamentPayload(initialTournament);
        if (token) {
          document.cookie = `nexsport_t_${tournamentId}=${token}; path=/; max-age=2592000; SameSite=Lax`;
        }
      } catch {}
      return;
    }

    if (typeof window === "undefined") return;

    let recovered: PublicTournamentData | null = null;

    // 1. Check URL search param (?d=...)
    const searchParams = new URLSearchParams(window.location.search);
    const paramD = searchParams.get("d");
    if (paramD) {
      const decoded = decodeTournamentPayload(paramD);
      if (decoded) recovered = decoded as any;
    }

    // 2. Check URL hash (#d=...)
    if (!recovered && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const hashD = hashParams.get("d");
      if (hashD) {
        const decoded = decodeTournamentPayload(hashD);
        if (decoded) recovered = decoded as any;
      }
    }

    // 3. Check localStorage for specific tournament cache
    if (!recovered) {
      try {
        const cached = localStorage.getItem(`nexsport_t_${tournamentId}`);
        if (cached) {
          recovered = JSON.parse(cached);
        }
      } catch {}
    }

    // 4. Check active wizard state if user just planned this tournament
    if (!recovered) {
      try {
        const wizStr = localStorage.getItem("nexsport_wizard_state_v4");
        if (wizStr) {
          const wiz = JSON.parse(wizStr);
          if (wiz && wiz.result) {
            recovered = {
              id: tournamentId,
              title: wiz.metadata?.title || "مسابقات ورزشی",
              format: wiz.format || "league",
              sport: wiz.pointsRule?.sport || null,
              teamCount: wiz.teamCount || 4,
              state: {
                result: wiz.result,
                scores: wiz.scores || {},
                matchDetails: wiz.matchDetails || {},
                teamNames: wiz.teamNames || [],
                qualifiersPerGroup: wiz.qualifiersPerGroup || 2,
                metadata: wiz.metadata || {},
                pointsRule: wiz.pointsRule,
                format: wiz.format,
                payment: { isPaid: true },
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
          }
        }
      } catch {}
    }

    if (recovered) {
      setTournament(recovered);
      try {
        localStorage.setItem(`nexsport_t_${tournamentId}`, JSON.stringify(recovered));
        const token = encodeTournamentPayload(recovered);
        if (token) {
          document.cookie = `nexsport_t_${tournamentId}=${token}; path=/; max-age=2592000; SameSite=Lax`;
        }
        if (window.location.search.includes("d=")) {
          window.history.replaceState({}, "", `/t/${tournamentId}`);
        }
      } catch {}
    }

    setClientChecking(false);
  }, [initialTournament, tournamentId]);

  useEffect(() => {
    const alreadyPaid = Boolean(tournament?.state?.payment?.isPaid);
    if (alreadyPaid) {
      setUnpaidAccess("allowed");
      return;
    }
    if (isAdmin) {
      setUnpaidAccess("allowed");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tournaments/public/${tournamentId}/`, {
          credentials: "same-origin",
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data?.tournament) {
            setTournament((prev) => prev || data.tournament);
          }
          setUnpaidAccess("allowed");
          return;
        }
        if (res.status === 402) {
          setUnpaidAccess("denied");
          return;
        }
      } catch {}
      if (!cancelled) setUnpaidAccess(isAdmin ? "allowed" : "denied");
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId, isAdmin, tournament?.state?.payment?.isPaid]);

  if (clientChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-9 h-9 rounded-full border-3 border-emerald-600 border-t-transparent animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-600">در حال بارگذاری اطلاعات مسابقه...</p>
        </div>
      </div>
    );
  }

  // Not found anywhere
  if (!tournament) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 text-center space-y-4 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 text-2xl">
            🔍
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-black text-slate-900">مسابقه یافت نشد</h1>
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

  const isPaid = Boolean(tournament.state?.payment?.isPaid);
  const canViewUnpaid = isAdmin || unpaidAccess === "allowed";

  if (!isPaid && unpaidAccess === "unknown" && !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-9 h-9 rounded-full border-3 border-emerald-600 border-t-transparent animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-600">در حال بررسی دسترسی مشاهده...</p>
        </div>
      </div>
    );
  }

  if (!isPaid && !canViewUnpaid) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 text-center space-y-4 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 text-2xl">
            🔒
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-black text-slate-900">
              لینک اختصاصی هنوز فعال‌سازی نشده است
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              صفحه مسابقه «{tournament.title}» در انتظار پرداخت و فعال‌سازی توسط برگزارکننده است.
            </p>
          </div>
          <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/80 p-3 text-[11px] text-emerald-950 text-right leading-relaxed">
            💡 اگر شما برگزارکننده این مسابقه هستید، می‌توانید با مراجعه به برنامه‌ریز و کلیک روی دکمه «🔗 ایجاد لینک اختصاصی»، این صفحه را فعال نمایید.
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
              ورود به برنامه‌ریز مسابقات
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
  } else if (result?.format === "knockout") {
    const kRounds = (result as any).knockout?.rounds || (result as any).rounds || [];
    for (const r of kRounds) {
      for (const m of r.matches || []) {
        if (!m.isBye) {
          totalMatches++;
          if (m.winner) playedMatches++;
        }
      }
    }
  } else if (result?.format === "double-knockout") {
    const dk = (result as any).doubleKnockout || (result as any);
    const checkRounds = (rounds: any[]) => {
      for (const r of rounds || []) {
        for (const m of r.matches || []) {
          if (!m.isBye) {
            totalMatches++;
            if (m.winner) playedMatches++;
          }
        }
      }
    };
    checkRounds(dk.winnersRounds || []);
    checkRounds(dk.losersRounds || []);
    checkRounds(dk.grandFinalRounds || []);
  }

  const progressPercent = totalMatches > 0 ? Math.round((playedMatches / totalMatches) * 100) : 0;

  async function handleRefresh(silent = false) {
    if (!tournament) return;
    if (!silent) {
      setIsRefreshing(true);
      setRefreshMessage(null);
    }
    try {
      let res = await fetch(`/api/tournaments/public/${tournament.id}/?_t=${Date.now()}`);
      if (!res.ok && res.status === 404) {
        res = await fetch(`/api/tournaments/public/${tournament.id}?_t=${Date.now()}`);
      }
      if (res.ok) {
        const data = await res.json();
        if (data.tournament?.state) {
          setTournament((prev) => {
            if (!prev) return data.tournament;
            return {
              ...data.tournament,
              state: {
                ...prev.state,
                ...data.tournament.state,
                scores: data.tournament.state.scores || prev.state.scores,
                matchDetails: data.tournament.state.matchDetails || prev.state.matchDetails,
                result: data.tournament.state.result || prev.state.result,
              },
            };
          });
          if (!silent) {
            setRefreshMessage("✓ آخرین نتایج با موفقیت به‌روزرسانی شد.");
            setTimeout(() => setRefreshMessage(null), 3000);
          }
          return;
        }
      }
    } catch {
      // Fallback to local storage
    }

    // Client-side recovery check
    if (typeof window !== "undefined") {
      try {
        const updatedScoresStr = localStorage.getItem(`nexsport_t_${tournament.id}_scores`);
        const updatedDetailsStr = localStorage.getItem(`nexsport_t_${tournament.id}_matchDetails`);
        const wizStr = localStorage.getItem("nexsport_wizard_state_v4");

        let newScores = updatedScoresStr ? JSON.parse(updatedScoresStr) : null;
        let newDetails = updatedDetailsStr ? JSON.parse(updatedDetailsStr) : null;

        if (!newScores && wizStr) {
          const wiz = JSON.parse(wizStr);
          if (wiz?.scores) newScores = wiz.scores;
          if (wiz?.matchDetails) newDetails = wiz.matchDetails;
        }

        if (newScores) {
          setTournament((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              state: {
                ...prev.state,
                scores: newScores,
                matchDetails: newDetails || prev.state.matchDetails,
              },
            };
          });
          if (!silent) {
            setRefreshMessage("✓ نتایج همگام‌سازی شد.");
            setTimeout(() => setRefreshMessage(null), 2500);
          }
          return;
        }
      } catch {}
    }

    if (!silent) {
      setRefreshMessage("امکان دریافت جدیدترین نسخه مسابقه وجود ندارد.");
      setTimeout(() => setRefreshMessage(null), 3000);
    }
    if (!silent) {
      setIsRefreshing(false);
    }
  }

  // Real-time synchronization for same-browser organizer tabs
  useEffect(() => {
    if (!tournamentId) return;

    function handleStorageChange(e: StorageEvent) {
      if (e.key === "nexsport_t_updated" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && (parsed.id === tournamentId || !parsed.id)) {
            setTournament((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                state: {
                  ...prev.state,
                  scores: parsed.scores || prev.state.scores,
                  matchDetails: parsed.matchDetails || prev.state.matchDetails,
                  result: parsed.result || prev.state.result,
                },
              };
            });
            setRefreshMessage("⚡ نتیجه بازی به‌روزرسانی شد!");
            setTimeout(() => setRefreshMessage(null), 2500);
          }
        } catch {}
      }

      if (e.key === `nexsport_t_${tournamentId}_scores` && e.newValue) {
        try {
          const newScores = JSON.parse(e.newValue);
          setTournament((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              state: { ...prev.state, scores: newScores },
            };
          });
        } catch {}
      }
    }

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [tournamentId]);

  // Periodic background polling every 5s for spectator devices
  useEffect(() => {
    if (!tournament?.id) return;
    const interval = setInterval(() => {
      handleRefresh(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [tournament?.id]);

  function handleOpenPrint() {
    window.print();
  }

  const isAdminPreview = !isPaid && (isAdmin || unpaidAccess === "allowed");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-200">
      {isAdminPreview && (
        <div className="no-print bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-[11px] font-bold text-amber-950">
          پیش‌نمایش بررسی برنامه — لینک اختصاصی این مسابقه هنوز برای عموم فعال نشده است. ثبت نتیجه در این صفحه ممکن نیست.
        </div>
      )}
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
              onClick={() => handleRefresh(false)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
              title="بارگذاری مجدد آخرین نتایج ثبت‌شده"
            >
              <span className={isRefreshing ? "animate-spin" : ""}>🔄</span>
              <span className="hidden sm:inline">به‌روزرسانی نتایج</span>
            </button>

            {isPaid && <FollowButton tournamentId={tournament.id} compact />}
            {isPaid && (
            <button
              type="button"
              onClick={() => setShareModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800 hover:bg-emerald-100 transition-all cursor-pointer shadow-2xs"
              title="اشتراک‌گذاری لینک اختصاصی این مسابقه"
            >
              <span>🔗</span>
              <span>اشتراک‌گذاری</span>
            </button>
            )}

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
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-1.5 text-center text-xs font-bold text-emerald-900 animate-in fade-in">
            {refreshMessage}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-5">
        {/* Tournament Hero Card */}
        <section className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300/80 px-2.5 py-0.5 text-xs font-black">
                  {tournament.sport || "مسابقات ورزشی"}
                </span>
                <span className="rounded-lg bg-slate-100 text-slate-700 px-2.5 py-0.5 text-xs font-bold">
                  {FORMAT_TITLES[tournament.format] || tournament.format}
                </span>
                <span className="rounded-lg bg-slate-100 text-slate-700 px-2.5 py-0.5 text-xs font-bold">
                  {toPersianDigits(tournament.teamCount)} تیم
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {tournament.title}
              </h1>
            </div>

            {/* Spectator Mode Badge */}
            <div className="shrink-0 flex sm:flex-col items-center sm:items-end justify-between gap-1 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 text-xs font-black text-emerald-800">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>صفحه زنده تماشاگران</span>
              </div>
              <span className="text-[10px] text-slate-500">
                فقط مشاهده (بدون امکان تغییر نتیجه)
              </span>
            </div>
          </div>

          {/* Tournament Progress & Metadata details */}
          <div className="pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="text-slate-500 text-[11px] block">پیشرفت مسابقات:</span>
              <div className="flex items-center gap-2">
                <div className="w-20 bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="font-black text-slate-800 text-xs">
                  {toPersianDigits(progressPercent)}٪
                </span>
              </div>
            </div>

            <div className="space-y-0.5">
              <span className="text-slate-500 text-[11px] block">وضعیت بازی‌ها:</span>
              <span className="font-bold text-slate-800">
                {toPersianDigits(playedMatches)} از {toPersianDigits(totalMatches)} بازی انجام شده
              </span>
            </div>

            {metadata.venue && (
              <div className="space-y-0.5">
                <span className="text-slate-500 text-[11px] block">محل برگزاری:</span>
                <span className="font-bold text-slate-800 truncate block">
                  {metadata.venue}
                </span>
              </div>
            )}

            {metadata.date && (
              <div className="space-y-0.5">
                <span className="text-slate-500 text-[11px] block">تاریخ شروع / برگزاری:</span>
                <span className="font-bold text-slate-800">
                  {toPersianDigits(metadata.date)}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Schedule & Standings & Brackets in READ-ONLY mode */}
        {result && (
          <section className="space-y-4">
            <ScheduleView
              result={result}
              scores={scores}
              onScoreChange={() => {}}
              matchDetails={matchDetails}
              onMatchDetailChange={() => {}}
              teams={teamNames}
              qualifiersPerGroup={qualifiersPerGroup}
              readOnly={true}
            />
          </section>
        )}
      </main>

      {/* Spectator Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6 no-print">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-2">
          <p className="text-xs text-slate-500">
            برگزار شده با سامانه برنامه‌ریزی و قرعه‌کشی مسابقات ورزشی{" "}
            <Link href="/" className="font-black text-emerald-700 hover:underline">
              NexSport
            </Link>
          </p>
          <p className="text-[10px] text-slate-400">
            تمامی حقوق جداول و اطلاعات این مسابقه متعلق به برگزارکننده آن می‌باشد.
          </p>
        </div>
      </footer>

      {/* Share Modal */}
      {shareModalOpen && (
        <ShareTournamentModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          tournamentId={tournament.id}
          tournamentTitle={tournament.title}
          onEnsureSaved={async () => tournament.id}
          tournamentData={tournament}
        />
      )}
    </div>
  );
}
