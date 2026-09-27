"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  ScheduleResult,
  RoundRobinRound,
  GroupResult,
  MatchScore,
  calculateStandings,
  calculateClinchStatuses,
  getBestThirdsRanking,
  isPlaceholderTeam,
  computeKnockoutWithScores,
  computeDoubleKnockoutWithScores,
  findPlayedDownstreamMatch,
  DoubleKnockoutResult,
  TournamentMetadata,
  MatchScheduleDetail,
  PointsRule,
} from "@/lib/scheduling";
import { NexSportIcon } from "@/components/NexSportLogo";
import { PrintModal, PrintSettings } from "./PrintModal";

interface ScheduleViewProps {
  result: ScheduleResult;
  scores: Record<string, MatchScore>;
  matchDetails?: Record<string, MatchScheduleDetail>;
  onScoreChange: (
    matchId: string,
    home: number | null,
    away: number | null,
    homePenalty?: number | null,
    awayPenalty?: number | null,
    winner?: string | null
  ) => void;
  onMatchDetailChange?: (
    matchId: string,
    detail: MatchScheduleDetail
  ) => void;
  onResetScores?: () => void;
  teams: string[];
  qualifiersPerGroup?: number;
}

export function ScheduleView({
  result,
  scores,
  matchDetails = {},
  onScoreChange,
  onMatchDetailChange,
  onResetScores,
  teams,
  qualifiersPerGroup = 2,
}: ScheduleViewProps) {
  const [activeTab, setActiveTab] = useState<"matches" | "standings">("matches");
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number | "all">("all");
  const [filterTeam, setFilterTeam] = useState<string>("all");

  const [editingMatch, setEditingMatch] = useState<{
    id: string;
    home: string;
    away: string;
  } | null>(null);
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formPitch, setFormPitch] = useState("");

  function handleOpenEditModal(id: string, home: string, away: string) {
    const existing = matchDetails?.[id];
    setFormDate(existing?.date || "");
    setFormTime(existing?.time || "");
    setFormPitch(existing?.pitch || "");
    setEditingMatch({ id, home, away });
  }

  function handleSaveMatchDetail() {
    if (!editingMatch || !onMatchDetailChange) return;
    onMatchDetailChange(editingMatch.id, {
      date: formDate.trim() || undefined,
      time: formTime.trim() || undefined,
      pitch: formPitch.trim() || undefined,
    });
    setEditingMatch(null);
  }

  function handleClearMatchDetail() {
    if (!editingMatch || !onMatchDetailChange) return;
    onMatchDetailChange(editingMatch.id, {});
    setEditingMatch(null);
  }

  const hasStandings =
    result.format === "league" ||
    result.format === "double-league" ||
    result.format === "groups" ||
    result.format === "groups-knockout";

  const meta = result.metadata;

  const isKoFormat =
    result.format === "knockout" ||
    result.format === "double-knockout" ||
    result.format === "groups-knockout";

  const [matchesViewMode, setMatchesViewMode] = useState<"list" | "classic">("list");
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printSettings, setPrintSettings] = useState<PrintSettings>(() => ({
    orientation: isKoFormat ? "landscape" : "portrait",
    bracketStyle: "stages",
    section: "both",
  }));

  useEffect(() => {
    const handleOpen = () => setIsPrintModalOpen(true);
    window.addEventListener("nexsport-open-print", handleOpen);
    return () => window.removeEventListener("nexsport-open-print", handleOpen);
  }, []);

  useEffect(() => {
    const handleBeforePrint = () => {
      let styleEl = document.getElementById("nexsport-print-style");
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "nexsport-print-style";
        document.head.appendChild(styleEl);
      }
      const margin = printSettings.orientation === "landscape" ? "8mm 8mm 8mm 8mm" : "10mm 8mm 12mm 8mm";
      styleEl.innerHTML = `@media print { @page { size: A4 ${printSettings.orientation} !important; margin: ${margin} !important; } }`;
    };

    window.addEventListener("beforeprint", handleBeforePrint);
    return () => window.removeEventListener("beforeprint", handleBeforePrint);
  }, [printSettings.orientation]);

  const handleApplyAndPrint = (newSettings: PrintSettings) => {
    setPrintSettings(newSettings);
    setIsPrintModalOpen(false);

    let styleEl = document.getElementById("nexsport-print-style");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "nexsport-print-style";
      document.head.appendChild(styleEl);
    }
    const margin = newSettings.orientation === "landscape" ? "8mm 8mm 8mm 8mm" : "10mm 8mm 12mm 8mm";
    styleEl.innerHTML = `@media print { @page { size: A4 ${newSettings.orientation} !important; margin: ${margin} !important; } }`;

    document.body.classList.remove("print-landscape", "print-portrait");
    document.body.classList.add(`print-${newSettings.orientation}`);

    setTimeout(() => {
      window.print();
    }, 150);
  };

  const euroBestThirds = useMemo(() => {
    if (result.format !== "groups-knockout" || !result.knockout) {
      return null;
    }
    const baseQualifiers = result.groups.length * qualifiersPerGroup;
    const bracketSize = result.knockout.bracketSize;
    const extraNeeded = Math.max(0, bracketSize - baseQualifiers);
    if (extraNeeded <= 0) return null;

    const ranking = getBestThirdsRanking(result.groups, scores, meta?.pointsRule);
    const qualifiedTeamNames = ranking.allCompleted
      ? new Set(ranking.rankedThirds.slice(0, extraNeeded).map((t) => t.team))
      : new Set<string>();

    return {
      extraNeeded,
      allCompleted: ranking.allCompleted,
      rankedThirds: ranking.rankedThirds,
      qualifiedTeamNames,
    };
  }, [result, scores, qualifiersPerGroup, meta?.pointsRule]);

  return (
    <div id="print-area" className="space-y-6">
      {/* Official Header for Print & Web */}
      <div className="rounded-xl border border-line bg-chalk/80 p-5 shadow-sm print:border-pitch/40 print:bg-white print:p-4 print-avoid-break">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏆</span>
              <h1 className="text-xl font-black text-pitch">
                {meta?.title || "جدول و برنامه رسمی مسابقات"}
              </h1>
            </div>
            {meta?.venue && (
              <p className="text-xs text-ink/70 mt-1 flex items-center gap-1.5 font-medium">
                <span>📍 محل برگزاری:</span>
                <span className="text-ink font-semibold">{meta.venue}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="no-print inline-flex items-center gap-1.5 rounded-lg bg-pitch hover:bg-pitch-light active:bg-pitch-dark text-white px-3.5 py-2 text-xs font-bold transition-colors shadow-2xs cursor-pointer"
              title="تنظیمات پیشرفته چاپ و دریافت فایل PDF"
            >
              <span>🖨️</span>
              <span>تنظیمات و چاپ PDF</span>
            </button>
            <div className="text-left text-xs space-y-0.5">
              <div className="flex items-center gap-1.5 font-bold text-pitch justify-end">
                <span>سامانه برنامه‌ریزی مسابقات NexSport</span>
                <NexSportIcon size={20} className="shrink-0 drop-shadow-2xs" />
              </div>
              <div className="font-mono text-pitch font-bold dir-ltr text-xs">
                https://nexsport.ir
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar (matches vs standings) */}
      {hasStandings && (
        <div className="no-print flex items-center justify-between border-b border-line">
          <div className="flex">
            <button
              onClick={() => setActiveTab("matches")}
              className={
                "px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors " +
                (activeTab === "matches"
                  ? "border-pitch text-pitch"
                  : "border-transparent text-ink/60 hover:text-ink")
              }
            >
              ⚽ برنامه و نتایج مسابقات
            </button>
            <button
              onClick={() => setActiveTab("standings")}
              className={
                "px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 " +
                (activeTab === "standings"
                  ? "border-pitch text-pitch"
                  : "border-transparent text-ink/60 hover:text-ink")
              }
            >
              📊 جدول رده‌بندی و امتیازات
            </button>
          </div>

          {onResetScores && Object.keys(scores).length > 0 && (
            <button
              onClick={onResetScores}
              className="text-xs text-brick hover:underline font-semibold px-2 py-1"
              title="پاک کردن گل‌ها و نتایج ثبت‌شده بدون تغییر در قرعه‌کشی مسابقات"
            >
              🧹 پاک کردن نتایج بازی‌ها
            </button>
          )}
        </div>
      )}

      {/* Team Filter Bar */}
      {activeTab === "matches" && teams.length > 2 && (
        <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white/70 px-4 py-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-pitch flex items-center gap-1">
              <span>🔍</span>
              <span>فیلتر مسابقات تیم:</span>
            </span>
            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink focus:border-pitch focus:outline-none cursor-pointer"
            >
              <option value="all">همه تیم‌ها (مشاهده تمام مسابقات)</option>
              {teams.map((t) => (
                <option key={t} value={t}>
                  مسابقات تیم {t}
                </option>
              ))}
            </select>
          </div>

          {filterTeam !== "all" && (
            <div className="flex items-center gap-2">
              <span className="text-pitch font-medium">
                فقط مسابقات <strong>{filterTeam}</strong> نمایش داده می‌شود.
              </span>
              <button
                onClick={() => setFilterTeam("all")}
                className="text-brick font-bold hover:underline"
              >
                ✕ لغو فیلتر (نمایش همه)
              </button>
            </div>
          )}
        </div>
      )}

      {/* MATCHES VIEW */}
      {(activeTab === "matches" ||
        printSettings.section === "both" ||
        printSettings.section === "matches") && (
        <div
          className={`space-y-6 ${
            activeTab !== "matches" ? "print-only" : ""
          } ${printSettings.section === "standings" ? "print:hidden" : ""}`}
        >
          {/* View Switcher: Simple List (Default) vs Classic Bracket/Stage View */}
          <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white/90 p-3 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-pitch">نحوه نمایش مسابقات:</span>
              <div className="inline-flex rounded-lg border border-line bg-chalk/80 p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setMatchesViewMode("list")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 transition-all cursor-pointer ${
                    matchesViewMode === "list"
                      ? "bg-pitch text-chalk shadow-xs font-bold"
                      : "text-ink/70 hover:text-ink"
                  }`}
                >
                  <span>📋</span>
                  <span>لیست ساده مسابقات (تمام‌صفحه)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMatchesViewMode("classic")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 transition-all cursor-pointer ${
                    matchesViewMode === "classic"
                      ? "bg-pitch text-chalk shadow-xs font-bold"
                      : "text-ink/70 hover:text-ink"
                  }`}
                >
                  <span>{isKoFormat ? "🌳" : "🗂️"}</span>
                  <span>{isKoFormat ? "نمودار درختی / ساختار سنتی" : "تفکیک هفته‌ها"}</span>
                </button>
              </div>
            </div>
            <span className="text-xs text-ink/60 hidden sm:inline">
              {matchesViewMode === "list"
                ? "فهرست ساده، سطری و کامل کلیه مسابقات در تمام عرض صفحه"
                : "نمای ساختاری و دسته‌بندی‌شده مسابقات"}
            </span>
          </div>

          {matchesViewMode === "list" ? (
            <SimpleMatchListView
              result={result}
              scores={scores}
              onScoreChange={onScoreChange}
              matchDetails={matchDetails}
              onOpenEditModal={handleOpenEditModal}
              filterTeam={filterTeam}
              metadata={meta}
            />
          ) : (
            <div className="space-y-8">
              {(result.format === "league" || result.format === "double-league") && (
                <RoundsTable
                  rounds={result.rounds}
                  scores={scores}
                  onScoreChange={onScoreChange}
                  metadata={meta}
                  matchDetails={matchDetails}
                  onOpenEditModal={handleOpenEditModal}
                  filterTeam={filterTeam}
                />
              )}

              {result.format === "groups" && (
                <GroupsMatchesView
                  groups={result.groups}
                  scores={scores}
                  onScoreChange={onScoreChange}
                  selectedGroupIndex={selectedGroupIndex}
                  onSelectGroup={setSelectedGroupIndex}
                  metadata={meta}
                  matchDetails={matchDetails}
                  onOpenEditModal={handleOpenEditModal}
                  filterTeam={filterTeam}
                />
              )}

              {result.format === "groups-knockout" && (
                <div className="space-y-12 print:space-y-6">
                  <div className="print-avoid-break">
                    <h2 className="text-lg font-bold text-pitch mb-4 print:text-base print:mb-2">
                      مرحله اول: مسابقات گروهی
                    </h2>
                    <GroupsMatchesView
                      groups={result.groups}
                      scores={scores}
                      onScoreChange={onScoreChange}
                      selectedGroupIndex={selectedGroupIndex}
                      onSelectGroup={setSelectedGroupIndex}
                      metadata={meta}
                      matchDetails={matchDetails}
                      onOpenEditModal={handleOpenEditModal}
                      filterTeam={filterTeam}
                    />
                  </div>

                  <div className="print-avoid-break">
                    <div className="border-t border-line pt-8 mb-6 print:pt-4 print:mb-3">
                      <h2 className="text-lg font-bold text-pitch print:text-base">
                        مرحله دوم: براکت حذفی صعودکننده‌ها
                      </h2>
                      <p className="text-xs text-ink/60 mt-1 print:text-[10px]">
                        با مسجل شدن وضعیت یا اتمام بازی‌های هر گروه، تیم‌های اول و دوم صعودکننده به صورت خودکار به جایگاه‌های خود در این براکت منتقل می‌شوند.
                      </p>
                    </div>
                    <InteractiveBracket
                      originalKnockout={result.knockout}
                      groups={result.groups}
                      pointsRule={meta?.pointsRule}
                      scores={scores}
                      onScoreChange={onScoreChange}
                      matchDetails={matchDetails}
                      onOpenEditModal={handleOpenEditModal}
                      filterTeam={filterTeam}
                      printBracketStyle={printSettings.bracketStyle}
                    />
                  </div>
                </div>
              )}

              {result.format === "knockout" && (
                <div>
                  <div className="mb-6 print:mb-3">
                    <h2 className="text-lg font-bold text-pitch print:text-base">براکت حذفی مسابقات</h2>
                    <p className="text-xs text-ink/60 mt-1 print:text-[10px]">
                      نتایج هر مسابقه را ثبت کنید تا تیم‌های برنده مستقیماً به مراحل بعدی و فینال راه پیدا
                      کنند. در صورت تساوی، فیلد ضربات پنالتی فعال می‌شود.
                    </p>
                  </div>
                  <InteractiveBracket
                    originalKnockout={result.knockout}
                    scores={scores}
                    onScoreChange={onScoreChange}
                    matchDetails={matchDetails}
                    onOpenEditModal={handleOpenEditModal}
                    filterTeam={filterTeam}
                    printBracketStyle={printSettings.bracketStyle}
                  />
                </div>
              )}

              {result.format === "double-knockout" && (
                <div>
                  <div className="mb-6 print:mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🛡️</span>
                      <h2 className="text-lg font-bold text-pitch print:text-base">
                        تورنمنت دو حذفی (Double Elimination)
                      </h2>
                    </div>
                    <p className="text-xs text-ink/60 mt-1 print:text-[10px]">
                      در این تورنمنت هیچ تیمی با یک باخت حذف نمی‌شود. بازنده‌ها به جدول شانس مجدد (Losers Bracket) منتقل می‌شوند و فینال بین قهرمان جدول برندگان و قهرمان شانس مجدد برگزار خواهد شد.
                    </p>
                  </div>
                  <InteractiveDoubleKnockoutBracket
                    originalDoubleKnockout={result.doubleKnockout}
                    scores={scores}
                    onScoreChange={onScoreChange}
                    matchDetails={matchDetails}
                    onOpenEditModal={handleOpenEditModal}
                    filterTeam={filterTeam}
                    printBracketStyle={printSettings.bracketStyle}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* STANDINGS VIEW */}
      {hasStandings &&
        (activeTab === "standings" ||
          printSettings.section === "both" ||
          printSettings.section === "standings") && (
          <div
            className={`space-y-8 print:space-y-4 ${
              activeTab !== "standings" ? "print-only" : ""
            } ${printSettings.section === "matches" ? "print:hidden" : ""} ${
              printSettings.section === "both" && activeTab === "matches"
                ? "print-break-before"
                : ""
            }`}
          >
          {(result.format === "league" || result.format === "double-league") && (
            <div>
              <h2 className="text-lg font-bold text-pitch mb-4">جدول رده‌بندی لیگ</h2>
              <StandingsTable
                teams={teams}
                rounds={result.rounds}
                scores={scores}
                qualifiersCount={1}
                qualifierLabel="قهرمان"
                pointsRule={meta?.pointsRule}
              />
            </div>
          )}

          {(result.format === "groups" || result.format === "groups-knockout") && (
            <div className="space-y-8">
              {result.groups.map((g) => (
                <div key={g.name} className="rounded-lg border border-line p-5 bg-white/40">
                  <h3 className="font-bold text-pitch text-base mb-3 flex items-center justify-between">
                    <span>{g.name}</span>
                    <span className="text-xs font-normal text-ink/50">
                      {qualifiersPerGroup} تیم برتر صعود می‌کنند
                      {euroBestThirds && " (صعود مستقیم)"}
                    </span>
                  </h3>
                  <StandingsTable
                    teams={g.teams}
                    rounds={g.rounds}
                    scores={scores}
                    qualifiersCount={qualifiersPerGroup}
                    qualifierLabel="صعود"
                    pointsRule={meta?.pointsRule}
                    extraQualifiedTeams={euroBestThirds?.qualifiedTeamNames}
                    extraQualifierLabel="صعود (تیم سوم برتر)"
                  />
                </div>
              ))}

              {/* Comparative table for 3rd-placed teams */}
              {euroBestThirds && euroBestThirds.rankedThirds.length > 0 && (
                <div className="rounded-lg border border-line p-5 bg-white shadow-sm print-avoid-break">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🏆</span>
                      <h3 className="font-bold text-pitch text-base">
                        جدول مقایسه تیم‌های رتبه سوم (صعود {euroBestThirds.extraNeeded} تیم برتر سوم به مرحله حذفی)
                      </h3>
                    </div>
                    <span className="text-xs text-ink/60">
                      {euroBestThirds.allCompleted
                        ? `مسابقات مرحله گروهی پایان یافته است (${euroBestThirds.extraNeeded} تیم سوم صعود کردند)`
                        : `در حال برگزاری مسابقات (${euroBestThirds.extraNeeded} تیم برتر در موقعیت صعود هستند)`}
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-line">
                    <table className="w-full text-center text-sm">
                      <thead>
                        <tr className="border-b border-line bg-chalk/80 text-xs font-bold text-ink/70">
                          <th className="py-2.5 px-3 text-center w-12">رتبه</th>
                          <th className="py-2.5 px-4 text-right">تیم</th>
                          <th className="py-2.5 px-3 text-center w-24">گروه</th>
                          <th className="py-2.5 px-2.5 w-12">بازی</th>
                          <th className="py-2.5 px-2.5 w-12 text-pitch font-extrabold">برد</th>
                          {meta?.pointsRule?.sport !== "volleyball" && <th className="py-2.5 px-2.5 w-12 text-ink/60">مساوی</th>}
                          <th className="py-2.5 px-2.5 w-12 text-brick">باخت</th>
                          <th className="py-2.5 px-2.5 w-14">{meta?.pointsRule?.sport === "volleyball" ? "ست+" : "زده"}</th>
                          <th className="py-2.5 px-2.5 w-14">{meta?.pointsRule?.sport === "volleyball" ? "ست-" : "خورده"}</th>
                          <th className="py-2.5 px-2.5 w-14 font-semibold">{meta?.pointsRule?.sport === "volleyball" ? "تفاضل ست" : "تفاضل"}</th>
                          <th className="py-2.5 px-3 w-16 bg-pitch/5 font-extrabold text-pitch">امتیاز</th>
                          <th className="py-2.5 px-3 w-36 text-center">وضعیت صعود</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/60">
                        {euroBestThirds.rankedThirds.map((row, idx) => {
                          const isTopRanked = idx < euroBestThirds.extraNeeded;
                          const isFinal = euroBestThirds.allCompleted;
                          return (
                            <tr
                              key={row.team}
                              className={
                                "transition-colors " +
                                (isTopRanked
                                  ? isFinal
                                    ? "bg-emerald-50/60 font-semibold"
                                    : "bg-amber-50/30"
                                  : "hover:bg-chalk/30")
                              }
                            >
                              <td className="py-2.5 px-3">
                                <span
                                  className={
                                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold " +
                                    (isTopRanked && isFinal
                                      ? "bg-pitch text-chalk"
                                      : isTopRanked
                                      ? "bg-amber-500 text-white"
                                      : "bg-chalk text-ink/70 border border-line")
                                  }
                                >
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-right font-semibold text-ink">
                                {row.team}
                              </td>
                              <td className="py-2.5 px-3 text-xs text-ink/70 font-medium">
                                {row.groupName}
                              </td>
                              <td className="py-2.5 px-2.5 text-ink/80">{row.standing.played}</td>
                              <td className="py-2.5 px-2.5 font-bold text-pitch">{row.standing.won}</td>
                              {meta?.pointsRule?.sport !== "volleyball" && (
                                <td className="py-2.5 px-2.5 text-ink/60">{row.standing.drawn}</td>
                              )}
                              <td className="py-2.5 px-2.5 text-brick">{row.standing.lost}</td>
                              <td className="py-2.5 px-2.5 text-ink/80">{row.standing.goalsFor}</td>
                              <td className="py-2.5 px-2.5 text-ink/80">{row.standing.goalsAgainst}</td>
                              <td
                                className={
                                  "py-2.5 px-2.5 font-bold " +
                                  (row.standing.goalDifference > 0
                                    ? "text-pitch"
                                    : row.standing.goalDifference < 0
                                    ? "text-brick"
                                    : "text-ink/50")
                                }
                              >
                                {row.standing.goalDifference > 0 ? `+${row.standing.goalDifference}` : row.standing.goalDifference}
                              </td>
                              <td className="py-2.5 px-3 bg-pitch/5 font-extrabold text-pitch text-base">
                                {row.standing.points}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {isFinal ? (
                                  isTopRanked ? (
                                    <span className="rounded bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-xs font-bold text-emerald-800">
                                      ✓ صعود به مرحله حذفی
                                    </span>
                                  ) : (
                                    <span className="text-xs text-ink/40">عدم صعود</span>
                                  )
                                ) : isTopRanked ? (
                                  <span className="rounded bg-amber-100 border border-amber-300 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                    موقعیت صعود موقت
                                  </span>
                                ) : (
                                  <span className="text-xs text-ink/50">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Official Watermark / Footer for Print */}
      <div className="print-only border-t-2 border-pitch/30 pt-3 mt-8 print-avoid-break">
        <div className="flex items-center justify-between text-xs text-ink/75">
          <div className="flex items-center gap-2 font-bold text-pitch">
            <NexSportIcon size={22} className="shrink-0 drop-shadow-2xs" />
            <span>برنامه‌ریزی و قرعه‌کشی با سامانه ورزشی NexSport</span>
          </div>
          <div className="font-mono font-bold text-pitch dir-ltr text-xs">
            https://nexsport.ir
          </div>
          <span className="text-[11px] text-ink/50">
            تولید آنلاین، استاندارد و رایگان جدول مسابقات
          </span>
        </div>
      </div>

      {/* Modal for Match Scheduling Details (Date / Time / Pitch) */}
      {editingMatch && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-2xl animate-fade-in space-y-4">
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <div>
                <h3 className="font-bold text-base text-pitch">
                  تنظیم زمان و محل برگزاری مسابقه
                </h3>
                <p className="text-xs text-ink/60 mt-0.5">
                  {editingMatch.home} 🆚 {editingMatch.away}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMatch(null)}
                className="text-ink/40 hover:text-ink text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-ink/80 mb-1">
                  📅 تاریخ مسابقه (مثلاً ۱۴۰۳/۰۶/۲۵ یا شنبه):
                </label>
                <input
                  type="text"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  placeholder="مثال: ۱۴۰۳/۰۷/۱۰ یا دوشنبه"
                  className="w-full rounded-lg border border-line px-3 py-2 text-xs text-ink focus:border-pitch focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink/80 mb-1">
                  🕒 ساعت مسابقه:
                </label>
                <input
                  type="text"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  placeholder="مثال: ۱۸:۳۰"
                  className="w-full rounded-lg border border-line px-3 py-2 text-xs text-ink focus:border-pitch focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink/80 mb-1">
                  📍 زمین / سالن برگزاری:
                </label>
                <input
                  type="text"
                  value={formPitch}
                  onChange={(e) => setFormPitch(e.target.value)}
                  placeholder="مثال: سالن شماره ۱ یا زمین چمن مصنوعی"
                  className="w-full rounded-lg border border-line px-3 py-2 text-xs text-ink focus:border-pitch focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-line/60">
              <button
                type="button"
                onClick={handleClearMatchDetail}
                className="text-xs text-brick hover:underline font-semibold"
              >
                پاک کردن اطلاعات
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingMatch(null)}
                  className="rounded-lg border border-line px-4 py-2 text-xs font-medium text-ink hover:bg-chalk"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleSaveMatchDetail}
                  className="rounded-lg bg-pitch px-5 py-2 text-xs font-bold text-chalk hover:bg-pitch-light"
                >
                  ثبت و ذخیره
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Print Setup */}
      <PrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        tournamentTitle={meta?.title}
        hasKnockout={isKoFormat}
        hasStandings={hasStandings}
        currentSettings={printSettings}
        onApplyAndPrint={handleApplyAndPrint}
      />
    </div>
  );
}

/* =========================================================
   SIMPLE MATCH LIST VIEW (CLEAN, FULL-WIDTH FLAT LIST)
   ========================================================= */

interface FlatMatchItem {
  id: string;
  stageLabel: string;
  stageCategory: "league" | "group" | "knockout" | "winners" | "losers" | "finals";
  matchCode: string;
  home: string | null;
  away: string | null;
  homePlaceholder?: string | null;
  awayPlaceholder?: string | null;
  isBye?: boolean;
  autoAdvance?: string | null;
  winner?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  homePenalty?: number | null;
  awayPenalty?: number | null;
  isKnockout?: boolean;
}

function SimpleMatchListView({
  result,
  scores,
  onScoreChange,
  matchDetails,
  onOpenEditModal,
  filterTeam,
  metadata,
}: {
  result: ScheduleResult;
  scores: Record<string, MatchScore>;
  onScoreChange: (
    matchId: string,
    home: number | null,
    away: number | null,
    homePenalty?: number | null,
    awayPenalty?: number | null,
    winner?: string | null
  ) => void;
  matchDetails?: Record<string, MatchScheduleDetail>;
  onOpenEditModal?: (id: string, home: string, away: string) => void;
  filterTeam?: string;
  metadata?: TournamentMetadata;
}) {
  const [selectedStage, setSelectedStage] = useState<string>("all");

  const { allMatches, flatMatches } = useMemo(() => {
    const list: FlatMatchItem[] = [];
    const rawMatches: any[] = [];

    // 1. League / Double-League
    if (result.format === "league" || result.format === "double-league") {
      result.rounds.forEach((r) => {
        r.matches.forEach((m, idx) => {
          rawMatches.push(m);
          const matchId = m.id ?? `r${r.round}-m${idx + 1}`;
          const sc = scores[matchId];
          list.push({
            id: matchId,
            stageLabel: `هفته ${r.round}`,
            stageCategory: "league",
            matchCode: `بازی ${idx + 1}`,
            home: m.home,
            away: m.away,
            isBye: m.isBye,
            winner: (m as any).winner ?? sc?.winner ?? null,
            homeScore: sc?.home ?? null,
            awayScore: sc?.away ?? null,
            isKnockout: false,
          });
        });
      });
    }

    // 2. Groups
    if (result.format === "groups") {
      result.groups.forEach((g) => {
        g.rounds.forEach((r) => {
          r.matches.forEach((m, idx) => {
            rawMatches.push(m);
            const matchId = m.id ?? `${g.name}-r${r.round}-m${idx + 1}`;
            const sc = scores[matchId];
            list.push({
              id: matchId,
              stageLabel: `${g.name} - هفته ${r.round}`,
              stageCategory: "group",
              matchCode: `بازی ${idx + 1}`,
              home: m.home,
              away: m.away,
              isBye: m.isBye,
              winner: (m as any).winner ?? sc?.winner ?? null,
              homeScore: sc?.home ?? null,
              awayScore: sc?.away ?? null,
              isKnockout: false,
            });
          });
        });
      });
    }

    // 3. Groups + Knockout
    if (result.format === "groups-knockout") {
      result.groups.forEach((g) => {
        g.rounds.forEach((r) => {
          r.matches.forEach((m, idx) => {
            rawMatches.push(m);
            const matchId = m.id ?? `${g.name}-r${r.round}-m${idx + 1}`;
            const sc = scores[matchId];
            list.push({
              id: matchId,
              stageLabel: `${g.name} - هفته ${r.round}`,
              stageCategory: "group",
              matchCode: `بازی ${idx + 1}`,
              home: m.home,
              away: m.away,
              isBye: m.isBye,
              winner: (m as any).winner ?? sc?.winner ?? null,
              homeScore: sc?.home ?? null,
              awayScore: sc?.away ?? null,
              isKnockout: false,
            });
          });
        });
      });

      if (result.knockout) {
        const { knockout } = computeKnockoutWithScores(
          result.knockout,
          scores,
          result.groups,
          metadata?.pointsRule
        );
        knockout?.rounds?.forEach((r: any) => {
          r.matches?.forEach((m: any) => {
            rawMatches.push(m);
            const sc = scores[m.id];
            list.push({
              id: m.id,
              stageLabel: r.label,
              stageCategory: "knockout",
              matchCode: m.matchCode || `بازی ${m.slot !== undefined ? m.slot + 1 : m.id}`,
              home: m.home,
              away: m.away,
              homePlaceholder: m.homePlaceholder,
              awayPlaceholder: m.awayPlaceholder,
              isBye: Boolean(m.isBye || m.autoAdvance),
              autoAdvance: m.autoAdvance,
              winner: m.winner,
              homeScore: sc?.home ?? m.homeScore ?? null,
              awayScore: sc?.away ?? m.awayScore ?? null,
              homePenalty: sc?.homePenalty ?? m.homePenalty ?? null,
              awayPenalty: sc?.awayPenalty ?? m.awayPenalty ?? null,
              isKnockout: true,
            });
          });
        });

        if (knockout?.thirdPlaceMatch) {
          const m = knockout.thirdPlaceMatch;
          rawMatches.push(m);
          const sc = scores[m.id];
          list.push({
            id: m.id,
            stageLabel: "دیدار رده‌بندی (مقام سوم)",
            stageCategory: "knockout",
            matchCode: m.matchCode || "رده‌بندی",
            home: m.home,
            away: m.away,
            homePlaceholder: m.homePlaceholder,
            awayPlaceholder: m.awayPlaceholder,
            isBye: Boolean(m.isBye || m.autoAdvance),
            autoAdvance: m.autoAdvance,
            winner: m.winner,
            homeScore: sc?.home ?? m.homeScore ?? null,
            awayScore: sc?.away ?? m.awayScore ?? null,
            homePenalty: sc?.homePenalty ?? m.homePenalty ?? null,
            awayPenalty: sc?.awayPenalty ?? m.awayPenalty ?? null,
            isKnockout: true,
          });
        }
      }
    }

    // 4. Knockout
    if (result.format === "knockout" && result.knockout) {
      const { knockout } = computeKnockoutWithScores(
        result.knockout,
        scores,
        undefined,
        metadata?.pointsRule
      );
      knockout?.rounds?.forEach((r: any) => {
        r.matches?.forEach((m: any) => {
          rawMatches.push(m);
          const sc = scores[m.id];
          list.push({
            id: m.id,
            stageLabel: r.label,
            stageCategory: "knockout",
            matchCode: m.matchCode || `بازی ${m.slot !== undefined ? m.slot + 1 : m.id}`,
            home: m.home,
            away: m.away,
            homePlaceholder: m.homePlaceholder,
            awayPlaceholder: m.awayPlaceholder,
            isBye: Boolean(m.isBye || m.autoAdvance),
            autoAdvance: m.autoAdvance,
            winner: m.winner,
            homeScore: sc?.home ?? m.homeScore ?? null,
            awayScore: sc?.away ?? m.awayScore ?? null,
            homePenalty: sc?.homePenalty ?? m.homePenalty ?? null,
            awayPenalty: sc?.awayPenalty ?? m.awayPenalty ?? null,
            isKnockout: true,
          });
        });
      });

      if (knockout?.thirdPlaceMatch) {
        const m = knockout.thirdPlaceMatch;
        rawMatches.push(m);
        const sc = scores[m.id];
        list.push({
          id: m.id,
          stageLabel: "دیدار رده‌بندی (مقام سوم)",
          stageCategory: "knockout",
          matchCode: m.matchCode || "رده‌بندی",
          home: m.home,
          away: m.away,
          homePlaceholder: m.homePlaceholder,
          awayPlaceholder: m.awayPlaceholder,
          isBye: Boolean(m.isBye || m.autoAdvance),
          autoAdvance: m.autoAdvance,
          winner: m.winner,
          homeScore: sc?.home ?? m.homeScore ?? null,
          awayScore: sc?.away ?? m.awayScore ?? null,
          homePenalty: sc?.homePenalty ?? m.homePenalty ?? null,
          awayPenalty: sc?.awayPenalty ?? m.awayPenalty ?? null,
          isKnockout: true,
        });
      }
    }

    // 5. Double Knockout
    if (result.format === "double-knockout" && result.doubleKnockout) {
      const { doubleKnockout } = computeDoubleKnockoutWithScores(result.doubleKnockout, scores);
      doubleKnockout?.winnersBracket?.forEach((r) => {
        r.matches?.forEach((m) => {
          rawMatches.push(m);
          const sc = scores[m.id];
          list.push({
            id: m.id,
            stageLabel: `جدول برندگان - ${r.label}`,
            stageCategory: "winners",
            matchCode: m.matchCode || m.id,
            home: m.home,
            away: m.away,
            homePlaceholder: m.homePlaceholder,
            awayPlaceholder: m.awayPlaceholder,
            isBye: Boolean(m.isBye || m.autoAdvance),
            autoAdvance: m.autoAdvance,
            winner: m.winner,
            homeScore: sc?.home ?? m.homeScore ?? null,
            awayScore: sc?.away ?? m.awayScore ?? null,
            homePenalty: sc?.homePenalty ?? m.homePenalty ?? null,
            awayPenalty: sc?.awayPenalty ?? m.awayPenalty ?? null,
            isKnockout: true,
          });
        });
      });

      doubleKnockout?.losersBracket?.forEach((r) => {
        r.matches?.forEach((m) => {
          rawMatches.push(m);
          const sc = scores[m.id];
          list.push({
            id: m.id,
            stageLabel: `جدول شانس مجدد - ${r.label}`,
            stageCategory: "losers",
            matchCode: m.matchCode || m.id,
            home: m.home,
            away: m.away,
            homePlaceholder: m.homePlaceholder,
            awayPlaceholder: m.awayPlaceholder,
            isBye: Boolean(m.isBye || m.autoAdvance),
            autoAdvance: m.autoAdvance,
            winner: m.winner,
            homeScore: sc?.home ?? m.homeScore ?? null,
            awayScore: sc?.away ?? m.awayScore ?? null,
            homePenalty: sc?.homePenalty ?? m.homePenalty ?? null,
            awayPenalty: sc?.awayPenalty ?? m.awayPenalty ?? null,
            isKnockout: true,
          });
        });
      });

      if (doubleKnockout?.grandFinal) {
        const m = doubleKnockout.grandFinal;
        rawMatches.push(m);
        const sc = scores[m.id];
        list.push({
          id: m.id,
          stageLabel: "فینال نهایی مسابقات (Grand Final)",
          stageCategory: "finals",
          matchCode: m.matchCode || "فینال اصلی",
          home: m.home,
          away: m.away,
          homePlaceholder: m.homePlaceholder,
          awayPlaceholder: m.awayPlaceholder,
          isBye: Boolean(m.isBye || m.autoAdvance),
          winner: m.winner,
          homeScore: sc?.home ?? m.homeScore ?? null,
          awayScore: sc?.away ?? m.awayScore ?? null,
          homePenalty: sc?.homePenalty ?? m.homePenalty ?? null,
          awayPenalty: sc?.awayPenalty ?? m.awayPenalty ?? null,
          isKnockout: true,
        });
      }

      if (doubleKnockout?.bracketResetMatch) {
        const m = doubleKnockout.bracketResetMatch;
        rawMatches.push(m);
        const sc = scores[m.id];
        list.push({
          id: m.id,
          stageLabel: "فینال مجدد (Bracket Reset)",
          stageCategory: "finals",
          matchCode: m.matchCode || "فینال مجدد",
          home: m.home,
          away: m.away,
          homePlaceholder: m.homePlaceholder,
          awayPlaceholder: m.awayPlaceholder,
          isBye: Boolean(m.isBye || m.autoAdvance),
          winner: m.winner,
          homeScore: sc?.home ?? m.homeScore ?? null,
          awayScore: sc?.away ?? m.awayScore ?? null,
          homePenalty: sc?.homePenalty ?? m.homePenalty ?? null,
          awayPenalty: sc?.awayPenalty ?? m.awayPenalty ?? null,
          isKnockout: true,
        });
      }
    }

    return { allMatches: rawMatches, flatMatches: list };
  }, [result, scores, metadata?.pointsRule]);

  const stages = useMemo(() => {
    const set = new Set<string>();
    flatMatches.forEach((m) => set.add(m.stageLabel));
    return Array.from(set);
  }, [flatMatches]);

  const visibleMatches = useMemo(() => {
    return flatMatches.filter((m) => {
      if (filterTeam && filterTeam !== "all") {
        if (m.home !== filterTeam && m.away !== filterTeam) return false;
      }
      if (selectedStage !== "all" && m.stageLabel !== selectedStage) {
        return false;
      }
      return true;
    });
  }, [flatMatches, filterTeam, selectedStage]);

  const stats = useMemo(() => {
    let played = 0;
    flatMatches.forEach((m) => {
      const hasScore =
        m.homeScore !== null &&
        m.awayScore !== null &&
        m.homeScore !== undefined &&
        m.awayScore !== undefined;
      if (hasScore || m.isBye || m.winner) {
        played++;
      }
    });
    return {
      total: flatMatches.length,
      played,
      remaining: Math.max(0, flatMatches.length - played),
    };
  }, [flatMatches]);

  const checkDownstreamPlayed = useCallback(
    (matchId: string) => {
      return findPlayedDownstreamMatch(matchId, allMatches, scores);
    },
    [allMatches, scores]
  );

  return (
    <div className="space-y-4 w-full">
      {/* Stats and filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-chalk/60 px-4 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-pitch">
            <span>📊 آمار مسابقات:</span>
            <span>{stats.total} مسابقه کل</span>
          </div>
          <span className="text-ink/30">•</span>
          <span className="text-emerald-700 font-semibold">{stats.played} بازی انجام شده</span>
          <span className="text-ink/30">•</span>
          <span className="text-amber-800 font-semibold">{stats.remaining} بازی در انتظار</span>
        </div>

        {stages.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink/70">فیلتر مرحله:</span>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink focus:border-pitch focus:outline-none cursor-pointer"
            >
              <option value="all">تمام مراحل و هفته‌ها ({stages.length})</option>
              {stages.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* The Simple List Table */}
      <div className="w-full overflow-x-auto rounded-2xl border border-line bg-white shadow-xs print-avoid-break">
        <table className="w-full text-right text-sm print:text-xs">
          <thead>
            <tr className="border-b border-line bg-chalk/80 text-xs font-bold text-ink/75 print:bg-chalk print-avoid-break">
              <th className="py-3 px-3 text-center w-12 print:py-1.5 print:px-1.5">#</th>
              <th className="py-3 px-3 text-center w-40 print:py-1.5 print:px-2">مرحله / هفته</th>
              <th className="py-3 px-2 text-center w-24 print:py-1.5 print:px-1">کد مسابقه</th>
              <th className="py-3 px-3 text-center w-52 print:py-1.5 print:px-2">زمان و مکان برگزاری</th>
              <th className="py-3 px-4 text-left font-bold w-1/4 print:py-1.5 print:px-2">تیم اول (میزبان)</th>
              <th className="py-3 px-3 text-center w-36 print:py-1.5 print:px-1.5">نتیجه مسابقه</th>
              <th className="py-3 px-4 text-right font-bold w-1/4 print:py-1.5 print:px-2">تیم دوم (میهمان)</th>
              <th className="py-3 px-3 text-center w-40 print:py-1.5 print:px-2">وضعیت / برنده</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {visibleMatches.map((m, idx) => {
              const sc = scores[m.id] || {
                home: m.homeScore ?? null,
                away: m.awayScore ?? null,
                homePenalty: m.homePenalty ?? null,
                awayPenalty: m.awayPenalty ?? null,
                winner: m.winner ?? null,
              };
              const dt = matchDetails?.[m.id];
              const isHomeReal = Boolean(m.home && !isPlaceholderTeam(m.home));
              const isAwayReal = Boolean(m.away && !isPlaceholderTeam(m.away));
              const isBye = Boolean(m.isBye || m.autoAdvance);
              const isPending = !isBye && (!isHomeReal || !isAwayReal);
              const isReadyToPlay = !isBye && isHomeReal && isAwayReal;

              const hasScores =
                sc.home !== null &&
                sc.away !== null &&
                sc.home !== undefined &&
                sc.away !== undefined;

              const homeWon = m.winner
                ? m.winner === m.home
                : Boolean(hasScores && (sc.home as number) > (sc.away as number));
              const awayWon = m.winner
                ? m.winner === m.away
                : Boolean(hasScores && (sc.away as number) > (sc.home as number));
              const isTied = Boolean(isReadyToPlay && hasScores && (sc.home as number) === (sc.away as number));

              const downstreamPlayed = m.isKnockout ? checkDownstreamPlayed(m.id) : null;
              const downstreamBlocked = Boolean(downstreamPlayed);
              const warnDownstream = () => {
                const nextCode =
                  downstreamPlayed?.matchCode ||
                  downstreamPlayed?.label ||
                  (downstreamPlayed?.slot !== undefined
                    ? `بازی ${downstreamPlayed.slot + 1}`
                    : "مرحله بعد");
                alert(
                  `امکان تغییر یا لغو نتیجه این مسابقه وجود ندارد، زیرا نتیجه مسابقه مرحله بعد (${nextCode}) قبلاً ثبت شده است.\n\nلطفاً ابتدا نتیجه مسابقه مرحله بعد را پاک یا لغو نمایید.`
                );
              };

              return (
                <tr
                  key={m.id}
                  className="even:bg-chalk/30 hover:bg-gold/5 transition-colors print-avoid-break"
                >
                  {/* Row # */}
                  <td className="py-3 px-3 text-center font-mono text-xs text-ink/60 print:py-1.5 print:px-1.5">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-chalk border border-line/80 font-bold text-xs text-ink/70">
                      {idx + 1}
                    </span>
                  </td>

                  {/* Stage */}
                  <td className="py-3 px-3 text-center text-xs print:py-1.5 print:px-2">
                    <span className="inline-block rounded-md bg-pitch/5 px-2.5 py-1 text-pitch font-bold border border-pitch/15">
                      {m.stageLabel}
                    </span>
                  </td>

                  {/* Code */}
                  <td className="py-3 px-2 text-center font-mono text-xs text-pitch font-bold print:py-1.5 print:px-1">
                    <span className="rounded bg-line/40 px-2 py-0.5">
                      {m.matchCode}
                    </span>
                  </td>

                  {/* Date, Time & Pitch */}
                  <td className="py-3 px-3 text-center text-xs print:py-1.5 print:px-2">
                    {dt && (dt.date || dt.time || dt.pitch) ? (
                      <button
                        type="button"
                        onClick={() => onOpenEditModal && onOpenEditModal(m.id, m.home || "", m.away || "")}
                        className="inline-flex items-center gap-1 text-[11px] text-ink/80 hover:text-pitch font-medium transition-colors cursor-pointer group"
                        title="کلیک برای ویرایش زمان و مکان برگزاری"
                      >
                        <span className="text-pitch/70 group-hover:text-pitch">🕒</span>
                        <span className="font-mono">
                          {[dt.date, dt.time ? `ساعت ${dt.time}` : "", dt.pitch ? `زمین ${dt.pitch}` : ""]
                            .filter(Boolean)
                            .join(" • ")}
                        </span>
                      </button>
                    ) : onOpenEditModal ? (
                      <button
                        type="button"
                        onClick={() => onOpenEditModal(m.id, m.home || "", m.away || "")}
                        className="text-[11px] text-pitch/60 hover:text-pitch hover:underline cursor-pointer no-print font-medium"
                        title="ثبت زمان و زمین برگزاری"
                      >
                        + تنظیم زمان/زمین
                      </button>
                    ) : (
                      <span className="text-[11px] text-ink/30">—</span>
                    )}
                  </td>

                  {/* Home Team */}
                  <td className="py-3 px-4 text-left print:py-1.5 print:px-2">
                    {isHomeReal ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!isReadyToPlay || hasScores) return;
                          if (downstreamBlocked) { warnDownstream(); return; }
                          if (homeWon) {
                            onScoreChange(m.id, null, null, null, null, null);
                          } else {
                            onScoreChange(m.id, sc.home, sc.away, sc.homePenalty, sc.awayPenalty, m.home);
                          }
                        }}
                        disabled={!isReadyToPlay || hasScores}
                        className={`text-left text-xs font-bold transition-all ${
                          homeWon
                            ? "text-pitch bg-pitch/10 px-2.5 py-1 rounded-md border border-pitch/25"
                            : isReadyToPlay && !hasScores
                            ? "text-ink hover:text-pitch cursor-pointer"
                            : "text-ink cursor-default"
                        }`}
                        title={
                          homeWon
                            ? `تیم برنده: ${m.home}`
                            : isReadyToPlay && !hasScores
                            ? `کلیک برای انتخاب دستی ${m.home} به عنوان برنده`
                            : undefined
                        }
                      >
                        {homeWon && <span className="ml-1 text-pitch font-black">✓</span>}
                        <span>{m.home}</span>
                      </button>
                    ) : isBye ? (
                      <span className="text-xs text-ink/40 italic">— استراحت قرعه —</span>
                    ) : (
                      <span className="text-[11px] text-amber-800 font-medium italic">
                        ⏳ {m.home || m.homePlaceholder || "در انتظار برنده مسابقه قبل"}
                      </span>
                    )}
                  </td>

                  {/* Score */}
                  <td className="py-3 px-3 text-center print:py-1.5 print:px-1.5">
                    {isBye ? (
                      <span className="text-xs text-emerald-800 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                        صعود بدون بازی
                      </span>
                    ) : isPending ? (
                      <span className="text-xs text-ink/40 font-mono">— : —</span>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            max="99"
                            value={sc.home !== null && sc.home !== undefined ? sc.home : ""}
                            onChange={(e) => {
                              if (downstreamBlocked) { warnDownstream(); return; }
                              const val = e.target.value === "" ? null : Math.max(0, parseInt(e.target.value) || 0);
                              onScoreChange(m.id, val, sc.away ?? null, sc.homePenalty, sc.awayPenalty, undefined);
                            }}
                            placeholder="-"
                            className="w-10 h-7 rounded border border-line bg-white text-center font-bold text-xs text-ink focus:border-pitch focus:outline-none"
                          />
                          <span className="text-ink/40 font-bold">:</span>
                          <input
                            type="number"
                            min="0"
                            max="99"
                            value={sc.away !== null && sc.away !== undefined ? sc.away : ""}
                            onChange={(e) => {
                              if (downstreamBlocked) { warnDownstream(); return; }
                              const val = e.target.value === "" ? null : Math.max(0, parseInt(e.target.value) || 0);
                              onScoreChange(m.id, sc.home ?? null, val, sc.homePenalty, sc.awayPenalty, undefined);
                            }}
                            placeholder="-"
                            className="w-10 h-7 rounded border border-line bg-white text-center font-bold text-xs text-ink focus:border-pitch focus:outline-none"
                          />
                        </div>
                        {m.isKnockout && isTied && (
                          <div
                            className="flex items-center justify-center gap-1 text-[10px] text-amber-800 font-mono bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-0.5"
                            title="ضربات پنالتی در صورت تساوی"
                          >
                            <span>پنالتی:</span>
                            <input
                              type="number"
                              min="0"
                              max="99"
                              value={sc.homePenalty !== null && sc.homePenalty !== undefined ? sc.homePenalty : ""}
                              onChange={(e) => {
                                if (downstreamBlocked) { warnDownstream(); return; }
                                const val = e.target.value === "" ? null : Math.max(0, parseInt(e.target.value) || 0);
                                onScoreChange(m.id, sc.home, sc.away, val, sc.awayPenalty ?? null, undefined);
                              }}
                              placeholder="-"
                              className="w-7 h-5 rounded border border-amber-300 text-center font-bold text-[10px]"
                            />
                            <span>:</span>
                            <input
                              type="number"
                              min="0"
                              max="99"
                              value={sc.awayPenalty !== null && sc.awayPenalty !== undefined ? sc.awayPenalty : ""}
                              onChange={(e) => {
                                if (downstreamBlocked) { warnDownstream(); return; }
                                const val = e.target.value === "" ? null : Math.max(0, parseInt(e.target.value) || 0);
                                onScoreChange(m.id, sc.home, sc.away, sc.homePenalty ?? null, val, undefined);
                              }}
                              placeholder="-"
                              className="w-7 h-5 rounded border border-amber-300 text-center font-bold text-[10px]"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Away Team */}
                  <td className="py-3 px-4 text-right print:py-1.5 print:px-2">
                    {isAwayReal ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!isReadyToPlay || hasScores) return;
                          if (downstreamBlocked) { warnDownstream(); return; }
                          if (awayWon) {
                            onScoreChange(m.id, null, null, null, null, null);
                          } else {
                            onScoreChange(m.id, sc.home, sc.away, sc.homePenalty, sc.awayPenalty, m.away);
                          }
                        }}
                        disabled={!isReadyToPlay || hasScores}
                        className={`text-right text-xs font-bold transition-all ${
                          awayWon
                            ? "text-pitch bg-pitch/10 px-2.5 py-1 rounded-md border border-pitch/25"
                            : isReadyToPlay && !hasScores
                            ? "text-ink hover:text-pitch cursor-pointer"
                            : "text-ink cursor-default"
                        }`}
                        title={
                          awayWon
                            ? `تیم برنده: ${m.away}`
                            : isReadyToPlay && !hasScores
                            ? `کلیک برای انتخاب دستی ${m.away} به عنوان برنده`
                            : undefined
                        }
                      >
                        <span>{m.away}</span>
                        {awayWon && <span className="mr-1 text-pitch font-black">✓</span>}
                      </button>
                    ) : isBye ? (
                      <span className="text-xs text-ink/40 italic">— استراحت قرعه —</span>
                    ) : (
                      <span className="text-[11px] text-amber-800 font-medium italic">
                        ⏳ {m.away || m.awayPlaceholder || "در انتظار برنده مسابقه قبل"}
                      </span>
                    )}
                  </td>

                  {/* Status / Winner */}
                  <td className="py-3 px-3 text-center print:py-1.5 print:px-2">
                    {m.winner ? (
                      <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <span>✓ برنده: {m.winner}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (downstreamBlocked) { warnDownstream(); return; }
                            onScoreChange(m.id, null, null, null, null, null);
                          }}
                          className="text-rose-600 hover:text-rose-800 text-[11px] font-bold mr-0.5 cursor-pointer no-print"
                          title="لغو برنده و پاک کردن نتیجه"
                        >
                          ✕
                        </button>
                      </div>
                    ) : isBye ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        🟢 استراحت
                      </span>
                    ) : isReadyToPlay ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                        ⚽ آماده برگزاری
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        ⏳ در انتظار حریف
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================
   ROUNDS TABLE & MATCH ROWS
   ========================================================= */

function RoundsTable({
  rounds,
  title,
  scores,
  onScoreChange,
  metadata,
  matchDetails,
  onOpenEditModal,
  filterTeam,
}: {
  rounds: RoundRobinRound[];
  title?: string;
  scores: Record<string, MatchScore>;
  onScoreChange: (
    matchId: string,
    home: number | null,
    away: number | null,
    homePenalty?: number | null,
    awayPenalty?: number | null,
    winner?: string | null
  ) => void;
  metadata?: TournamentMetadata;
  matchDetails?: Record<string, MatchScheduleDetail>;
  onOpenEditModal?: (id: string, home: string, away: string) => void;
  filterTeam?: string;
}) {
  return (
    <div className="space-y-6 w-full">
      {title && <h3 className="font-bold text-pitch text-base">{title}</h3>}
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 w-full">
        {rounds.map((round) => {
          const visibleMatches =
            filterTeam && filterTeam !== "all"
              ? round.matches.filter((m) => m.home === filterTeam || m.away === filterTeam)
              : round.matches;

          if (filterTeam && filterTeam !== "all" && visibleMatches.length === 0) {
            return null;
          }

          return (
            <div
              key={round.round}
              className="rounded-lg border border-line bg-white/60 p-4 shadow-sm print-avoid-break"
            >
              <div className="mb-3 flex items-center justify-between border-b border-line/60 pb-2">
                <span className="font-semibold text-sm text-pitch">هفته {round.round}</span>
                <span className="text-xs text-ink/50">{visibleMatches.length} مسابقه</span>
              </div>
              <div className="space-y-2.5">
                {visibleMatches.map((m, idx) => {
                  const matchId = m.id ?? `r${round.round}-m${idx + 1}`;
                  const sc = scores[matchId] || { home: null, away: null };
                  const homeWon = sc.home !== null && sc.away !== null && sc.home > sc.away;
                  const awayWon = sc.home !== null && sc.away !== null && sc.away > sc.home;
                  const dt = matchDetails?.[matchId];

                  return (
                    <div
                      key={matchId}
                      className="rounded-md border border-line/80 bg-chalk/60 px-3 py-2 text-sm space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={
                            "flex-1 text-right truncate font-medium " +
                            (homeWon ? "text-pitch font-bold" : "text-ink")
                          }
                          title={m.home}
                        >
                          {m.home}
                        </span>

                        {/* Score inputs */}
                        <div className="mx-2 flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            max="99"
                            value={sc.home !== null && sc.home !== undefined ? sc.home : ""}
                            onChange={(e) => {
                              const val =
                                e.target.value === ""
                                  ? null
                                  : Math.max(0, parseInt(e.target.value) || 0);
                              onScoreChange(matchId, val, sc.away ?? null);
                            }}
                            placeholder="-"
                            className="w-10 rounded border border-line bg-white py-1 text-center font-bold text-sm text-ink focus:border-gold focus:outline-none"
                          />
                          <span className="text-ink/40 font-bold">:</span>
                          <input
                            type="number"
                            min="0"
                            max="99"
                            value={sc.away !== null && sc.away !== undefined ? sc.away : ""}
                            onChange={(e) => {
                              const val =
                                e.target.value === ""
                                  ? null
                                  : Math.max(0, parseInt(e.target.value) || 0);
                              onScoreChange(matchId, sc.home ?? null, val);
                            }}
                            placeholder="-"
                            className="w-10 rounded border border-line bg-white py-1 text-center font-bold text-sm text-ink focus:border-gold focus:outline-none"
                          />
                        </div>

                        <span
                          className={
                            "flex-1 text-left truncate font-medium " +
                            (awayWon ? "text-pitch font-bold" : "text-ink")
                          }
                          title={m.away}
                        >
                          {m.away}
                        </span>
                      </div>

                      {/* Match Time / Pitch details */}
                      <div className="flex items-center justify-between text-[11px] text-ink/70 pt-1 border-t border-line/40">
                        {dt?.date || dt?.time || dt?.pitch ? (
                          <span className="inline-flex items-center gap-1 text-pitch font-medium truncate">
                            <span>🕒</span>
                            <span>
                              {[
                                dt.date,
                                dt.time ? `ساعت ${dt.time}` : "",
                                dt.pitch ? `زمین ${dt.pitch}` : "",
                              ]
                                .filter(Boolean)
                                .join(" | ")}
                            </span>
                          </span>
                        ) : (
                          <span className="text-ink/40 text-[10px] print:hidden">
                            زمان و زمین ثبت نشده
                          </span>
                        )}
                        {onOpenEditModal && (
                          <button
                            type="button"
                            onClick={() => onOpenEditModal(matchId, m.home, m.away)}
                            className="no-print text-[10px] text-pitch font-semibold hover:underline mr-1"
                          >
                            {dt?.date || dt?.time || dt?.pitch ? "ویرایش" : "🕒 زمان / زمین"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {visibleMatches.length === 0 && (
                  <p className="text-center py-2 text-xs text-ink/40">استراحت (Bye)</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GroupsMatchesView({
  groups,
  scores,
  onScoreChange,
  selectedGroupIndex,
  onSelectGroup,
  metadata,
  matchDetails,
  onOpenEditModal,
  filterTeam,
}: {
  groups: GroupResult[];
  scores: Record<string, MatchScore>;
  onScoreChange: (
    matchId: string,
    home: number | null,
    away: number | null,
    homePenalty?: number | null,
    awayPenalty?: number | null,
    winner?: string | null
  ) => void;
  selectedGroupIndex: number | "all";
  onSelectGroup: (idx: number | "all") => void;
  metadata?: TournamentMetadata;
  matchDetails?: Record<string, MatchScheduleDetail>;
  onOpenEditModal?: (id: string, home: string, away: string) => void;
  filterTeam?: string;
}) {
  const filteredGroups =
    selectedGroupIndex === "all" ? groups : [groups[selectedGroupIndex]];

  return (
    <div className="space-y-6">
      {groups.length > 1 && (
        <div className="no-print flex flex-wrap gap-2">
          <button
            onClick={() => onSelectGroup("all")}
            className={
              "rounded-full px-3.5 py-1 text-xs font-semibold transition-colors " +
              (selectedGroupIndex === "all"
                ? "bg-pitch text-chalk"
                : "bg-line/40 text-ink/70 hover:bg-line")
            }
          >
            همه گروه‌ها ({groups.length})
          </button>
          {groups.map((g, idx) => (
            <button
              key={g.name}
              onClick={() => onSelectGroup(idx)}
              className={
                "rounded-full px-3.5 py-1 text-xs font-semibold transition-colors " +
                (selectedGroupIndex === idx
                  ? "bg-pitch text-chalk"
                  : "bg-line/40 text-ink/70 hover:bg-line")
              }
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      <div className={`space-y-8 ${selectedGroupIndex !== "all" ? "no-print" : ""}`}>
        {filteredGroups.map((g) => (
          <div key={g.name} className="rounded-lg border border-line bg-chalk/30 p-5 print:p-3 print:bg-white print-avoid-break">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3 print:mb-2 print:pb-1">
              <h3 className="font-bold text-pitch text-base print:text-sm">{g.name}</h3>
              <span className="text-xs text-ink/60 print:text-[10px]">تیم‌ها: {g.teams.join(" · ")}</span>
            </div>
            <RoundsTable
              rounds={g.rounds}
              scores={scores}
              onScoreChange={onScoreChange}
              metadata={metadata}
              matchDetails={matchDetails}
              onOpenEditModal={onOpenEditModal}
              filterTeam={filterTeam}
            />
          </div>
        ))}
      </div>

      {selectedGroupIndex !== "all" && (
        <div className="hidden print:block space-y-6">
          {groups.map((g) => (
            <div key={g.name} className="rounded-lg border border-line bg-white p-3 print-avoid-break">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-1">
                <h3 className="font-bold text-pitch text-sm">{g.name}</h3>
                <span className="text-[10px] text-ink/60">تیم‌ها: {g.teams.join(" · ")}</span>
              </div>
              <RoundsTable
                rounds={g.rounds}
                scores={scores}
                onScoreChange={onScoreChange}
                metadata={metadata}
                matchDetails={matchDetails}
                onOpenEditModal={onOpenEditModal}
                filterTeam={filterTeam}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   STANDINGS TABLE
   ========================================================= */

function StandingsTable({
  teams,
  rounds,
  scores,
  qualifiersCount = 1,
  qualifierLabel = "صعود",
  pointsRule,
  extraQualifiedTeams,
  extraQualifierLabel = "صعود (تیم سوم برتر)",
}: {
  teams: string[];
  rounds: RoundRobinRound[];
  scores: Record<string, MatchScore>;
  qualifiersCount?: number;
  qualifierLabel?: string;
  pointsRule?: PointsRule;
  extraQualifiedTeams?: Set<string> | string[];
  extraQualifierLabel?: string;
}) {
  const allMatches = useMemo(() => rounds.flatMap((r) => r.matches), [rounds]);
  const standings = useMemo(
    () => calculateStandings(teams, allMatches, scores, pointsRule),
    [teams, allMatches, scores, pointsRule]
  );
  const clinchMap = useMemo(
    () => calculateClinchStatuses(teams, allMatches, scores, standings, qualifiersCount, pointsRule),
    [teams, allMatches, scores, standings, qualifiersCount, pointsRule]
  );

  const isVolleyball = pointsRule?.sport === "volleyball";

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-sm print-avoid-break print:border-line/70">
      <table className="w-full text-center text-sm print:text-xs">
        <thead>
          <tr className="border-b border-line bg-chalk/80 text-xs font-bold text-ink/70 print:bg-chalk print-avoid-break">
            <th className="py-2.5 px-3 text-center w-12 print:py-1.5 print:px-2">رتبه</th>
            <th className="py-2.5 px-4 text-right print:py-1.5 print:px-2">تیم</th>
            <th className="py-2.5 px-2.5 w-12 print:py-1.5 print:px-1.5" title="تعداد بازی">بازی</th>
            <th className="py-2.5 px-2.5 w-12 text-pitch font-extrabold print:py-1.5 print:px-1.5" title={isVolleyball ? "تعداد برد (معیار اصلی رده‌بندی والیبال)" : "برد"}>
              {isVolleyball ? "برد ⭐️" : "برد"}
            </th>
            {!isVolleyball && (
              <th className="py-2.5 px-2.5 w-12 text-ink/60 print:py-1.5 print:px-1.5" title="مساوی">مساوی</th>
            )}
            <th className="py-2.5 px-2.5 w-12 text-brick print:py-1.5 print:px-1.5" title="باخت">باخت</th>
            <th className="py-2.5 px-2.5 w-14 print:py-1.5 print:px-1.5" title={isVolleyball ? "ست‌های برده" : "گل زده"}>
              {isVolleyball ? "ست+" : "زده"}
            </th>
            <th className="py-2.5 px-2.5 w-14 print:py-1.5 print:px-1.5" title={isVolleyball ? "ست‌های باخته" : "گل خورده"}>
              {isVolleyball ? "ست-" : "خورده"}
            </th>
            <th className="py-2.5 px-2.5 w-14 font-semibold print:py-1.5 print:px-1.5" title={isVolleyball ? "تفاضل ست" : "تفاضل گل"}>
              {isVolleyball ? "تفاضل ست" : "تفاضل"}
            </th>
            <th className="py-2.5 px-3 w-16 bg-pitch/5 font-extrabold text-pitch print:py-1.5 print:px-2 print:bg-chalk" title="امتیاز">امتیاز</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {standings.map((s, idx) => {
            const clinch = clinchMap[s.team];
            const isChampion = clinch?.isChampion;
            const isDirectClinched = clinch?.isClinched;
            const isExtraQualified = extraQualifiedTeams instanceof Set
              ? extraQualifiedTeams.has(s.team)
              : Array.isArray(extraQualifiedTeams)
              ? extraQualifiedTeams.includes(s.team)
              : false;

            const isClinched = isDirectClinched || isExtraQualified;

            return (
              <tr
                key={s.team}
                className={
                  "transition-colors print-avoid-break " +
                  (isChampion
                    ? "bg-gold/15 font-bold"
                    : isClinched
                    ? "bg-emerald-50/50 font-semibold"
                    : "hover:bg-chalk/30")
                }
              >
                <td className="py-2.5 px-3 print:py-1.5 print:px-2">
                  <span
                    className={
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold " +
                      (isChampion
                        ? "bg-gold text-ink"
                        : isClinched
                        ? "bg-pitch text-chalk"
                        : "bg-chalk text-ink/70 border border-line")
                    }
                  >
                    {idx + 1}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-right print:py-1.5 print:px-2">
                  <span className="font-semibold text-ink">{s.team}</span>
                  {isChampion && (
                    <span className="mr-2 rounded bg-gold/25 border border-gold/40 px-1.5 py-0.5 text-[10px] font-bold text-gold-dark print:py-0 print:px-1 print:text-[9px]">
                      👑 قهرمان
                    </span>
                  )}
                  {isDirectClinched && !isChampion && (
                    <span className="mr-2 rounded bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 print:py-0 print:px-1 print:text-[9px]">
                      ✓ {clinch.isAllMatchesFinished ? qualifierLabel : "صعود قطعی"}
                    </span>
                  )}
                  {!isDirectClinched && isExtraQualified && (
                    <span className="mr-2 rounded bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 print:py-0 print:px-1 print:text-[9px]">
                      ✓ {extraQualifierLabel}
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-2.5 text-ink/80 print:py-1.5 print:px-1.5">{s.played}</td>
                <td className="py-2.5 px-2.5 font-bold text-pitch print:py-1.5 print:px-1.5">{s.won}</td>
                {!isVolleyball && (
                  <td className="py-2.5 px-2.5 text-ink/60 print:py-1.5 print:px-1.5">{s.drawn}</td>
                )}
                <td className="py-2.5 px-2.5 text-brick print:py-1.5 print:px-1.5">{s.lost}</td>
                <td className="py-2.5 px-2.5 text-ink/80 print:py-1.5 print:px-1.5">{s.goalsFor}</td>
                <td className="py-2.5 px-2.5 text-ink/80 print:py-1.5 print:px-1.5">{s.goalsAgainst}</td>
                <td
                  className={
                    "py-2.5 px-2.5 font-bold print:py-1.5 print:px-1.5 " +
                    (s.goalDifference > 0
                      ? "text-pitch"
                      : s.goalDifference < 0
                      ? "text-brick"
                      : "text-ink/50")
                  }
                >
                  {s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}
                </td>
                <td className="py-2.5 px-3 bg-pitch/5 font-extrabold text-pitch text-base print:py-1.5 print:px-2 print:text-xs print:bg-chalk">
                  {s.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {pointsRule && (
        <div className="px-3.5 py-2 bg-chalk/60 border-t border-line/60 text-[11px] text-ink/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
          <span>سیستم امتیازدهی: <strong>{pointsRule.name || "سفارشی"}</strong></span>
          {isVolleyball ? (
            <span className="text-[11px] text-pitch font-medium bg-pitch/5 px-2 py-0.5 rounded border border-pitch/15">
              🏐 <b>قوانین رسمی FIVB:</b> برد ۳-۰ یا ۳-۱ (۳ امتیاز) | برد ۳-۲ (۲ امتیاز) | باخت ۳-۲ (۱ امتیاز) | اولویت اول جدول: <b>تعداد برد</b>
            </span>
          ) : pointsRule.sport === "basketball" ? (
            <span className="text-[11px] text-pitch font-medium bg-pitch/5 px-2 py-0.5 rounded border border-pitch/15">
              🏀 <b>قوانین رسمی FIBA:</b> برد (۲ امتیاز) | باخت در زمین (۱ امتیاز) | تساوی ندارد
            </span>
          ) : pointsRule.sport === "beach-soccer" ? (
            <span className="text-[11px] text-pitch font-medium bg-pitch/5 px-2 py-0.5 rounded border border-pitch/15">
              🏖️ <b>قوانین رسمی فوتبال ساحلی:</b> برد در وقت قانونی (۳ امتیاز) | وقت اضافه (۲ امتیاز) | ضربات پنالتی (۱ امتیاز)
            </span>
          ) : pointsRule.sport === "handball" ? (
            <span className="text-[11px] text-pitch font-medium bg-pitch/5 px-2 py-0.5 rounded border border-pitch/15">
              🤾 <b>قوانین رسمی هندبال:</b> برد (۲ امتیاز) | مساوی (۱ امتیاز) | باخت (۰ امتیاز)
            </span>
          ) : (
            <span>(برد: {pointsRule.win} امتیاز | مساوی: {pointsRule.draw} | باخت: {pointsRule.loss})</span>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   DOWNSTREAM PLAYED CHECKER (PROTECTS BRACKET INTEGRITY)
   ========================================================= */

/* =========================================================
   KNOCKOUT PRINTABLE CARD & STAGE-BY-STAGE SCHEDULE
   (Provides 100% clean, non-clipped print output for any bracket size)
   ========================================================= */

function renderPrintMatchCard(
  m: any,
  scores: Record<string, MatchScore>,
  matchDetails?: Record<string, MatchScheduleDetail>,
  overrideLabel?: string
) {
  const sc = scores[m.id];
  const detail = matchDetails?.[m.id];
  const isBye = m.isBye || m.autoAdvance;
  const hasScore =
    sc &&
    sc.home !== null &&
    sc.away !== null &&
    sc.home !== undefined &&
    sc.away !== undefined;
  const homeWon = m.winner && m.winner === m.home;
  const awayWon = m.winner && m.winner === m.away;

  return (
    <div
      key={m.id}
      className="rounded-lg border border-line/90 bg-white p-2.5 text-xs print-avoid-break shadow-2xs space-y-1.5"
    >
      <div className="flex items-center justify-between text-[10px] text-ink/70 pb-1 border-b border-line/60">
        <div className="flex items-center gap-1.5 font-bold">
          {m.matchCode && (
            <span className="rounded bg-pitch/10 text-pitch px-1.5 py-0.2 font-mono text-[9px]">
              {m.matchCode}
            </span>
          )}
          <span className="text-pitch">
            {overrideLabel || (m.matchCode ? "" : `مسابقه ${m.slot !== undefined ? m.slot + 1 : m.id}`)}
          </span>
        </div>
        {detail && (detail.date || detail.time || detail.pitch) ? (
          <span className="font-mono text-[9px] text-ink/65">
            {[detail.date, detail.time ? `ساعت ${detail.time}` : "", detail.pitch ? `زمین ${detail.pitch}` : ""]
              .filter(Boolean)
              .join(" • ")}
          </span>
        ) : (
          <span className="text-[9px] text-ink/40">مسابقه حذفی</span>
        )}
      </div>

      {isBye ? (
        <div className="text-center py-1 font-semibold text-emerald-800 bg-emerald-50/60 rounded text-[11px]">
          {m.home || m.away} (صعود مستقیم - استراحت قرعه)
        </div>
      ) : (
        <div className="space-y-1">
          <div
            className={`flex items-center justify-between px-2 py-1 rounded ${
              homeWon ? "bg-emerald-50 font-bold text-pitch border border-emerald-200" : "bg-chalk/40"
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              {homeWon && <span className="text-emerald-700 text-xs">✓</span>}
              <span
                className={`truncate ${
                  homeWon
                    ? "text-pitch font-bold"
                    : isPlaceholderTeam(m.home)
                    ? "text-ink/40 italic"
                    : "text-ink"
                }`}
              >
                {m.home || "در انتظار برنده دور قبل"}
              </span>
            </div>
            <div className="font-mono font-bold text-xs shrink-0 flex items-center gap-1 dir-ltr">
              <span>{hasScore ? sc.home : "—"}</span>
              {sc?.homePenalty !== null && sc?.homePenalty !== undefined && (
                <span className="text-[10px] text-ink/60">({sc.homePenalty})</span>
              )}
            </div>
          </div>

          <div
            className={`flex items-center justify-between px-2 py-1 rounded ${
              awayWon ? "bg-emerald-50 font-bold text-pitch border border-emerald-200" : "bg-chalk/40"
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              {awayWon && <span className="text-emerald-700 text-xs">✓</span>}
              <span
                className={`truncate ${
                  awayWon
                    ? "text-pitch font-bold"
                    : isPlaceholderTeam(m.away)
                    ? "text-ink/40 italic"
                    : "text-ink"
                }`}
              >
                {m.away || "در انتظار برنده دور قبل"}
              </span>
            </div>
            <div className="font-mono font-bold text-xs shrink-0 flex items-center gap-1 dir-ltr">
              <span>{hasScore ? sc.away : "—"}</span>
              {sc?.awayPenalty !== null && sc?.awayPenalty !== undefined && (
                <span className="text-[10px] text-ink/60">({sc.awayPenalty})</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KnockoutPrintSchedule({
  knockout,
  scores,
  matchDetails,
}: {
  knockout: any;
  scores: Record<string, MatchScore>;
  matchDetails?: Record<string, MatchScheduleDetail>;
}) {
  if (!knockout || !knockout.rounds) return null;

  return (
    <div className="space-y-5 print-avoid-break">
      <div className="border-b-2 border-pitch pb-2">
        <h2 className="text-base font-black text-pitch flex items-center gap-2">
          <span>🏆</span>
          <span>برنامه مرحله حذفی مسابقات (مرحله به مرحله)</span>
        </h2>
        <p className="text-[11px] text-ink/60 mt-0.5">
          کلیه مراحل حذفی، مسابقات، نتایج و وضعیت صعود تیم‌ها به تفکیک دور
        </p>
      </div>

      {knockout.rounds.map((round: any) => (
        <div key={round.round} className="space-y-2 print-avoid-break">
          <div className="bg-pitch/10 text-pitch border-r-4 border-pitch font-bold text-xs py-1.5 px-3 rounded-l flex items-center justify-between">
            <span className="font-extrabold">{round.label}</span>
            <span className="text-[10px] text-ink/60 font-medium">
              تعداد بازی‌ها: {round.matches?.length || 0}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {round.matches.map((m: any) =>
              renderPrintMatchCard(m, scores, matchDetails)
            )}
          </div>
        </div>
      ))}

      {knockout.thirdPlaceMatch && (
        <div className="space-y-2 print-avoid-break">
          <div className="bg-amber-100/90 text-amber-950 border-r-4 border-amber-600 font-bold text-xs py-1.5 px-3 rounded-l flex items-center justify-between">
            <span className="font-extrabold">🥉 مسابقه رده‌بندی (تعیین مقام سوم و چهارم)</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {renderPrintMatchCard(
              knockout.thirdPlaceMatch,
              scores,
              matchDetails,
              "دیدار رده‌بندی"
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DoubleKnockoutPrintSchedule({
  doubleKnockout,
  scores,
  matchDetails,
}: {
  doubleKnockout: DoubleKnockoutResult;
  scores: Record<string, MatchScore>;
  matchDetails?: Record<string, MatchScheduleDetail>;
}) {
  if (!doubleKnockout) return null;

  return (
    <div className="space-y-6 print-avoid-break">
      <div className="border-b-2 border-pitch pb-2">
        <h2 className="text-base font-black text-pitch flex items-center gap-2">
          <span>🛡️</span>
          <span>برنامه مرحله حذفی تورنمنت دو حذفی (Double Elimination)</span>
        </h2>
        <p className="text-[11px] text-ink/60 mt-0.5">
          تفکیک کامل جدول برندگان (Winners)، شانس مجدد (Losers) و فینال نهایی (Grand Final)
        </p>
      </div>

      {/* Winners Bracket */}
      <div className="space-y-3 print-avoid-break">
        <div className="bg-pitch/15 text-pitch font-black text-xs py-1.5 px-3 rounded flex items-center justify-between">
          <span>🏆 جدول برندگان (Winners Bracket)</span>
          <span className="text-[10px] text-pitch/70 font-normal">
            {doubleKnockout.winnersBracket?.length || 0} دور
          </span>
        </div>
        {doubleKnockout.winnersBracket?.map((round) => (
          <div key={round.round} className="space-y-2 print-avoid-break">
            <div className="bg-pitch/5 text-pitch font-bold text-[11px] py-1 px-2.5 rounded-l border-r-2 border-pitch">
              {round.label}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {round.matches.map((m) =>
                renderPrintMatchCard(m, scores, matchDetails)
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Losers Bracket */}
      <div className="space-y-3 print-avoid-break">
        <div className="bg-amber-100 text-amber-950 font-black text-xs py-1.5 px-3 rounded flex items-center justify-between">
          <span>🛡️ جدول شانس مجدد / بازندگان (Losers Bracket)</span>
          <span className="text-[10px] text-amber-900/70 font-normal">
            {doubleKnockout.losersBracket?.length || 0} دور
          </span>
        </div>
        {doubleKnockout.losersBracket?.map((round) => (
          <div key={round.round} className="space-y-2 print-avoid-break">
            <div className="bg-amber-50 text-amber-950 font-bold text-[11px] py-1 px-2.5 rounded-l border-r-2 border-amber-600">
              {round.label}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {round.matches.map((m) =>
                renderPrintMatchCard(m, scores, matchDetails)
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Finals */}
      {(doubleKnockout.grandFinal || doubleKnockout.bracketResetMatch) && (
        <div className="space-y-3 print-avoid-break">
          <div className="bg-gold/25 text-pitch font-black text-xs py-1.5 px-3 rounded flex items-center justify-between border border-gold/40">
            <span>👑 فینال نهایی مسابقات (Grand Final)</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {doubleKnockout.grandFinal &&
              renderPrintMatchCard(
                doubleKnockout.grandFinal,
                scores,
                matchDetails,
                "فینال اصلی مسابقات"
              )}
            {doubleKnockout.bracketResetMatch &&
              renderPrintMatchCard(
                doubleKnockout.bracketResetMatch,
                scores,
                matchDetails,
                "مسابقه راند برگشت / تعیین سرنوشت (Bracket Reset)"
              )}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   INTERACTIVE KNOCKOUT BRACKET WITH PENALTIES & 3RD PLACE
   ========================================================= */

function InteractiveBracket({
  originalKnockout,
  groups,
  pointsRule,
  scores,
  onScoreChange,
  matchDetails,
  onOpenEditModal,
  filterTeam,
  printBracketStyle = "stages",
}: {
  originalKnockout: ScheduleResult extends { knockout: infer K } ? K : any;
  groups?: GroupResult[];
  pointsRule?: PointsRule;
  scores: Record<string, MatchScore>;
  onScoreChange: (
    matchId: string,
    home: number | null,
    away: number | null,
    homePenalty?: number | null,
    awayPenalty?: number | null,
    winner?: string | null
  ) => void;
  matchDetails?: Record<string, MatchScheduleDetail>;
  onOpenEditModal?: (id: string, home: string, away: string) => void;
  filterTeam?: string;
  printBracketStyle?: "tree" | "stages" | "both";
}) {
  const { knockout, champion, runnerUp, thirdPlace } = useMemo(
    () => computeKnockoutWithScores(originalKnockout, scores, groups, pointsRule),
    [originalKnockout, scores, groups, pointsRule]
  );

  const allMatches = useMemo(() => {
    const list: any[] = [];
    if (knockout?.rounds) {
      for (const r of knockout.rounds) {
        if (r.matches) list.push(...r.matches);
      }
    }
    if (knockout?.thirdPlaceMatch) {
      list.push(knockout.thirdPlaceMatch);
    }
    return list;
  }, [knockout]);

  const checkDownstreamPlayed = useCallback(
    (matchId: string) => {
      return findPlayedDownstreamMatch(matchId, allMatches, scores);
    },
    [allMatches, scores]
  );

  const [layoutMode, setLayoutMode] = useState<"cards" | "tree">("cards");

  return (
    <div className="space-y-8 w-full">
      {/* Celebration Podium */}
      {champion && (
        <div className="rounded-xl border-2 border-gold bg-gradient-to-r from-gold/15 via-gold/25 to-gold/15 p-6 shadow-md text-center animate-fade-in print-avoid-break">
          <p className="text-xs uppercase tracking-widest text-gold-dark font-extrabold mb-1">
            🏆 سکوی قهرمانی مسابقات
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 mt-4">
            {runnerUp && (
              <div className="flex flex-col items-center">
                <span className="text-2xl">🥈</span>
                <span className="text-xs font-semibold text-ink/60 mt-1">نایب‌قهرمان</span>
                <span className="font-bold text-sm text-ink">{runnerUp}</span>
              </div>
            )}
            <div className="flex flex-col items-center px-6 py-2 rounded-xl bg-white/70 border border-gold/40 shadow-sm">
              <span className="text-4xl">👑</span>
              <span className="text-xs font-extrabold text-gold-dark mt-1">قهرمان تورنمنت</span>
              <span className="text-2xl font-black text-pitch mt-0.5">{champion}</span>
            </div>
            {thirdPlace && (
              <div className="flex flex-col items-center">
                <span className="text-2xl">🥉</span>
                <span className="text-xs font-semibold text-ink/60 mt-1">مقام سوم</span>
                <span className="font-bold text-sm text-ink">{thirdPlace}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {knockout.byes > 0 && (
        <p className="text-xs text-ink/60">
          💡 به دلیل تعداد تیم‌ها، {knockout.byes} تیم برتر دارای استراحت (Bye) در دور اول هستند و
          مستقیماً صعود می‌کنند.
        </p>
      )}

      {/* View Switcher: Cards (Full Screen) vs Tree Bracket */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white/80 p-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-pitch">نحوه نمایش مسابقات:</span>
          <div className="inline-flex rounded-lg border border-line bg-chalk/80 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setLayoutMode("cards")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 transition-all cursor-pointer ${
                layoutMode === "cards"
                  ? "bg-pitch text-chalk shadow-xs font-bold"
                  : "text-ink/70 hover:text-ink"
              }`}
            >
              <span>🗂️</span>
              <span>نمایش کارتی مسابقات (تمام‌صفحه)</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("tree")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 transition-all cursor-pointer ${
                layoutMode === "tree"
                  ? "bg-pitch text-chalk shadow-xs font-bold"
                  : "text-ink/70 hover:text-ink"
              }`}
            >
              <span>🌳</span>
              <span>نمودار درختی براکت حذفی</span>
            </button>
          </div>
        </div>
        <span className="text-xs text-ink/60 hidden sm:inline">
          {layoutMode === "cards"
            ? "نمایش مرحله به مرحله در قالب کارت‌های جادار و تعاملی در تمام عرض صفحه"
            : "نمودار درختی استاندارد مسابقات حذفی"}
        </span>
      </div>

      {/* 1. CARDS VIEW (FULL SCREEN RESPONSIVE GRID) */}
      <div className={layoutMode === "cards" ? "space-y-6 w-full" : "hidden"}>
        {knockout.rounds.map((round: any, roundIdx: number) => {
          const isFinal = roundIdx === knockout.rounds.length - 1;
          const visibleMatches =
            filterTeam && filterTeam !== "all"
              ? round.matches.filter((m: any) => m.home === filterTeam || m.away === filterTeam)
              : round.matches;

          if (filterTeam && filterTeam !== "all" && visibleMatches.length === 0) {
            return null;
          }

          return (
            <div
              key={round.round}
              className="rounded-2xl border border-line bg-white/80 p-4 sm:p-5 shadow-xs space-y-4 print-avoid-break w-full"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{isFinal ? "👑" : "🏆"}</span>
                  <h3 className="font-black text-base text-pitch">{round.label}</h3>
                </div>
                <span className="rounded-full bg-pitch/10 text-pitch font-bold px-3 py-1 text-xs">
                  {visibleMatches.length} مسابقه
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
                {visibleMatches.map((m: any) => (
                  <MatchBracketCard
                    key={m.id}
                    match={m}
                    scores={scores}
                    isFinal={isFinal}
                    onScoreChange={onScoreChange}
                    matchDetails={matchDetails}
                    onOpenEditModal={onOpenEditModal}
                    filterTeam={filterTeam}
                    checkDownstreamPlayed={checkDownstreamPlayed}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Third Place in Cards View */}
        {knockout.thirdPlaceMatch && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50/40 p-4 sm:p-5 shadow-xs space-y-4 print-avoid-break w-full">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🥉</span>
                <h3 className="font-black text-base text-amber-950">
                  مسابقه رده‌بندی (تعیین مقام سوم و چهارم)
                </h3>
              </div>
              {thirdPlace && (
                <span className="rounded-full bg-amber-200 text-amber-950 font-bold px-3 py-1 text-xs">
                  برنده مقام سوم: {thirdPlace}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
              <MatchBracketCard
                match={knockout.thirdPlaceMatch}
                scores={scores}
                isFinal={false}
                onScoreChange={onScoreChange}
                label="دیدار رده‌بندی"
                matchDetails={matchDetails}
                onOpenEditModal={onOpenEditModal}
                filterTeam={filterTeam}
                checkDownstreamPlayed={checkDownstreamPlayed}
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. TREE VIEW */}
      <div className={layoutMode === "tree" ? "space-y-6" : "hidden"}>
        {/* Main Bracket Columns (Tree View) */}
        <div
          className={`bracket-tree-container overflow-x-auto pb-4 pt-2 ${
            printBracketStyle === "stages"
              ? "print:hidden"
              : "print:overflow-visible print:p-0 print:m-0"
          }`}
        >
          <div className="flex gap-6 print:gap-1.5 print:w-full print:justify-between">
            {knockout.rounds.map((round: any, roundIdx: number) => {
              const isFinal = roundIdx === knockout.rounds.length - 1;
              return (
                <div
                  key={round.round}
                  className="bracket-column flex min-w-[270px] max-w-[290px] flex-col justify-around gap-6 print:min-w-0 print:flex-1 print:gap-2 print-avoid-break"
                >
                  <div className="text-center rounded-md bg-pitch/10 py-1.5 px-3 print:py-0.5 print:px-1">
                    <p className="text-xs font-bold text-pitch print:text-[10px]">{round.label}</p>
                  </div>

                  <div className="flex flex-col justify-around gap-8 flex-1 print:gap-2">
                    {round.matches.map((m: any) => (
                      <MatchBracketCard
                        key={m.id}
                        match={m}
                        scores={scores}
                        isFinal={isFinal}
                        onScoreChange={onScoreChange}
                        matchDetails={matchDetails}
                        onOpenEditModal={onOpenEditModal}
                        filterTeam={filterTeam}
                        checkDownstreamPlayed={checkDownstreamPlayed}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Third Place Match (if configured) in tree mode */}
        {knockout.thirdPlaceMatch && (
          <div
            className={`border-t border-line pt-6 print:pt-3 print-avoid-break ${
              printBracketStyle === "stages" ? "print:hidden" : ""
            }`}
          >
            <div className="mb-3 flex items-center justify-between print:mb-1">
              <h3 className="font-bold text-sm text-pitch flex items-center gap-1.5 print:text-xs">
                <span>🥉 مسابقه رده‌بندی</span>
                <span className="text-xs text-ink/50 font-normal print:text-[10px]">(تعیین مقام سوم و چهارم)</span>
              </h3>
              {thirdPlace && (
                <span className="text-xs font-bold text-pitch bg-pitch/10 px-2 py-0.5 rounded print:text-[10px]">
                  برنده مقام سوم: {thirdPlace}
                </span>
              )}
            </div>
            <div className="max-w-sm print:max-w-none">
              <MatchBracketCard
                match={knockout.thirdPlaceMatch}
                scores={scores}
                isFinal={false}
                onScoreChange={onScoreChange}
                label="دیدار رده‌بندی"
                matchDetails={matchDetails}
                onOpenEditModal={onOpenEditModal}
                filterTeam={filterTeam}
                checkDownstreamPlayed={checkDownstreamPlayed}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stage-by-Stage Printable Schedule Cards (for 100% clean, non-clipped printing across any number of pages) */}
      {(printBracketStyle === "stages" || printBracketStyle === "both" || !printBracketStyle) && (
        <div className="hidden print:block space-y-4">
          <KnockoutPrintSchedule
            knockout={knockout}
            scores={scores}
            matchDetails={matchDetails}
          />
        </div>
      )}
    </div>
  );
}

function InteractiveDoubleKnockoutBracket({
  originalDoubleKnockout,
  scores,
  onScoreChange,
  matchDetails,
  onOpenEditModal,
  filterTeam,
  printBracketStyle = "stages",
}: {
  originalDoubleKnockout: DoubleKnockoutResult;
  scores: Record<string, MatchScore>;
  onScoreChange: (
    matchId: string,
    home: number | null,
    away: number | null,
    homePenalty?: number | null,
    awayPenalty?: number | null,
    winner?: string | null
  ) => void;
  matchDetails?: Record<string, MatchScheduleDetail>;
  onOpenEditModal?: (id: string, home: string, away: string) => void;
  filterTeam?: string;
  printBracketStyle?: "tree" | "stages" | "both";
}) {
  const [bracketView, setBracketView] = useState<"all" | "winners" | "losers" | "finals">("all");
  const [layoutMode, setLayoutMode] = useState<"cards" | "tree">("cards");

  const { doubleKnockout, champion, runnerUp, thirdPlace } = useMemo(
    () => computeDoubleKnockoutWithScores(originalDoubleKnockout, scores),
    [originalDoubleKnockout, scores]
  );

  const activeLbRoundLabel = useMemo(() => {
    for (const r of doubleKnockout.losersBracket) {
      const hasUnfinishedPlayable = r.matches.some(
        (m) =>
          !m.isBye &&
          !m.autoAdvance &&
          m.home &&
          m.away &&
          m.home !== "BYE" &&
          m.away !== "BYE" &&
          !m.winner
      );
      if (hasUnfinishedPlayable) {
        return r.label;
      }
    }
    return null;
  }, [doubleKnockout.losersBracket]);

  const allMatches = useMemo(() => {
    const list: any[] = [];
    if (doubleKnockout?.winnersBracket) {
      for (const r of doubleKnockout.winnersBracket) {
        if (r.matches) list.push(...r.matches);
      }
    }
    if (doubleKnockout?.losersBracket) {
      for (const r of doubleKnockout.losersBracket) {
        if (r.matches) list.push(...r.matches);
      }
    }
    if (doubleKnockout?.grandFinal) {
      list.push(doubleKnockout.grandFinal);
    }
    if (doubleKnockout?.bracketResetMatch) {
      list.push(doubleKnockout.bracketResetMatch);
    }
    return list;
  }, [doubleKnockout]);

  const checkDownstreamPlayed = useCallback(
    (matchId: string) => {
      return findPlayedDownstreamMatch(matchId, allMatches, scores);
    },
    [allMatches, scores]
  );

  return (
    <div className="space-y-8">
      {/* Celebration Podium */}
      {champion && (
        <div className="rounded-xl border-2 border-gold bg-gradient-to-r from-gold/15 via-gold/25 to-gold/15 p-6 shadow-md text-center animate-fade-in print-avoid-break">
          <p className="text-xs uppercase tracking-widest text-gold-dark font-extrabold mb-1">
            🏆 سکوی قهرمانی مسابقات دو حذفی
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 mt-4">
            {runnerUp && (
              <div className="flex flex-col items-center">
                <span className="text-2xl">🥈</span>
                <span className="text-xs font-semibold text-ink/60 mt-1">نایب‌قهرمان</span>
                <span className="font-bold text-sm text-ink">{runnerUp}</span>
              </div>
            )}
            <div className="flex flex-col items-center px-6 py-2 rounded-xl bg-white/70 border border-gold/40 shadow-sm">
              <span className="text-4xl">👑</span>
              <span className="text-xs font-extrabold text-gold-dark mt-1">قهرمان تورنمنت دو حذفی</span>
              <span className="text-2xl font-black text-pitch mt-0.5">{champion}</span>
            </div>
            {thirdPlace && (
              <div className="flex flex-col items-center">
                <span className="text-2xl">🥉</span>
                <span className="text-xs font-semibold text-ink/60 mt-1">مقام سوم (فینالیست بازندگان)</span>
                <span className="font-bold text-sm text-ink">{thirdPlace}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Switcher: Cards (Full Screen) vs Tree Bracket */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white/80 p-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-pitch">نحوه نمایش مسابقات دو حذفی:</span>
          <div className="inline-flex rounded-lg border border-line bg-chalk/80 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setLayoutMode("cards")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 transition-all cursor-pointer ${
                layoutMode === "cards"
                  ? "bg-pitch text-chalk shadow-xs font-bold"
                  : "text-ink/70 hover:text-ink"
              }`}
            >
              <span>🗂️</span>
              <span>نمایش کارتی مسابقات (تمام‌صفحه)</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("tree")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 transition-all cursor-pointer ${
                layoutMode === "tree"
                  ? "bg-pitch text-chalk shadow-xs font-bold"
                  : "text-ink/70 hover:text-ink"
              }`}
            >
              <span>🌳</span>
              <span>نمودار درختی تورنمنت</span>
            </button>
          </div>
        </div>
        <span className="text-xs text-ink/60 hidden sm:inline">
          {layoutMode === "cards"
            ? "نمایش مسابقات در کارت‌های جادار و گسترده در تمام عرض صفحه"
            : "نمودار درختی دو حذفی"}
        </span>
      </div>

      {/* View Filter Buttons */}
      <div className="no-print flex flex-wrap items-center gap-2 border-b border-line pb-3">
        {[
          { key: "all" as const, label: "نمایش همه بخش‌ها" },
          { key: "winners" as const, label: "🏆 جدول برندگان (Winners Bracket)" },
          { key: "losers" as const, label: "🛡️ جدول شانس مجدد (Losers Bracket)" },
          { key: "finals" as const, label: "👑 فینال نهایی مسابقات" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setBracketView(tab.key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              bracketView === tab.key
                ? "bg-pitch text-chalk shadow-sm"
                : "bg-line/40 text-ink/70 hover:bg-line"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Double Knockout Interactive Guide & Clarification */}
      <div className="no-print rounded-xl border border-line bg-white/90 p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">💡</span>
          <h4 className="text-xs font-black text-pitch">
            راهنمای شفاف و آسان تورنمنت دو حذفی (Double Elimination):
          </h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-ink/80">
          <div className="rounded-lg bg-emerald-50/80 border border-emerald-200/80 p-3 space-y-1">
            <p className="font-bold text-emerald-950 flex items-center gap-1.5 text-xs">
              <span>🏆</span>
              <span>جدول برندگان (کدهای W)</span>
            </p>
            <p className="leading-5">
              همه تیم‌ها از این جدول شروع می‌کنند. هر تیمی ببرد به دور بعد می‌رود، و هر تیمی ببازد <b>حذف نمی‌شود</b> بلکه به جدول شانس مجدد منتقل می‌شود.
            </p>
          </div>
          <div className="rounded-lg bg-amber-50/80 border border-amber-200/80 p-3 space-y-1">
            <p className="font-bold text-amber-950 flex items-center gap-1.5 text-xs">
              <span>🛡️</span>
              <span>جدول شانس مجدد (کدهای L)</span>
            </p>
            <p className="leading-5">
              تیم‌هایی که یک باخت داده‌اند در این جدول برای ماندن در تورنمنت می‌جنگند. در این جدول هر باخت مساوی حذف قطعی است، ولی قهرمان این بخش به فینال نهایی می‌رسد.
            </p>
          </div>
          <div className="rounded-lg bg-gold/15 border border-gold/40 p-3 space-y-1">
            <p className="font-bold text-pitch flex items-center gap-1.5 text-xs">
              <span>👑</span>
              <span>فینال بزرگ (Grand Final)</span>
            </p>
            <p className="leading-5">
              مسابقه نهایی میان قهرمان جدول برندگان و قهرمان جدول شانس مجدد برگزار می‌شود تا قهرمان کل تورنمنت تعیین شود.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[10px] text-ink/65 pt-1 border-t border-line/40">
          <span className="font-bold text-pitch">تفاوت وضعیت‌ها در جدول:</span>
          <span className="text-emerald-800">
            🟢 <b>استراحت (Bye):</b> تیم به دلیل قرعه، بدون نیاز به بازی مستقیماً راهی دور بعد شده است.
          </span>
          <span className="text-amber-800">
            ⏳ <b>در انتظار حریف:</b> بازی هنوز آماده نیست و پس از پایان مسابقه قبلی فعال می‌شود.
          </span>
        </div>
      </div>

      {/* Section 1: Winners Bracket */}
      {(bracketView === "all" || bracketView === "winners") && (
        <div
          className={`rounded-2xl border border-line bg-chalk/30 p-5 space-y-4 print-avoid-break w-full ${
            printBracketStyle === "stages" ? "print:hidden" : "print:overflow-visible print:p-2"
          }`}
        >
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h3 className="font-black text-base text-pitch flex items-center gap-2">
                <span>🏆</span>
                <span>جدول برندگان (Winners Bracket)</span>
              </h3>
              <p className="text-xs text-ink/60 mt-0.5">
                تیم‌هایی که در این جدول پیروز می‌شوند به مراحل بالاتر صعود می‌کنند؛ تیم بازنده مستقیماً به جدول شانس مجدد منتقل می‌شود.
              </p>
            </div>
            <span className="text-xs font-bold bg-pitch/10 text-pitch px-2.5 py-1 rounded-full">
              {doubleKnockout.winnersBracket.length} دور مسابقه
            </span>
          </div>

          {layoutMode === "cards" ? (
            <div className="space-y-6 w-full">
              {doubleKnockout.winnersBracket.map((round, rIdx) => {
                const isFinal = rIdx === doubleKnockout.winnersBracket.length - 1;
                const visibleMatches =
                  filterTeam && filterTeam !== "all"
                    ? round.matches.filter((m) => m.home === filterTeam || m.away === filterTeam)
                    : round.matches;

                if (filterTeam && filterTeam !== "all" && visibleMatches.length === 0) return null;

                return (
                  <div
                    key={round.round}
                    className="rounded-xl border border-line/80 bg-white/90 p-4 space-y-3 shadow-2xs w-full"
                  >
                    <div className="flex items-center justify-between border-b border-line/60 pb-2">
                      <span className="font-extrabold text-sm text-pitch">{round.label}</span>
                      <span className="text-xs font-semibold text-ink/50">{visibleMatches.length} مسابقه</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
                      {visibleMatches.map((m) => (
                        <MatchBracketCard
                          key={m.id}
                          match={m}
                          scores={scores}
                          isFinal={isFinal}
                          onScoreChange={onScoreChange}
                          matchDetails={matchDetails}
                          onOpenEditModal={onOpenEditModal}
                          filterTeam={filterTeam}
                          checkDownstreamPlayed={checkDownstreamPlayed}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bracket-tree-container flex gap-6 overflow-x-auto pb-4 pt-2 print:gap-1.5 print:w-full print:justify-between print:overflow-visible">
              {doubleKnockout.winnersBracket.map((round, rIdx) => {
                const isFinal = rIdx === doubleKnockout.winnersBracket.length - 1;
                return (
                  <div
                    key={round.round}
                    className="bracket-column flex min-w-[270px] max-w-[290px] flex-col justify-around gap-6 print:min-w-0 print:flex-1 print:gap-2 print-avoid-break"
                  >
                    <div className="text-center rounded-md bg-pitch/10 py-1.5 px-3 print:py-0.5 print:px-1">
                      <p className="text-xs font-bold text-pitch print:text-[10px]">{round.label}</p>
                    </div>

                    <div className="flex flex-col justify-around gap-8 flex-1 print:gap-2">
                      {round.matches.map((m) => (
                        <MatchBracketCard
                          key={m.id}
                          match={m}
                          scores={scores}
                          isFinal={isFinal}
                          onScoreChange={onScoreChange}
                          matchDetails={matchDetails}
                          onOpenEditModal={onOpenEditModal}
                          filterTeam={filterTeam}
                          checkDownstreamPlayed={checkDownstreamPlayed}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Section 2: Losers Bracket */}
      {(bracketView === "all" || bracketView === "losers") && (
        <div
          className={`rounded-2xl border border-amber-600/30 bg-amber-50/30 p-5 space-y-4 print-avoid-break w-full ${
            printBracketStyle === "stages" ? "print:hidden" : "print:overflow-visible print:p-2"
          }`}
        >
          <div className="flex items-center justify-between border-b border-amber-600/20 pb-3">
            <div>
              <h3 className="font-black text-base text-amber-900 flex items-center gap-2">
                <span>🛡️</span>
                <span>جدول شانس مجدد / بازندگان (Losers Bracket)</span>
              </h3>
              <p className="text-xs text-ink/60 mt-0.5">
                تیم‌هایی که یک‌بار در جدول برندگان شکست خورده‌اند در این جدول بازی می‌کنند. قهرمان این جدول به فینال نهایی تورنمنت راه می‌یابد.
              </p>
            </div>
            <span className="text-xs font-bold bg-amber-600/10 text-amber-900 px-2.5 py-1 rounded-full">
              {doubleKnockout.losersBracket.length} دور مسابقه
            </span>
          </div>

          {/* Guide & Active Round Indicator */}
          <div className="no-print rounded-lg border border-amber-300/80 bg-amber-100/70 p-3 text-xs text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-2">
              <span className="text-base mt-0.5">💡</span>
              <div className="space-y-0.5 leading-relaxed">
                <span className="font-bold">راهنمای نحوه برگزاری جدول شانس مجدد: </span>
                <span>
                  مسابقات دور به دور برگزار می‌شوند. برای مشخص شدن رقبای دور ۲ و دورهای بعدی، ابتدا نتایج بازی‌های دور قبل شانس مجدد (دور ۱) را ثبت کنید.
                </span>
              </div>
            </div>
            {activeLbRoundLabel && (
              <div className="shrink-0 flex items-center gap-1.5 bg-white border border-amber-400 rounded-lg px-2.5 py-1 text-xs font-bold text-amber-900 shadow-2xs">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>دور فعال جهت ثبت نتیجه: {activeLbRoundLabel}</span>
              </div>
            )}
          </div>

          {layoutMode === "cards" ? (
            <div className="space-y-6 w-full">
              {doubleKnockout.losersBracket.map((round, rIdx) => {
                const isFinal = rIdx === doubleKnockout.losersBracket.length - 1;
                const visibleMatches =
                  filterTeam && filterTeam !== "all"
                    ? round.matches.filter((m) => m.home === filterTeam || m.away === filterTeam)
                    : round.matches;

                if (filterTeam && filterTeam !== "all" && visibleMatches.length === 0) return null;

                return (
                  <div
                    key={round.round}
                    className="rounded-xl border border-amber-600/20 bg-white/95 p-4 space-y-3 shadow-2xs w-full"
                  >
                    <div className="flex items-center justify-between border-b border-amber-600/20 pb-2">
                      <span className="font-extrabold text-sm text-amber-950">{round.label}</span>
                      <span className="text-xs font-semibold text-ink/50">{visibleMatches.length} مسابقه</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
                      {visibleMatches.map((m) => (
                        <MatchBracketCard
                          key={m.id}
                          match={m}
                          scores={scores}
                          isFinal={isFinal}
                          onScoreChange={onScoreChange}
                          matchDetails={matchDetails}
                          onOpenEditModal={onOpenEditModal}
                          filterTeam={filterTeam}
                          checkDownstreamPlayed={checkDownstreamPlayed}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bracket-tree-container flex gap-6 overflow-x-auto pb-4 pt-2 print:gap-1.5 print:w-full print:justify-between print:overflow-visible">
              {doubleKnockout.losersBracket.map((round, rIdx) => {
                const isFinal = rIdx === doubleKnockout.losersBracket.length - 1;
                return (
                  <div
                    key={round.round}
                    className="bracket-column flex min-w-[270px] max-w-[290px] flex-col justify-around gap-6 print:min-w-0 print:flex-1 print:gap-2 print-avoid-break"
                  >
                    <div className="text-center rounded-md bg-amber-600/15 py-1.5 px-3 print:py-0.5 print:px-1">
                      <p className="text-xs font-bold text-amber-950 print:text-[10px]">{round.label}</p>
                    </div>

                    <div className="flex flex-col justify-around gap-8 flex-1 print:gap-2">
                      {round.matches.map((m) => (
                        <MatchBracketCard
                          key={m.id}
                          match={m}
                          scores={scores}
                          isFinal={isFinal}
                          onScoreChange={onScoreChange}
                          matchDetails={matchDetails}
                          onOpenEditModal={onOpenEditModal}
                          filterTeam={filterTeam}
                          checkDownstreamPlayed={checkDownstreamPlayed}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Section 3: Grand Final */}
      {(bracketView === "all" || bracketView === "finals") && (
        <div
          className={`rounded-2xl border-2 border-gold/70 bg-white p-5 space-y-4 shadow-sm print-avoid-break w-full ${
            printBracketStyle === "stages" ? "print:hidden" : "print:p-2"
          }`}
        >
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h3 className="font-black text-base text-pitch flex items-center gap-2">
                <span>👑</span>
                <span>فینال نهایی مسابقات (Grand Final)</span>
              </h3>
              <p className="text-xs text-ink/60 mt-0.5">
                دیدار سرنوشت‌ساز میان قهرمان جدول برندگان و قهرمان جدول شانس مجدد برای تصاحب جام قهرمانی.
              </p>
            </div>
            <span className="text-xs font-bold bg-gold/20 text-ink px-2.5 py-1 rounded-full">
              مسابقه پایانی تورنمنت
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
            <div>
              <MatchBracketCard
                match={doubleKnockout.grandFinal}
                scores={scores}
                isFinal={true}
                onScoreChange={onScoreChange}
                label="فینال نهایی (Grand Final)"
                matchDetails={matchDetails}
                onOpenEditModal={onOpenEditModal}
                filterTeam={filterTeam}
                checkDownstreamPlayed={checkDownstreamPlayed}
              />
            </div>

            {doubleKnockout.bracketResetMatch && (
              <div>
                <MatchBracketCard
                  match={doubleKnockout.bracketResetMatch}
                  scores={scores}
                  isFinal={true}
                  onScoreChange={onScoreChange}
                  label="فینال مجدد (Bracket Reset)"
                  matchDetails={matchDetails}
                  onOpenEditModal={onOpenEditModal}
                  filterTeam={filterTeam}
                  checkDownstreamPlayed={checkDownstreamPlayed}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stage-by-Stage Printable Schedule Cards (for 100% clean, non-clipped printing across any number of pages) */}
      {(printBracketStyle === "stages" || printBracketStyle === "both" || !printBracketStyle) && (
        <div className="hidden print:block space-y-4">
          <DoubleKnockoutPrintSchedule
            doubleKnockout={doubleKnockout}
            scores={scores}
            matchDetails={matchDetails}
          />
        </div>
      )}
    </div>
  );
}

function MatchBracketCard({
  match: m,
  scores,
  isFinal,
  onScoreChange,
  label,
  matchDetails,
  onOpenEditModal,
  filterTeam,
  checkDownstreamPlayed,
}: {
  match: any;
  scores: Record<string, MatchScore>;
  isFinal: boolean;
  onScoreChange: (
    matchId: string,
    home: number | null,
    away: number | null,
    homePenalty?: number | null,
    awayPenalty?: number | null,
    winner?: string | null
  ) => void;
  label?: string;
  matchDetails?: Record<string, MatchScheduleDetail>;
  onOpenEditModal?: (id: string, home: string, away: string) => void;
  filterTeam?: string;
  checkDownstreamPlayed?: (matchId: string) => any;
}) {
  const sc = scores[m.id] || {
    home: m.homeScore ?? null,
    away: m.awayScore ?? null,
    homePenalty: m.homePenalty ?? null,
    awayPenalty: m.awayPenalty ?? null,
    winner: m.winner ?? null,
  };

  // 1. Status classification:
  // Empty double-bye match: Neither side had participants due to byes on both feeder sides
  const isEmptyDoubleBye = Boolean(m.isBye && !m.autoAdvance && !m.home && !m.away);

  // Single team Bye: One team advances automatically due to odd teams / seeding / opponent bye
  const isSingleBye = Boolean((m.isBye || m.autoAdvance) && !isEmptyDoubleBye);

  // Real teams (must not be BYE, empty, or group/seed placeholder):
  const isHomeReal = Boolean(m.home && !isPlaceholderTeam(m.home));
  const isAwayReal = Boolean(m.away && !isPlaceholderTeam(m.away));

  // Ready to play: Both teams are known and it's NOT a Bye
  const isReadyToPlay = !isEmptyDoubleBye && !isSingleBye && isHomeReal && isAwayReal;

  // Pending: Still waiting for one or both teams to arrive from previous match
  const isPending = !isEmptyDoubleBye && !isSingleBye && (!isHomeReal || !isAwayReal);
  const isPartiallyKnown = isPending && ((isHomeReal && !isAwayReal) || (!isHomeReal && isAwayReal));
  const knownTeam = isHomeReal ? m.home : isAwayReal ? m.away : null;
  const missingPlaceholder = !isHomeReal ? m.homePlaceholder : m.awayPlaceholder;

  const isHomeWinner = m.winner && isHomeReal && m.winner === m.home;
  const isAwayWinner = m.winner && isAwayReal && m.winner === m.away;
  const isTied =
    isReadyToPlay &&
    sc.home !== null &&
    sc.away !== null &&
    sc.home === sc.away;

  const dt = matchDetails?.[m.id];
  const isFilteredTeam =
    filterTeam &&
    filterTeam !== "all" &&
    (m.home === filterTeam || m.away === filterTeam);

  // Downstream dependency protection
  const downstreamPlayed = checkDownstreamPlayed ? checkDownstreamPlayed(m.id) : null;
  const isDownstreamBlocked = Boolean(downstreamPlayed);

  const warnDownstreamPlayed = () => {
    const nextCode =
      downstreamPlayed?.matchCode ||
      downstreamPlayed?.label ||
      (downstreamPlayed?.slot !== undefined ? `بازی ${downstreamPlayed.slot + 1}` : "مرحله بعد");
    alert(
      `امکان تغییر یا لغو نتیجه این مسابقه وجود ندارد، زیرا نتیجه مسابقه مرحله بعد (${nextCode}) قبلاً ثبت شده است.\n\nلطفاً ابتدا نتیجه مسابقه مرحله بعد را پاک یا لغو نمایید.`
    );
  };

  const hasUnequalScore =
    sc.home !== null &&
    sc.away !== null &&
    sc.home !== undefined &&
    sc.away !== undefined &&
    !isNaN(Number(sc.home)) &&
    !isNaN(Number(sc.away)) &&
    Number(sc.home) !== Number(sc.away);

  const handleHomeClick = () => {
    if (!isReadyToPlay) return;

    if (isDownstreamBlocked) {
      warnDownstreamPlayed();
      return;
    }

    // When real scores are entered and unequal, the score strictly determines the winner!
    if (hasUnequalScore) {
      return;
    }

    if (isHomeWinner) {
      // Toggle unselect winner and clear match result
      onScoreChange(m.id, null, null, null, null, null);
    } else {
      // Select home team as winner
      onScoreChange(
        m.id,
        sc.home,
        sc.away,
        sc.homePenalty ?? null,
        sc.awayPenalty ?? null,
        m.home
      );
    }
  };

  const handleAwayClick = () => {
    if (!isReadyToPlay) return;

    if (isDownstreamBlocked) {
      warnDownstreamPlayed();
      return;
    }

    // When real scores are entered and unequal, the score strictly determines the winner!
    if (hasUnequalScore) {
      return;
    }

    if (isAwayWinner) {
      // Toggle unselect winner and clear match result
      onScoreChange(m.id, null, null, null, null, null);
    } else {
      // Select away team as winner
      onScoreChange(
        m.id,
        sc.home,
        sc.away,
        sc.homePenalty ?? null,
        sc.awayPenalty ?? null,
        m.away
      );
    }
  };

  const handleHomeScoreInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isDownstreamBlocked) {
      warnDownstreamPlayed();
      return;
    }
    const val =
      e.target.value === ""
        ? null
        : Math.max(0, parseInt(e.target.value) || 0);
    onScoreChange(
      m.id,
      val,
      sc.away,
      sc.homePenalty ?? null,
      sc.awayPenalty ?? null,
      undefined
    );
  };

  const handleAwayScoreInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isDownstreamBlocked) {
      warnDownstreamPlayed();
      return;
    }
    const val =
      e.target.value === ""
        ? null
        : Math.max(0, parseInt(e.target.value) || 0);
    onScoreChange(
      m.id,
      sc.home,
      val,
      sc.homePenalty ?? null,
      sc.awayPenalty ?? null,
      undefined
    );
  };

  const handleHomePenaltyInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isDownstreamBlocked) {
      warnDownstreamPlayed();
      return;
    }
    const val =
      e.target.value === ""
        ? null
        : Math.max(0, parseInt(e.target.value) || 0);
    onScoreChange(
      m.id,
      sc.home,
      sc.away,
      val,
      sc.awayPenalty ?? null,
      undefined
    );
  };

  const handleAwayPenaltyInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isDownstreamBlocked) {
      warnDownstreamPlayed();
      return;
    }
    const val =
      e.target.value === ""
        ? null
        : Math.max(0, parseInt(e.target.value) || 0);
    onScoreChange(
      m.id,
      sc.home,
      sc.away,
      sc.homePenalty ?? null,
      val,
      undefined
    );
  };
    filterTeam !== "all" &&
    (m.home === filterTeam || m.away === filterTeam);

  return (
    <div
      className={
        "rounded-lg border shadow-xs transition-all overflow-hidden print-avoid-break " +
        (isFilteredTeam ? "ring-2 ring-gold border-gold bg-gold/5 " : "") +
        (isEmptyDoubleBye
          ? "border-slate-200 bg-slate-50/40 opacity-75"
          : isPending
          ? "border-amber-200/90 bg-amber-50/20"
          : isSingleBye
          ? "border-emerald-200 bg-emerald-50/15"
          : isFinal
          ? "border-gold/80 bg-white"
          : "border-line bg-white/95")
      }
    >
      {/* Match Header */}
      <div
        className={
          "flex items-center justify-between border-b px-3 py-1.5 text-[11px] " +
          (isEmptyDoubleBye
            ? "border-slate-200 bg-slate-100/70 text-slate-700"
            : isPending
            ? "border-amber-200/80 bg-amber-50/60 text-amber-900"
            : isSingleBye
            ? "border-emerald-200 bg-emerald-50/60 text-emerald-900"
            : "border-line/60 bg-chalk/70 text-ink/70")
        }
      >
        <div className="flex items-center gap-1.5 font-bold">
          {m.matchCode && (
            <span className="rounded bg-pitch/10 text-pitch px-1.5 py-0.2 text-[10px] font-mono">
              {m.matchCode}
            </span>
          )}
          <span>{label || (m.matchCode ? "" : `بازی ${m.slot + 1}`)}</span>
        </div>

        {/* State Badges */}
        {isEmptyDoubleBye && (
          <span className="rounded bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-bold border border-slate-300">
            🟢 استراحت دوطرفه (بدون بازی)
          </span>
        )}
        {isSingleBye && (
          <span className="rounded bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold border border-emerald-300">
            🟢 صعود مستقیم (Bye)
          </span>
        )}
        {isPartiallyKnown && (
          <span className="rounded bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold border border-amber-300">
            ⏳ در انتظار مشخص شدن حریف دوم
          </span>
        )}
        {isPending && !isPartiallyKnown && (
          <span className="rounded bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold border border-amber-300">
            ⏳ در انتظار مشخص شدن تیم‌ها
          </span>
        )}
        {isReadyToPlay && m.winner && (
          <button
            type="button"
            onClick={() => {
              if (isDownstreamBlocked) {
                warnDownstreamPlayed();
                return;
              }
              onScoreChange(m.id, null, null, null, null, null);
            }}
            className={
              "rounded px-2 py-0.5 text-[10px] font-bold transition-all " +
              (isDownstreamBlocked
                ? "bg-amber-100 text-amber-900 border border-amber-300 cursor-not-allowed"
                : "bg-pitch/10 text-pitch hover:bg-rose-100 hover:text-rose-700 hover:border-rose-300 border border-pitch/20 cursor-pointer")
            }
            title={
              isDownstreamBlocked
                ? `امکان لغو یا تغییر وجود ندارد؛ ابتدا نتیجه مسابقه مرحله بعد (${downstreamPlayed?.matchCode || "مرحله بعد"}) را پاک کنید`
                : "کلیک برای لغو برنده و پاک کردن نتیجه این مسابقه"
            }
          >
            ✓ برنده: {m.winner}
            {!isDownstreamBlocked ? (
              <span className="mr-1 text-[9px] opacity-75 font-normal">
                (لغو ✕)
              </span>
            ) : (
              <span className="mr-1 text-[9px] font-normal">🔒</span>
            )}
          </button>
        )}
        {isReadyToPlay && !m.winner && (
          <span className="rounded bg-sky-100 text-sky-800 px-2 py-0.5 text-[10px] font-bold border border-sky-300">
            ⚽ آماده ثبت نتیجه
          </span>
        )}
      </div>

      {/* Pending / Bye explanation banner */}
      {isEmptyDoubleBye && (
        <div className="bg-slate-100/60 border-b border-slate-200 px-3 py-1 text-[10px] text-slate-700 flex items-center gap-1.5">
          <span>⚡</span>
          <span>این مسابقه به دلیل قرعه استراحت نیازی به برگزاری ندارد.</span>
        </div>
      )}
      {isSingleBye && (
        <div className="bg-emerald-100/40 border-b border-emerald-200/50 px-3 py-1 text-[10px] text-emerald-900 flex items-center gap-1.5">
          <span>⚡</span>
          <span>
            {m.autoAdvance
              ? `تیم «${m.autoAdvance}» با قرعه استراحت مستقیماً به دور بعد صعود کرد.`
              : "این مسابقه با قرعه استراحت مستقیم سپری شد."}
          </span>
        </div>
      )}
      {isPartiallyKnown && (
        <div className="bg-amber-100/40 border-b border-amber-200/50 px-3 py-1 text-[10px] text-amber-900 flex items-center gap-1.5">
          <span>🔒</span>
          <span>
            تیم «{knownTeam}» آماده است و منتظر مشخص شدن {missingPlaceholder || "حریف مقابل"} می‌باشد.
          </span>
        </div>
      )}
      {isPending && !isPartiallyKnown && (
        <div className="bg-amber-100/40 border-b border-amber-200/50 px-3 py-1 text-[10px] text-amber-900 flex items-center gap-1.5">
          <span>🔒</span>
          <span>هر دو حریف این مسابقه پس از پایان بازی‌های دور قبل مشخص خواهند شد.</span>
        </div>
      )}

      {/* Home Team Row */}
      <div
        className={
          "flex items-center justify-between px-3 py-2 border-b border-line/40 transition-colors " +
          (isHomeWinner ? "bg-pitch/10 font-bold text-pitch" : "")
        }
      >
        {isHomeReal ? (
          <div className="flex items-center justify-between flex-1 gap-2">
            <button
              type="button"
              onClick={handleHomeClick}
              disabled={!isReadyToPlay || hasUnequalScore}
              className={
                "text-right flex-1 truncate text-xs font-semibold transition-colors " +
                (isReadyToPlay
                  ? isDownstreamBlocked
                    ? "cursor-not-allowed text-ink hover:text-amber-800"
                    : hasUnequalScore
                    ? isHomeWinner
                      ? "text-pitch cursor-default font-bold"
                      : "text-ink/60 cursor-default"
                    : isHomeWinner
                    ? "text-pitch cursor-pointer hover:text-rose-700"
                    : "hover:text-pitch cursor-pointer text-ink"
                  : "cursor-default text-ink")
              }
              title={
                !isReadyToPlay
                  ? "امکان تعیین برنده تا مشخص شدن حریف غیرفعال است"
                  : isDownstreamBlocked
                  ? `امکان تغییر وجود ندارد؛ ابتدا نتیجه مسابقه مرحله بعد (${downstreamPlayed?.matchCode || "مرحله بعد"}) را پاک کنید`
                  : hasUnequalScore
                  ? `برنده مسابقه مستقیماً با نتیجه گل‌ها تعیین شده است`
                  : isHomeWinner
                  ? `کلیک برای لغو انتخاب ${m.home} به عنوان برنده`
                  : `کلیک برای انتخاب مستقیم ${m.home} به عنوان برنده`
              }
            >
              <span>{m.home}</span>
              {isHomeWinner && !isDownstreamBlocked && (
                <span className="mr-1.5 inline-block text-[9px] text-pitch font-bold bg-pitch/10 border border-pitch/20 rounded px-1.5 py-0.2">
                  ✓ برنده {hasUnequalScore ? "" : "(کلیک برای لغو)"}
                </span>
              )}
              {isHomeWinner && isDownstreamBlocked && (
                <span className="mr-1.5 inline-block text-[9px] text-amber-900 font-bold bg-amber-100 border border-amber-300 rounded px-1.5 py-0.2">
                  🔒 قفل‌شده
                </span>
              )}
              {isSingleBye && m.autoAdvance === m.home && (
                <span className="mr-1.5 inline-block text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.2">
                  ✓ صعود مستقیم
                </span>
              )}
              {isPartiallyKnown && isHomeReal && (
                <span className="mr-1.5 inline-block text-[10px] text-amber-800 font-medium bg-amber-100/70 border border-amber-300 rounded px-1.5 py-0.2">
                  حضور قطعی
                </span>
              )}
            </button>

            {isReadyToPlay && (
              <input
                type="number"
                min="0"
                max="99"
                value={
                  sc.home !== null && sc.home !== undefined ? sc.home : ""
                }
                onChange={handleHomeScoreInput}
                placeholder="-"
                className={
                  "w-9 h-7 text-center text-xs font-bold rounded border bg-white focus:outline-none " +
                  (isDownstreamBlocked
                    ? "border-amber-300 bg-amber-50/50 cursor-not-allowed"
                    : "border-line focus:border-gold")
                }
                title={
                  isDownstreamBlocked
                    ? `نتیجه مسابقه مرحله بعد ثبت شده است؛ ابتدا آن را پاک کنید`
                    : undefined
                }
              />
            )}
          </div>
        ) : isEmptyDoubleBye || (isSingleBye && !isHomeReal) ? (
          <div className="flex items-center justify-between flex-1 py-0.5 text-ink/40 italic text-xs">
            <span>— قرعه استراحت (بدون بازی) —</span>
          </div>
        ) : (
          <div className="flex items-center justify-between flex-1 py-0.5 text-xs">
            <span className="rounded bg-amber-50/80 border border-dashed border-amber-300 px-2 py-0.5 text-[11px] text-amber-900 font-medium">
              ⏳ {m.home || m.homePlaceholder || "در انتظار برنده بازی قبل"}
            </span>
          </div>
        )}
      </div>

      {/* Away Team Row */}
      <div
        className={
          "flex items-center justify-between px-3 py-2 transition-colors " +
          (isAwayWinner ? "bg-pitch/10 font-bold text-pitch" : "")
        }
      >
        {isAwayReal ? (
          <div className="flex items-center justify-between flex-1 gap-2">
            <button
              type="button"
              onClick={handleAwayClick}
              disabled={!isReadyToPlay || hasUnequalScore}
              className={
                "text-right flex-1 truncate text-xs font-semibold transition-colors " +
                (isReadyToPlay
                  ? isDownstreamBlocked
                    ? "cursor-not-allowed text-ink hover:text-amber-800"
                    : hasUnequalScore
                    ? isAwayWinner
                      ? "text-pitch cursor-default font-bold"
                      : "text-ink/60 cursor-default"
                    : isAwayWinner
                    ? "text-pitch cursor-pointer hover:text-rose-700"
                    : "hover:text-pitch cursor-pointer text-ink"
                  : "cursor-default text-ink")
              }
              title={
                !isReadyToPlay
                  ? "امکان تعیین برنده تا مشخص شدن حریف غیرفعال است"
                  : isDownstreamBlocked
                  ? `امکان تغییر وجود ندارد؛ ابتدا نتیجه مسابقه مرحله بعد (${downstreamPlayed?.matchCode || "مرحله بعد"}) را پاک کنید`
                  : hasUnequalScore
                  ? `برنده مسابقه مستقیماً با نتیجه گل‌ها تعیین شده است`
                  : isAwayWinner
                  ? `کلیک برای لغو انتخاب ${m.away} به عنوان برنده`
                  : `کلیک برای انتخاب مستقیم ${m.away} به عنوان برنده`
              }
            >
              <span>{m.away}</span>
              {isAwayWinner && !isDownstreamBlocked && (
                <span className="mr-1.5 inline-block text-[9px] text-pitch font-bold bg-pitch/10 border border-pitch/20 rounded px-1.5 py-0.2">
                  ✓ برنده {hasUnequalScore ? "" : "(کلیک برای لغو)"}
                </span>
              )}
              {isAwayWinner && isDownstreamBlocked && (
                <span className="mr-1.5 inline-block text-[9px] text-amber-900 font-bold bg-amber-100 border border-amber-300 rounded px-1.5 py-0.2">
                  🔒 قفل‌شده
                </span>
              )}
              {isSingleBye && m.autoAdvance === m.away && (
                <span className="mr-1.5 inline-block text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.2">
                  ✓ صعود مستقیم
                </span>
              )}
              {isPartiallyKnown && isAwayReal && (
                <span className="mr-1.5 inline-block text-[10px] text-amber-800 font-medium bg-amber-100/70 border border-amber-300 rounded px-1.5 py-0.2">
                  حضور قطعی
                </span>
              )}
            </button>

            {isReadyToPlay && (
              <input
                type="number"
                min="0"
                max="99"
                value={
                  sc.away !== null && sc.away !== undefined ? sc.away : ""
                }
                onChange={handleAwayScoreInput}
                placeholder="-"
                className={
                  "w-9 h-7 text-center text-xs font-bold rounded border bg-white focus:outline-none " +
                  (isDownstreamBlocked
                    ? "border-amber-300 bg-amber-50/50 cursor-not-allowed"
                    : "border-line focus:border-gold")
                }
                title={
                  isDownstreamBlocked
                    ? `نتیجه مسابقه مرحله بعد ثبت شده است؛ ابتدا آن را پاک کنید`
                    : undefined
                }
              />
            )}
          </div>
        ) : isEmptyDoubleBye || (isSingleBye && !isAwayReal) ? (
          <div className="flex items-center justify-between flex-1 py-0.5 text-ink/40 italic text-xs">
            <span>— قرعه استراحت (بدون بازی) —</span>
          </div>
        ) : (
          <div className="flex items-center justify-between flex-1 py-0.5 text-xs">
            <span className="rounded bg-amber-50/80 border border-dashed border-amber-300 px-2 py-0.5 text-[11px] text-amber-900 font-medium">
              ⏳ {m.away || m.awayPlaceholder || "در انتظار برنده بازی قبل"}
            </span>
          </div>
        )}
      </div>

      {/* Penalty shootout fields if tied */}
      {isTied && (
        <div className="flex items-center justify-between border-t border-gold/40 bg-gold/10 px-3 py-1.5 text-xs">
          <span className="text-[11px] font-bold text-gold-dark">
            ضربات پنالتی:
          </span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              max="99"
              value={
                sc.homePenalty !== null && sc.homePenalty !== undefined
                  ? sc.homePenalty
                  : ""
              }
              onChange={handleHomePenaltyInput}
              placeholder="میزبان"
              className={
                "w-10 h-6 text-center text-xs font-bold rounded border bg-white " +
                (isDownstreamBlocked
                  ? "border-amber-300 bg-amber-50/50 cursor-not-allowed"
                  : "border-gold/60")
              }
              title={
                isDownstreamBlocked
                  ? `نتیجه مسابقه مرحله بعد ثبت شده است؛ ابتدا آن را پاک کنید`
                  : undefined
              }
            />
            <span className="text-gold-dark font-bold">:</span>
            <input
              type="number"
              min="0"
              max="99"
              value={
                sc.awayPenalty !== null && sc.awayPenalty !== undefined
                  ? sc.awayPenalty
                  : ""
              }
              onChange={handleAwayPenaltyInput}
              placeholder="میهمان"
              className={
                "w-10 h-6 text-center text-xs font-bold rounded border bg-white " +
                (isDownstreamBlocked
                  ? "border-amber-300 bg-amber-50/50 cursor-not-allowed"
                  : "border-gold/60")
              }
              title={
                isDownstreamBlocked
                  ? `نتیجه مسابقه مرحله بعد ثبت شده است؛ ابتدا آن را پاک کنید`
                  : undefined
              }
            />
          </div>
        </div>
      )}

      {/* Routing paths for winners / losers */}
      {(m.nextMatchWinnerCode || m.nextMatchLoserCode) && (
        <div className="flex flex-wrap items-center justify-between border-t border-line/40 bg-gray-50/90 px-3 py-1 text-[10px]">
          {m.nextMatchWinnerCode && (
            <span className="text-pitch font-medium flex items-center gap-1">
              <span className="text-ink/60">برنده:</span>
              <span className="font-bold text-pitch">{m.nextMatchWinnerCode}</span>
            </span>
          )}
          {m.nextMatchLoserCode && (
            <span className="text-amber-900/90 font-medium flex items-center gap-1">
              <span className="text-ink/60">بازنده:</span>
              <span className="font-bold">{m.nextMatchLoserCode}</span>
            </span>
          )}
        </div>
      )}

      {/* Date/Time/Pitch Slot */}
      <div className="flex items-center justify-between border-t border-line/40 bg-chalk/40 px-3 py-1 text-[10px] text-ink/70">
        {dt?.date || dt?.time || dt?.pitch ? (
          <span className="truncate font-medium text-pitch">
            {[
              dt.date,
              dt.time ? `ساعت ${dt.time}` : "",
              dt.pitch ? `زمین ${dt.pitch}` : "",
            ]
              .filter(Boolean)
              .join(" | ")}
          </span>
        ) : (
          <span className="text-ink/40 print:hidden">زمان و زمین مشخص نشده</span>
        )}
        {onOpenEditModal && isReadyToPlay && (
          <button
            type="button"
            onClick={() =>
              onOpenEditModal(m.id, m.home || "نامشخص", m.away || "نامشخص")
            }
            className="no-print text-pitch font-semibold hover:underline mr-1"
          >
            {dt?.date || dt?.time || dt?.pitch ? "ویرایش" : "🕒 زمان / زمین"}
          </button>
        )}
      </div>
    </div>
  );
}
