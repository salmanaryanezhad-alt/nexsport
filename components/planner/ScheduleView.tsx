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
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card print:border-slate-300 print:p-4 print-avoid-break">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 font-black text-lg shadow-xs">
                🏆
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {meta?.title || "جدول و برنامه رسمی مسابقات"}
              </h1>
            </div>
            {meta?.venue && (
              <p className="text-xs text-slate-600 flex items-center gap-1.5 font-medium pr-1">
                <span>📍 محل برگزاری:</span>
                <span className="text-slate-900 font-bold">{meta.venue}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="no-print inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-pitch hover:from-emerald-500 hover:to-pitch-light text-white px-4 py-2.5 text-xs font-bold transition-all shadow-xs cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
              title="تنظیمات پیشرفته چاپ و دریافت فایل PDF"
            >
              <span>🖨️</span>
              <span>تنظیمات و چاپ PDF</span>
            </button>
            <div className="text-left text-xs space-y-0.5">
              <div className="flex items-center gap-1.5 font-black text-slate-800 justify-end">
                <span>سامانه برنامه‌ریزی مسابقات NexSport</span>
                <NexSportIcon size={20} className="shrink-0 drop-shadow-2xs" />
              </div>
              <div className="font-mono text-emerald-700 font-bold dir-ltr text-xs">
                https://nexsport.ir
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar (matches vs standings) */}
      {hasStandings && (
        <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("matches")}
              className={
                "px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all " +
                (activeTab === "matches"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50")
              }
            >
              ⚽ برنامه و نتایج مسابقات
            </button>
            <button
              onClick={() => setActiveTab("standings")}
              className={
                "px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-1.5 " +
                (activeTab === "standings"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50")
              }
            >
              📊 جدول رده‌بندی و امتیازات
            </button>
          </div>

          {onResetScores && Object.keys(scores).length > 0 && (
            <button
              onClick={onResetScores}
              className="text-xs text-rose-700 hover:text-rose-900 hover:underline font-bold px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200/60 transition-colors"
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
          className={`space-y-8 ${
            activeTab !== "matches" ? "print-only" : ""
          } ${printSettings.section === "standings" ? "print:hidden" : ""}`}
        >
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
    <div className="space-y-6">
      {title && <h3 className="font-bold text-pitch text-base">{title}</h3>}

      {/* Screen View: Interactive Card Grid */}
      <div className="no-print grid gap-6 sm:grid-cols-2">
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
              className="sport-card p-4 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>هفته {round.round}</span>
                </span>
                <span className="text-xs text-slate-500 font-semibold bg-slate-100 px-2.5 py-0.5 rounded-full">{visibleMatches.length} مسابقه</span>
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
                      className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs hover:border-slate-300 hover:shadow-card transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        {/* Home Team */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black shrink-0 ${
                            homeWon ? "bg-emerald-500 text-white shadow-2xs" : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}>
                            {m.home.trim().charAt(0)}
                          </span>
                          <span
                            className={
                              "truncate text-xs sm:text-sm " +
                              (homeWon ? "text-emerald-800 font-black" : "text-slate-800 font-bold")
                            }
                            title={m.home}
                          >
                            {m.home}
                          </span>
                        </div>

                        {/* Score inputs */}
                        <div className="mx-1 flex items-center gap-1.5 shrink-0 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
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
                            className="w-8 sm:w-9 h-7 rounded-lg border border-slate-300 bg-white text-center font-black text-xs sm:text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
                          />
                          <span className="text-slate-400 font-bold">:</span>
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
                            className="w-8 sm:w-9 h-7 rounded-lg border border-slate-300 bg-white text-center font-black text-xs sm:text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
                          />
                        </div>

                        {/* Away Team */}
                        <div className="flex items-center justify-end gap-2 flex-1 min-w-0">
                          <span
                            className={
                              "truncate text-xs sm:text-sm text-left " +
                              (awayWon ? "text-emerald-800 font-black" : "text-slate-800 font-bold")
                            }
                            title={m.away}
                          >
                            {m.away}
                          </span>
                          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black shrink-0 ${
                            awayWon ? "bg-emerald-500 text-white shadow-2xs" : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}>
                            {m.away.trim().charAt(0)}
                          </span>
                        </div>
                      </div>

                      {/* Match Time / Pitch details */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
                        {dt?.date || dt?.time || dt?.pitch ? (
                          <span className="inline-flex items-center gap-1 text-emerald-800 font-bold truncate bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
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
                          <span className="text-slate-400 text-[10px]">
                            زمان و زمین ثبت نشده
                          </span>
                        )}
                        {onOpenEditModal && (
                          <button
                            type="button"
                            onClick={() => onOpenEditModal(matchId, m.home, m.away)}
                            className="text-[10px] text-pitch font-bold hover:underline mr-1 cursor-pointer bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition-colors"
                          >
                            {dt?.date || dt?.time || dt?.pitch ? "ویرایش" : "🕒 تنظیم زمان/زمین"}
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

      {/* Print View: Clean Simple Tabular List (No Cards) */}
      <div className="hidden print:block space-y-4 w-full">
        {rounds.map((round) => {
          const visibleMatches =
            filterTeam && filterTeam !== "all"
              ? round.matches.filter((m) => m.home === filterTeam || m.away === filterTeam)
              : round.matches;

          if (filterTeam && filterTeam !== "all" && visibleMatches.length === 0) {
            return null;
          }

          return (
            <div key={round.round} className="space-y-1.5 print-avoid-break">
              <div className="bg-pitch/10 text-pitch font-bold text-xs py-1 px-3 rounded flex items-center justify-between border-r-4 border-pitch">
                <span className="font-extrabold">هفته {round.round}</span>
                <span className="text-[10px] text-ink/70">{visibleMatches.length} مسابقه</span>
              </div>
              <div className="w-full overflow-hidden rounded-lg border border-line bg-white print-avoid-break">
                <table className="w-full text-right text-xs print:text-[11px]">
                  <thead>
                    <tr className="border-b border-line bg-chalk/80 font-bold text-ink/80 print:bg-chalk">
                      <th className="py-1.5 px-2 text-center w-10">#</th>
                      <th className="py-1.5 px-2 text-center w-20">کد بازی</th>
                      <th className="py-1.5 px-3 text-left w-1/3">تیم اول (میزبان)</th>
                      <th className="py-1.5 px-2 text-center w-20">نتیجه</th>
                      <th className="py-1.5 px-3 text-right w-1/3">تیم دوم (میهمان)</th>
                      <th className="py-1.5 px-3 text-center">زمان و مکان برگزاری</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {visibleMatches.map((m, idx) => {
                      const matchId = m.id ?? `r${round.round}-m${idx + 1}`;
                      const sc = scores[matchId] || { home: null, away: null };
                      const hasScore =
                        sc.home !== null &&
                        sc.away !== null &&
                        sc.home !== undefined &&
                        sc.away !== undefined;
                      const homeWon = Boolean(hasScore && (sc.home as number) > (sc.away as number));
                      const awayWon = Boolean(hasScore && (sc.away as number) > (sc.home as number));
                      const dt = matchDetails?.[matchId];
                      const datePitchStr = [
                        dt?.date,
                        dt?.time ? `ساعت ${dt.time}` : "",
                        dt?.pitch ? `زمین ${dt.pitch}` : "",
                      ]
                        .filter(Boolean)
                        .join(" • ");

                      return (
                        <tr key={matchId} className="even:bg-chalk/30 print-avoid-break">
                          <td className="py-1.5 px-2 text-center font-mono text-ink/60">{idx + 1}</td>
                          <td className="py-1.5 px-2 text-center font-mono text-pitch font-bold text-[10px]">
                            بازی {idx + 1}
                          </td>
                          <td className={`py-1.5 px-3 text-left ${homeWon ? "font-bold text-pitch" : "text-ink"}`}>
                            {homeWon && <span className="ml-1 text-pitch font-bold">✓</span>}
                            {m.home}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono font-bold">
                            {hasScore ? `${sc.home} - ${sc.away}` : "—"}
                          </td>
                          <td className={`py-1.5 px-3 text-right ${awayWon ? "font-bold text-pitch" : "text-ink"}`}>
                            {m.away}
                            {awayWon && <span className="mr-1 text-pitch font-bold">✓</span>}
                          </td>
                          <td className="py-1.5 px-3 text-center text-[10px] text-ink/70">
                            {datePitchStr || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
                    ? "bg-amber-50/70 font-bold"
                    : isClinched
                    ? "bg-emerald-50/50 font-semibold"
                    : "hover:bg-slate-50")
                }
              >
                <td className="py-2.5 px-3 print:py-1.5 print:px-2">
                  <span
                    className={
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-black shadow-2xs " +
                      (isChampion
                        ? "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950"
                        : isClinched
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-600 border border-slate-200")
                    }
                  >
                    {idx + 1}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-right print:py-1.5 print:px-2">
                  <div className="inline-flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-black shrink-0 no-print">
                      {s.team.trim().charAt(0)}
                    </span>
                    <span className="font-bold text-slate-900">{s.team}</span>
                    {isChampion && (
                      <span className="mr-1.5 rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-black text-amber-900 print:py-0 print:px-1 print:text-[9px]">
                        👑 قهرمان
                      </span>
                    )}
                    {isDirectClinched && !isChampion && (
                      <span className="mr-1.5 rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-black text-emerald-900 print:py-0 print:px-1 print:text-[9px]">
                        ✓ {clinch.isAllMatchesFinished ? qualifierLabel : "صعود قطعی"}
                      </span>
                    )}
                    {!isDirectClinched && isExtraQualified && (
                      <span className="mr-1.5 rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-black text-emerald-900 print:py-0 print:px-1 print:text-[9px]">
                        ✓ {extraQualifierLabel}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2.5 px-2.5 text-slate-700 font-medium print:py-1.5 print:px-1.5">{s.played}</td>
                <td className="py-2.5 px-2.5 font-bold text-emerald-800 print:py-1.5 print:px-1.5">{s.won}</td>
                {!isVolleyball && (
                  <td className="py-2.5 px-2.5 text-slate-500 font-medium print:py-1.5 print:px-1.5">{s.drawn}</td>
                )}
                <td className="py-2.5 px-2.5 text-rose-600 font-bold print:py-1.5 print:px-1.5">{s.lost}</td>
                <td className="py-2.5 px-2.5 text-slate-600 font-medium print:py-1.5 print:px-1.5">{s.goalsFor}</td>
                <td className="py-2.5 px-2.5 text-slate-600 font-medium print:py-1.5 print:px-1.5">{s.goalsAgainst}</td>
                <td
                  className={
                    "py-2.5 px-2.5 font-bold print:py-1.5 print:px-1.5 " +
                    (s.goalDifference > 0
                      ? "text-emerald-700"
                      : s.goalDifference < 0
                      ? "text-rose-600"
                      : "text-slate-400")
                  }
                >
                  {s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}
                </td>
                <td className="py-2.5 px-3 print:py-1.5 print:px-2">
                  <span className="inline-block bg-pitch/10 text-pitch font-black text-sm px-2.5 py-0.5 rounded-lg border border-pitch/15 font-mono">
                    {s.points}
                  </span>
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
   KNOCKOUT PRINTABLE SIMPLE TABULAR LIST
   (Provides 100% clean, non-clipped tabular list print output)
   ========================================================= */

function renderPrintMatchRow(
  m: any,
  scores: Record<string, MatchScore>,
  matchDetails?: Record<string, MatchScheduleDetail>,
  idx?: number,
  stageLabel?: string
) {
  const sc = scores[m.id];
  const dt = matchDetails?.[m.id];
  const isBye = Boolean(m.isBye || m.autoAdvance);
  const isHomeReal = Boolean(m.home && !isPlaceholderTeam(m.home));
  const isAwayReal = Boolean(m.away && !isPlaceholderTeam(m.away));
  const isPending = !isBye && (!isHomeReal || !isAwayReal);
  const isReadyToPlay = !isBye && isHomeReal && isAwayReal;

  const hasScore =
    sc &&
    sc.home !== null &&
    sc.away !== null &&
    sc.home !== undefined &&
    sc.away !== undefined;

  const homeWon = m.winner ? m.winner === m.home : Boolean(hasScore && (sc.home as number) > (sc.away as number));
  const awayWon = m.winner ? m.winner === m.away : Boolean(hasScore && (sc.away as number) > (sc.home as number));

  const datePitchStr = [
    dt?.date,
    dt?.time ? `ساعت ${dt.time}` : "",
    dt?.pitch ? `زمین ${dt.pitch}` : "",
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <tr key={m.id} className="even:bg-chalk/30 print-avoid-break text-xs print:text-[11px]">
      {idx !== undefined && (
        <td className="py-2 px-2 text-center font-mono text-ink/60 border-b border-line/60 w-10">
          {idx + 1}
        </td>
      )}
      {stageLabel && (
        <td className="py-2 px-2 text-center font-bold text-pitch border-b border-line/60 w-32">
          {stageLabel}
        </td>
      )}
      <td className="py-2 px-2 text-center font-mono font-bold text-pitch border-b border-line/60 w-24">
        {m.matchCode || `بازی ${m.slot !== undefined ? m.slot + 1 : m.id}`}
      </td>
      <td className="py-2 px-2 text-center text-ink/70 border-b border-line/60 text-[10px]">
        {datePitchStr || "—"}
      </td>
      <td
        className={`py-2 px-3 text-left border-b border-line/60 font-medium ${
          homeWon ? "font-bold text-pitch bg-pitch/5" : ""
        }`}
      >
        {isHomeReal ? (
          <span>
            {homeWon && <span className="ml-1 text-pitch font-bold">✓</span>}
            {m.home}
          </span>
        ) : isBye ? (
          <span className="text-ink/40 italic">—</span>
        ) : (
          <span className="text-ink/40 italic">
            {m.home || m.homePlaceholder || "در انتظار صعود"}
          </span>
        )}
      </td>
      <td className="py-2 px-2 text-center font-mono font-bold border-b border-line/60 w-24">
        {isBye ? (
          <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
            صعود مستقیم
          </span>
        ) : hasScore ? (
          <div className="flex flex-col items-center">
            <span>
              {sc.home} - {sc.away}
            </span>
            {(sc.homePenalty !== null && sc.homePenalty !== undefined) ||
            (sc.awayPenalty !== null && sc.awayPenalty !== undefined) ? (
              <span className="text-[9px] text-amber-800 font-normal">
                پنالتی: ({sc.homePenalty ?? 0} - {sc.awayPenalty ?? 0})
              </span>
            ) : null}
          </div>
        ) : isPending ? (
          <span className="text-ink/30">— : —</span>
        ) : (
          <span className="text-ink/50 font-normal">برگزار نشده</span>
        )}
      </td>
      <td
        className={`py-2 px-3 text-right border-b border-line/60 font-medium ${
          awayWon ? "font-bold text-pitch bg-pitch/5" : ""
        }`}
      >
        {isAwayReal ? (
          <span>
            {m.away}
            {awayWon && <span className="mr-1 text-pitch font-bold">✓</span>}
          </span>
        ) : isBye ? (
          <span className="text-ink/40 italic">—</span>
        ) : (
          <span className="text-ink/40 italic">
            {m.away || m.awayPlaceholder || "در انتظار صعود"}
          </span>
        )}
      </td>
      <td className="py-2 px-2 text-center border-b border-line/60 text-[11px] w-32">
        {m.winner ? (
          <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            برنده: {m.winner}
          </span>
        ) : isBye ? (
          <span className="text-emerald-700 font-semibold">استراحت قرعه</span>
        ) : isReadyToPlay ? (
          <span className="text-sky-700">آماده برگزاری</span>
        ) : (
          <span className="text-amber-700">در انتظار حریف</span>
        )}
      </td>
    </tr>
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
    <div className="space-y-4 print-avoid-break w-full">
      <div className="border-b-2 border-pitch pb-2">
        <h2 className="text-base font-black text-pitch flex items-center gap-2">
          <span>🏆</span>
          <span>لیست مسابقات مرحله حذفی</span>
        </h2>
        <p className="text-[11px] text-ink/60 mt-0.5">
          برنامه کامل مسابقات مراحل حذفی، نتایج و وضعیت صعود تیم‌ها به صورت جدولی
        </p>
      </div>

      <div className="w-full overflow-hidden rounded-xl border border-line bg-white print-avoid-break">
        <table className="w-full text-right text-xs print:text-[11px]">
          <thead>
            <tr className="border-b border-line bg-chalk/80 font-bold text-ink/80 print:bg-chalk">
              <th className="py-2 px-2 text-center w-10">#</th>
              <th className="py-2 px-2 text-center w-32">مرحله</th>
              <th className="py-2 px-2 text-center w-24">کد بازی</th>
              <th className="py-2 px-2 text-center">زمان و مکان برگزاری</th>
              <th className="py-2 px-3 text-left w-1/4">تیم اول (میزبان)</th>
              <th className="py-2 px-2 text-center w-24">نتیجه</th>
              <th className="py-2 px-3 text-right w-1/4">تیم دوم (میهمان)</th>
              <th className="py-2 px-2 text-center w-32">برنده / وضعیت</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {(() => {
              let rowCounter = 0;
              const rows: any[] = [];
              knockout.rounds.forEach((round: any) => {
                round.matches?.forEach((m: any) => {
                  rows.push(
                    renderPrintMatchRow(m, scores, matchDetails, rowCounter++, round.label)
                  );
                });
              });
              if (knockout.thirdPlaceMatch) {
                rows.push(
                  renderPrintMatchRow(
                    knockout.thirdPlaceMatch,
                    scores,
                    matchDetails,
                    rowCounter++,
                    "رده‌بندی (مقام سوم)"
                  )
                );
              }
              return rows;
            })()}
          </tbody>
        </table>
      </div>
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
    <div className="space-y-5 print-avoid-break w-full">
      <div className="border-b-2 border-pitch pb-2">
        <h2 className="text-base font-black text-pitch flex items-center gap-2">
          <span>🛡️</span>
          <span>لیست مسابقات تورنمنت دو حذفی (Double Elimination)</span>
        </h2>
        <p className="text-[11px] text-ink/60 mt-0.5">
          فهرست جدولی و تفکیک‌شده مسابقات جدول برندگان، جدول شانس مجدد و فینال نهایی
        </p>
      </div>

      {/* Winners Bracket Table */}
      <div className="space-y-2 print-avoid-break">
        <div className="bg-pitch/10 text-pitch font-black text-xs py-1.5 px-3 rounded flex items-center justify-between border-r-4 border-pitch">
          <span>🏆 جدول برندگان (Winners Bracket)</span>
        </div>
        <div className="w-full overflow-hidden rounded-xl border border-line bg-white print-avoid-break">
          <table className="w-full text-right text-xs print:text-[11px]">
            <thead>
              <tr className="border-b border-line bg-chalk/80 font-bold text-ink/80 print:bg-chalk">
                <th className="py-2 px-2 text-center w-10">#</th>
                <th className="py-2 px-2 text-center w-32">مرحله</th>
                <th className="py-2 px-2 text-center w-24">کد بازی</th>
                <th className="py-2 px-2 text-center">زمان و مکان برگزاری</th>
                <th className="py-2 px-3 text-left w-1/4">تیم اول (میزبان)</th>
                <th className="py-2 px-2 text-center w-24">نتیجه</th>
                <th className="py-2 px-3 text-right w-1/4">تیم دوم (میهمان)</th>
                <th className="py-2 px-2 text-center w-32">برنده / وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {(() => {
                let cnt = 0;
                const rows: any[] = [];
                doubleKnockout.winnersBracket?.forEach((round) => {
                  round.matches?.forEach((m) => {
                    rows.push(
                      renderPrintMatchRow(m, scores, matchDetails, cnt++, round.label)
                    );
                  });
                });
                return rows;
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Losers Bracket Table */}
      <div className="space-y-2 print-avoid-break">
        <div className="bg-amber-100 text-amber-950 font-black text-xs py-1.5 px-3 rounded flex items-center justify-between border-r-4 border-amber-600">
          <span>🛡️ جدول شانس مجدد / بازندگان (Losers Bracket)</span>
        </div>
        <div className="w-full overflow-hidden rounded-xl border border-line bg-white print-avoid-break">
          <table className="w-full text-right text-xs print:text-[11px]">
            <thead>
              <tr className="border-b border-line bg-chalk/80 font-bold text-ink/80 print:bg-chalk">
                <th className="py-2 px-2 text-center w-10">#</th>
                <th className="py-2 px-2 text-center w-32">مرحله</th>
                <th className="py-2 px-2 text-center w-24">کد بازی</th>
                <th className="py-2 px-2 text-center">زمان و مکان برگزاری</th>
                <th className="py-2 px-3 text-left w-1/4">تیم اول (میزبان)</th>
                <th className="py-2 px-2 text-center w-24">نتیجه</th>
                <th className="py-2 px-3 text-right w-1/4">تیم دوم (میهمان)</th>
                <th className="py-2 px-2 text-center w-32">برنده / وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {(() => {
                let cnt = 0;
                const rows: any[] = [];
                doubleKnockout.losersBracket?.forEach((round) => {
                  round.matches?.forEach((m) => {
                    rows.push(
                      renderPrintMatchRow(m, scores, matchDetails, cnt++, round.label)
                    );
                  });
                });
                return rows;
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Finals Table */}
      {(doubleKnockout.grandFinal || doubleKnockout.bracketResetMatch) && (
        <div className="space-y-2 print-avoid-break">
          <div className="bg-gold/25 text-pitch font-black text-xs py-1.5 px-3 rounded flex items-center justify-between border-r-4 border-gold">
            <span>👑 فینال نهایی مسابقات (Grand Final)</span>
          </div>
          <div className="w-full overflow-hidden rounded-xl border border-line bg-white print-avoid-break">
            <table className="w-full text-right text-xs print:text-[11px]">
              <thead>
                <tr className="border-b border-line bg-chalk/80 font-bold text-ink/80 print:bg-chalk">
                  <th className="py-2 px-2 text-center w-10">#</th>
                  <th className="py-2 px-2 text-center w-32">مرحله</th>
                  <th className="py-2 px-2 text-center w-24">کد بازی</th>
                  <th className="py-2 px-2 text-center">زمان و مکان برگزاری</th>
                  <th className="py-2 px-3 text-left w-1/4">تیم اول (میزبان)</th>
                  <th className="py-2 px-2 text-center w-24">نتیجه</th>
                  <th className="py-2 px-3 text-right w-1/4">تیم دوم (میهمان)</th>
                  <th className="py-2 px-2 text-center w-32">برنده / وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {doubleKnockout.grandFinal &&
                  renderPrintMatchRow(
                    doubleKnockout.grandFinal,
                    scores,
                    matchDetails,
                    0,
                    "فینال اصلی"
                  )}
                {doubleKnockout.bracketResetMatch &&
                  renderPrintMatchRow(
                    doubleKnockout.bracketResetMatch,
                    scores,
                    matchDetails,
                    1,
                    "فینال مجدد (Bracket Reset)"
                  )}
              </tbody>
            </table>
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

  return (
    <div className="space-y-8">
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

      {/* Third Place Match (if configured) */}
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
          className={`rounded-xl border border-line bg-chalk/30 p-5 space-y-4 print-avoid-break ${
            printBracketStyle === "stages" ? "print:hidden" : "print:overflow-visible print:p-2"
          }`}
        >
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h3 className="font-bold text-base text-pitch flex items-center gap-2">
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
        </div>
      )}

      {/* Section 2: Losers Bracket */}
      {(bracketView === "all" || bracketView === "losers") && (
        <div
          className={`rounded-xl border border-amber-600/30 bg-amber-50/30 p-5 space-y-4 print-avoid-break ${
            printBracketStyle === "stages" ? "print:hidden" : "print:overflow-visible print:p-2"
          }`}
        >
          <div className="flex items-center justify-between border-b border-amber-600/20 pb-3">
            <div>
              <h3 className="font-bold text-base text-amber-900 flex items-center gap-2">
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
        </div>
      )}

      {/* Section 3: Grand Final */}
      {(bracketView === "all" || bracketView === "finals") && (
        <div
          className={`rounded-xl border-2 border-gold/70 bg-white p-5 space-y-4 shadow-sm print-avoid-break ${
            printBracketStyle === "stages" ? "print:hidden" : "print:p-2"
          }`}
        >
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h3 className="font-bold text-base text-pitch flex items-center gap-2">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
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
        "rounded-xl border shadow-card transition-all overflow-hidden print-avoid-break " +
        (isFilteredTeam ? "ring-2 ring-amber-400 border-amber-400 bg-amber-50/10 " : "") +
        (isEmptyDoubleBye
          ? "border-slate-200 bg-slate-50/40 opacity-75"
          : isPending
          ? "border-amber-200/90 bg-amber-50/20"
          : isSingleBye
          ? "border-emerald-200 bg-emerald-50/15"
          : isFinal
          ? "border-amber-400/80 bg-white"
          : "border-slate-200/90 bg-white/95")
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
