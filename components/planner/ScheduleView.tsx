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
} from "@/lib/scheduling";

interface ScheduleViewProps {
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
  onResetScores?: () => void;
  teams: string[];
  qualifiersPerGroup?: number;
}

export function ScheduleView({
  result,
  scores,
  onScoreChange,
  onResetScores,
  teams,
  qualifiersPerGroup = 2,
}: ScheduleViewProps) {
  const [activeTab, setActiveTab] = useState<"matches" | "standings">("matches");
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number | "all">("all");

  const hasStandings =
    result.format === "league" ||
    result.format === "double-league" ||
    result.format === "groups" ||
    result.format === "groups-knockout";

  const meta = result.metadata;

  return (
    <div id="print-area" className="space-y-6">
      {/* Official Header for Print & Web */}
      {(meta?.title || meta?.venue) && (
        <div className="rounded-xl border border-line bg-chalk/80 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {meta.title && <h2 className="text-xl font-black text-pitch">{meta.title}</h2>}
              {meta.venue && (
                <p className="text-xs text-ink/70 mt-1 flex items-center gap-1.5 font-medium">
                  <span>📍 محل برگزاری:</span>
                  <span className="text-ink font-semibold">{meta.venue}</span>
                </p>
              )}
            </div>
            <div className="text-left text-xs text-ink/50">
              <span>سامانه مسابقات ورزشی NexSport</span>
            </div>
          </div>
        </div>
      )}

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

      {/* MATCHES VIEW */}
      {activeTab === "matches" && (
        <div className="space-y-8">
          {(result.format === "league" || result.format === "double-league") && (
            <RoundsTable
              rounds={result.rounds}
              scores={scores}
              onScoreChange={onScoreChange}
              metadata={meta}
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
                  />
                </div>
              ))}
            </div>
          )}
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
}) {
  return (
    <div className="space-y-6">
      {title && <h3 className="font-bold text-pitch text-base">{title}</h3>}
      <div className="grid gap-6 sm:grid-cols-2">
        {rounds.map((round) => (
          <div key={round.round} className="rounded-lg border border-line bg-white/60 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between border-b border-line/60 pb-2">
              <span className="font-semibold text-sm text-pitch">هفته {round.round}</span>
              <span className="text-xs text-ink/50">{round.matches.length} مسابقه</span>
            </div>
            <div className="space-y-2.5">
              {round.matches.map((m, idx) => {
                const matchId = m.id ?? `r${round.round}-m${idx + 1}`;
                const sc = scores[matchId] || { home: null, away: null };
                const homeWon = sc.home !== null && sc.away !== null && sc.home > sc.away;
                const awayWon = sc.home !== null && sc.away !== null && sc.away > sc.home;

                return (
                  <div
                    key={matchId}
                    className="flex items-center justify-between rounded-md border border-line/80 bg-chalk/60 px-3 py-2 text-sm"
                  >
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
                );
              })}

              {round.matches.length === 0 && (
                <p className="text-center py-2 text-xs text-ink/40">استراحت (Bye)</p>
              )}
            </div>
          </div>
        ))}
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
}: {
  teams: string[];
  rounds: RoundRobinRound[];
  scores: Record<string, MatchScore>;
  qualifiersCount?: number;
  qualifierLabel?: string;
}) {
  const allMatches = useMemo(() => rounds.flatMap((r) => r.matches), [rounds]);
  const standings = useMemo(
    () => calculateStandings(teams, allMatches, scores),
    [teams, allMatches, scores]
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-sm">
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
}) {
  const { knockout, champion, runnerUp, thirdPlace } = useMemo(
    () => computeKnockoutWithScores(originalKnockout, scores),
    [originalKnockout, scores]
  );

  return (
    <div className="space-y-8">
      {/* Celebration Podium */}
      {champion && (
        <div className="rounded-xl border-2 border-gold bg-gradient-to-r from-gold/15 via-gold/25 to-gold/15 p-6 shadow-md text-center animate-fade-in">
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
        <div className="rounded-xl border-2 border-gold bg-gradient-to-r from-gold/15 via-gold/25 to-gold/15 p-6 shadow-md text-center animate-fade-in">
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
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
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

  return (
    <div
      className={
        "rounded-lg border shadow-sm transition-all overflow-hidden " +
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
            if (m.home && m.away && !isAuto) {
              onScoreChange(
                m.id,
                sc.home,
                sc.away,
                sc.homePenalty,
                sc.awayPenalty,
                m.home
              );
            }
          }}
          disabled={!m.home || !m.away || isAuto}
          title={m.home && !isAuto ? "کلیک برای انتخاب دستی به عنوان برنده" : undefined}
          className="flex items-center gap-1.5 text-right flex-1 truncate text-xs hover:text-pitch disabled:hover:text-inherit"
        >
          {isHomeWinner && <span className="text-gold">👑</span>}
          <span className="truncate">{m.home ?? "نامشخص (TBD)"}</span>
        </button>

        {!isAuto && m.home && m.away && (
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
              onScoreChange(
                m.id,
                val,
                sc.away ?? null,
                sc.homePenalty,
                sc.awayPenalty,
                undefined
              );
            }}
            placeholder="-"
            className="w-9 h-7 rounded border border-line bg-white text-center font-bold text-xs focus:border-gold focus:outline-none"
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
            if (m.home && m.away && !isAuto) {
              onScoreChange(
                m.id,
                sc.home,
                sc.away,
                sc.homePenalty,
                sc.awayPenalty,
                m.away
              );
            }
          }}
          disabled={!m.home || !m.away || isAuto}
          title={m.away && !isAuto ? "کلیک برای انتخاب دستی به عنوان برنده" : undefined}
          className="flex items-center gap-1.5 text-right flex-1 truncate text-xs hover:text-pitch disabled:hover:text-inherit"
        >
          {isAwayWinner && <span className="text-gold">👑</span>}
          <span className="truncate">{m.away ?? "نامشخص (TBD)"}</span>
        </button>

        {!isAuto && m.home && m.away && (
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
              onScoreChange(
                m.id,
                sc.home ?? null,
                val,
                sc.homePenalty,
                sc.awayPenalty,
                undefined
              );
            }}
            placeholder="-"
            className="w-9 h-7 rounded border border-line bg-white text-center font-bold text-xs focus:border-gold focus:outline-none"
          />
        )}
      </div>

      {/* Penalty shootout row (shown when regulation is tied) */}
      {isTied && (
        <div className="flex items-center justify-between bg-gold/15 px-3 py-1.5 border-t border-gold/30 text-[11px]">
          <span className="font-semibold text-gold-dark flex items-center gap-1">
            <span>⚽</span>
            <span>ضربات پنالتی:</span>
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
    </div>
  );
}
