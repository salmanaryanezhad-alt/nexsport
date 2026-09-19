"use client";

import { useMemo, useState } from "react";
import {
  ScheduleResult,
  RoundRobinRound,
  GroupResult,
  MatchScore,
  calculateStandings,
  computeKnockoutWithScores,
  computeDoubleKnockoutWithScores,
  DoubleKnockoutResult,
  TournamentMetadata,
  MatchScheduleDetail,
  PointsRule,
} from "@/lib/scheduling";

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

  return (
    <div id="print-area" className="space-y-6">
      {/* Official Header for Print & Web */}
      <div className="rounded-xl border border-line bg-chalk/80 p-5 shadow-sm print:border-pitch/40 print:bg-white print:p-4">
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
          <div className="text-left text-xs space-y-0.5">
            <div className="flex items-center gap-1.5 font-bold text-pitch justify-end">
              <span>سامانه برنامه‌ریزی مسابقات NexSport</span>
              <span>⚽</span>
            </div>
            <div className="font-mono text-pitch/80 font-bold dir-ltr text-[11px]">
              nexsport.ir
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
      {activeTab === "matches" && (
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
            <div className="space-y-12">
              <div>
                <h2 className="text-lg font-bold text-pitch mb-4">مرحله اول: مسابقات گروهی</h2>
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

              <div>
                <div className="border-t border-line pt-8 mb-6">
                  <h2 className="text-lg font-bold text-pitch">مرحله دوم: براکت حذفی صعودکننده‌ها</h2>
                  <p className="text-xs text-ink/60 mt-1">
                    نتایج را در هر مسابقه وارد کنید تا برنده به طور خودکار به دور بعد صعود کند. در صورت
                    تساوی، فیلد ضربات پنالتی نمایش داده می‌شود.
                  </p>
                </div>
                <InteractiveBracket
                  originalKnockout={result.knockout}
                  scores={scores}
                  onScoreChange={onScoreChange}
                  matchDetails={matchDetails}
                  onOpenEditModal={handleOpenEditModal}
                  filterTeam={filterTeam}
                />
              </div>
            </div>
          )}

          {result.format === "knockout" && (
            <div>
              <div className="mb-6">
                <h2 className="text-lg font-bold text-pitch">براکت حذفی مسابقات</h2>
                <p className="text-xs text-ink/60 mt-1">
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
              />
            </div>
          )}

          {result.format === "double-knockout" && (
            <div>
              <div className="mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🛡️</span>
                  <h2 className="text-lg font-bold text-pitch">تورنمنت دو حذفی (Double Elimination)</h2>
                </div>
                <p className="text-xs text-ink/60 mt-1">
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
              />
            </div>
          )}
        </div>
      )}

      {/* STANDINGS VIEW */}
      {activeTab === "standings" && hasStandings && (
        <div className="space-y-8">
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
                    </span>
                  </h3>
                  <StandingsTable
                    teams={g.teams}
                    rounds={g.rounds}
                    scores={scores}
                    qualifiersCount={qualifiersPerGroup}
                    qualifierLabel="صعود"
                    pointsRule={meta?.pointsRule}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Official Watermark / Footer for Print */}
      <div className="print-only border-t-2 border-pitch/30 pt-3 mt-8 print-avoid-break">
        <div className="flex items-center justify-between text-xs text-ink/75">
          <div className="flex items-center gap-1.5 font-bold text-pitch">
            <span>⚽</span>
            <span>برنامه‌ریزی و قرعه‌کشی با سامانه ورزشی NexSport</span>
          </div>
          <div className="font-mono font-bold text-pitch dir-ltr text-xs">
            nexsport.ir
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
      <div className="grid gap-6 sm:grid-cols-2">
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

      <div className="space-y-8">
        {filteredGroups.map((g) => (
          <div key={g.name} className="rounded-lg border border-line bg-chalk/30 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <h3 className="font-bold text-pitch text-base">{g.name}</h3>
              <span className="text-xs text-ink/60">تیم‌ها: {g.teams.join(" · ")}</span>
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
}: {
  teams: string[];
  rounds: RoundRobinRound[];
  scores: Record<string, MatchScore>;
  qualifiersCount?: number;
  qualifierLabel?: string;
  pointsRule?: PointsRule;
}) {
  const allMatches = useMemo(() => rounds.flatMap((r) => r.matches), [rounds]);
  const standings = useMemo(
    () => calculateStandings(teams, allMatches, scores, pointsRule),
    [teams, allMatches, scores, pointsRule]
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-sm print-avoid-break">
      <table className="w-full text-center text-sm">
        <thead>
          <tr className="border-b border-line bg-chalk/80 text-xs font-bold text-ink/70">
            <th className="py-2.5 px-3 text-center w-12">رتبه</th>
            <th className="py-2.5 px-4 text-right">تیم</th>
            <th className="py-2.5 px-2.5 w-12" title="تعداد بازی">بازی</th>
            <th className="py-2.5 px-2.5 w-12 text-pitch" title="برد">برد</th>
            <th className="py-2.5 px-2.5 w-12 text-ink/60" title="مساوی">مساوی</th>
            <th className="py-2.5 px-2.5 w-12 text-brick" title="باخت">باخت</th>
            <th className="py-2.5 px-2.5 w-14" title="گل زده">زده</th>
            <th className="py-2.5 px-2.5 w-14" title="گل خورده">خورده</th>
            <th className="py-2.5 px-2.5 w-14 font-semibold" title="تفاضل گل">تفاضل</th>
            <th className="py-2.5 px-3 w-16 bg-pitch/5 font-extrabold text-pitch" title="امتیاز">امتیاز</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {standings.map((s, idx) => {
            const isQualifying = idx < qualifiersCount;
            return (
              <tr
                key={s.team}
                className={
                  "transition-colors " +
                  (isQualifying ? "bg-gold/5 font-medium" : "hover:bg-chalk/30")
                }
              >
                <td className="py-2.5 px-3">
                  <span
                    className={
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold " +
                      (idx === 0
                        ? "bg-gold text-ink"
                        : isQualifying
                        ? "bg-pitch/15 text-pitch"
                        : "text-ink/50")
                    }
                  >
                    {idx + 1}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-right">
                  <span className="font-semibold text-ink">{s.team}</span>
                  {isQualifying && (
                    <span className="mr-2 rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-bold text-gold-dark">
                      {idx === 0 && qualifiersCount === 1 ? "قهرمان" : qualifierLabel}
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-2.5 text-ink/80">{s.played}</td>
                <td className="py-2.5 px-2.5 font-semibold text-pitch">{s.won}</td>
                <td className="py-2.5 px-2.5 text-ink/60">{s.drawn}</td>
                <td className="py-2.5 px-2.5 text-brick">{s.lost}</td>
                <td className="py-2.5 px-2.5 text-ink/80">{s.goalsFor}</td>
                <td className="py-2.5 px-2.5 text-ink/80">{s.goalsAgainst}</td>
                <td
                  className={
                    "py-2.5 px-2.5 font-bold " +
                    (s.goalDifference > 0
                      ? "text-pitch"
                      : s.goalDifference < 0
                      ? "text-brick"
                      : "text-ink/50")
                  }
                >
                  {s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}
                </td>
                <td className="py-2.5 px-3 bg-pitch/5 font-extrabold text-pitch text-base">
                  {s.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {pointsRule && (
        <div className="px-3.5 py-1.5 bg-chalk/60 border-t border-line/60 text-[11px] text-ink/70 flex flex-wrap items-center justify-between gap-2">
          <span>سیستم امتیازدهی: <strong>{pointsRule.name || "سفارشی"}</strong></span>
          <span>(برد: {pointsRule.win} امتیاز | مساوی: {pointsRule.draw} | باخت: {pointsRule.loss})</span>
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
  scores,
  onScoreChange,
  matchDetails,
  onOpenEditModal,
  filterTeam,
}: {
  originalKnockout: ScheduleResult extends { knockout: infer K } ? K : any;
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
}) {
  const { knockout, champion, runnerUp, thirdPlace } = useMemo(
    () => computeKnockoutWithScores(originalKnockout, scores),
    [originalKnockout, scores]
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

      {/* Main Bracket Columns */}
      <div className="flex gap-6 overflow-x-auto pb-4 pt-2">
        {knockout.rounds.map((round: any, roundIdx: number) => {
          const isFinal = roundIdx === knockout.rounds.length - 1;
          return (
            <div
              key={round.round}
              className="flex min-w-[270px] max-w-[290px] flex-col justify-around gap-6"
            >
              <div className="text-center rounded-md bg-pitch/10 py-1.5 px-3">
                <p className="text-xs font-bold text-pitch">{round.label}</p>
              </div>

              <div className="flex flex-col justify-around gap-8 flex-1">
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
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Third Place Match (if configured) */}
      {knockout.thirdPlaceMatch && (
        <div className="border-t border-line pt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-sm text-pitch flex items-center gap-1.5">
              <span>🥉 مسابقه رده‌بندی</span>
              <span className="text-xs text-ink/50 font-normal">(تعیین مقام سوم و چهارم)</span>
            </h3>
            {thirdPlace && (
              <span className="text-xs font-bold text-pitch bg-pitch/10 px-2 py-0.5 rounded">
                برنده مقام سوم: {thirdPlace}
              </span>
            )}
          </div>
          <div className="max-w-sm">
            <MatchBracketCard
              match={knockout.thirdPlaceMatch}
              scores={scores}
              isFinal={false}
              onScoreChange={onScoreChange}
              label="دیدار رده‌بندی"
              matchDetails={matchDetails}
              onOpenEditModal={onOpenEditModal}
              filterTeam={filterTeam}
            />
          </div>
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
}) {
  const [bracketView, setBracketView] = useState<"all" | "winners" | "losers" | "finals">("all");

  const { doubleKnockout, champion, runnerUp, thirdPlace } = useMemo(
    () => computeDoubleKnockoutWithScores(originalDoubleKnockout, scores),
    [originalDoubleKnockout, scores]
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

      {/* Section 1: Winners Bracket */}
      {(bracketView === "all" || bracketView === "winners") && (
        <div className="rounded-xl border border-line bg-chalk/30 p-5 space-y-4">
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

          <div className="flex gap-6 overflow-x-auto pb-4 pt-2">
            {doubleKnockout.winnersBracket.map((round, rIdx) => {
              const isFinal = rIdx === doubleKnockout.winnersBracket.length - 1;
              return (
                <div
                  key={round.round}
                  className="flex min-w-[270px] max-w-[290px] flex-col justify-around gap-6"
                >
                  <div className="text-center rounded-md bg-pitch/10 py-1.5 px-3">
                    <p className="text-xs font-bold text-pitch">{round.label}</p>
                  </div>

                  <div className="flex flex-col justify-around gap-8 flex-1">
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
        <div className="rounded-xl border border-amber-600/30 bg-amber-50/30 p-5 space-y-4">
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

          <div className="flex gap-6 overflow-x-auto pb-4 pt-2">
            {doubleKnockout.losersBracket.map((round, rIdx) => {
              const isFinal = rIdx === doubleKnockout.losersBracket.length - 1;
              return (
                <div
                  key={round.round}
                  className="flex min-w-[270px] max-w-[290px] flex-col justify-around gap-6"
                >
                  <div className="text-center rounded-md bg-amber-600/15 py-1.5 px-3">
                    <p className="text-xs font-bold text-amber-950">{round.label}</p>
                  </div>

                  <div className="flex flex-col justify-around gap-8 flex-1">
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
        <div className="rounded-xl border-2 border-gold/70 bg-white p-5 space-y-4 shadow-sm">
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
                />
              </div>
            )}
          </div>
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
}) {
  const sc = scores[m.id] || {
    home: m.homeScore ?? null,
    away: m.awayScore ?? null,
    homePenalty: m.homePenalty ?? null,
    awayPenalty: m.awayPenalty ?? null,
    winner: m.winner ?? null,
  };
  const isAuto = Boolean(m.autoAdvance);
  const isHomeWinner = m.winner && m.home && m.winner === m.home;
  const isAwayWinner = m.winner && m.away && m.winner === m.away;
  const isTied =
    sc.home !== null &&
    sc.away !== null &&
    sc.home === sc.away &&
    m.home &&
    m.away &&
    !isAuto;

  const dt = matchDetails?.[m.id];
  const isFilteredTeam =
    filterTeam &&
    filterTeam !== "all" &&
    (m.home === filterTeam || m.away === filterTeam);

  return (
    <div
      className={
        "rounded-lg border shadow-sm transition-all overflow-hidden print-avoid-break " +
        (isFilteredTeam ? "ring-2 ring-gold border-gold bg-gold/5 " : "") +
        (isFinal ? "border-gold/80 bg-white" : "border-line bg-white/90")
      }
    >
      {/* Match Header */}
      <div className="flex items-center justify-between border-b border-line/60 bg-chalk/60 px-3 py-1 text-[11px] text-ink/50">
        <span>{label || `بازی ${m.slot + 1}`}</span>
        {isAuto && <span className="text-gold-dark font-semibold">استراحت Bye</span>}
        {m.winner && !isAuto && (
          <span className="text-pitch font-bold flex items-center gap-1">
            ✓ برنده: {m.winner}
          </span>
        )}
      </div>

      {/* Home Team */}
      <div
        className={
          "flex items-center justify-between px-3 py-2 border-b border-line/40 transition-colors " +
          (isHomeWinner ? "bg-pitch/10 font-bold text-pitch" : "")
        }
      >
        <button
          type="button"
          onClick={() => {
            if (!m.home || isAuto) return;
            onScoreChange(
              m.id,
              sc.home,
              sc.away,
              sc.homePenalty ?? null,
              sc.awayPenalty ?? null,
              m.home
            );
          }}
          disabled={!m.home || isAuto}
          className="text-right flex-1 truncate text-xs font-semibold hover:text-pitch transition-colors disabled:cursor-default"
          title={m.home ? `کلیک برای انتخاب دستی ${m.home} به عنوان برنده` : ""}
        >
          {m.home || "نامشخص"}
        </button>

        {!isAuto && m.home && m.away && (
          <input
            type="number"
            min="0"
            max="99"
            value={
              sc.home !== null && sc.home !== undefined ? sc.home : ""
            }
            onChange={(e) => {
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
            }}
            placeholder="-"
            className="w-9 h-7 text-center text-xs font-bold rounded border border-line bg-white focus:border-gold focus:outline-none"
          />
        )}
      </div>

      {/* Away Team */}
      <div
        className={
          "flex items-center justify-between px-3 py-2 transition-colors " +
          (isAwayWinner ? "bg-pitch/10 font-bold text-pitch" : "")
        }
      >
        <button
          type="button"
          onClick={() => {
            if (!m.away || isAuto) return;
            onScoreChange(
              m.id,
              sc.home,
              sc.away,
              sc.homePenalty ?? null,
              sc.awayPenalty ?? null,
              m.away
            );
          }}
          disabled={!m.away || isAuto}
          className="text-right flex-1 truncate text-xs font-semibold hover:text-pitch transition-colors disabled:cursor-default"
          title={m.away ? `کلیک برای انتخاب دستی ${m.away} به عنوان برنده` : ""}
        >
          {m.away || "نامشخص"}
        </button>

        {!isAuto && m.home && m.away && (
          <input
            type="number"
            min="0"
            max="99"
            value={
              sc.away !== null && sc.away !== undefined ? sc.away : ""
            }
            onChange={(e) => {
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
            }}
            placeholder="-"
            className="w-9 h-7 text-center text-xs font-bold rounded border border-line bg-white focus:border-gold focus:outline-none"
          />
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
              onChange={(e) => {
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
              }}
              placeholder="میزبان"
              className="w-10 h-6 text-center text-xs font-bold rounded border border-gold/60 bg-white"
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
              onChange={(e) => {
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
              }}
              placeholder="میهمان"
              className="w-10 h-6 text-center text-xs font-bold rounded border border-gold/60 bg-white"
            />
          </div>
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
        {onOpenEditModal && m.home && m.away && (
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
