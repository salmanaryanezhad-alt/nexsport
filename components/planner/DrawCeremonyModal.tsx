"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  CompetitionFormat,
  ScheduleResult,
  GroupResult,
  BracketMatch,
  Match,
} from "@/lib/scheduling/types";
import { NexSportIcon } from "@/components/NexSportLogo";

interface DrawCeremonyModalProps {
  isOpen: boolean;
  format: CompetitionFormat | null;
  teams: string[];
  result: ScheduleResult | null;
  tournamentTitle?: string;
  seededTeams?: string[];
  pot2Teams?: string[];
  pot3Teams?: string[];
  pot4Teams?: string[];
  onComplete: () => void;
}

interface DrawStepItem {
  id: string;
  ballNumber: number;
  team: string;
  destinationLabel: string;
  potLabel?: string;
  groupIndex?: number;
  matchIndex?: number;
  isHome?: boolean;
}

// Gentle Web Audio API synthesizer for athletic draw ceremony sounds
function playAudioTone(type: "shuffle" | "reveal" | "finish") {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    if (type === "shuffle") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.08);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === "reveal") {
      // Pleasant two-tone chime
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(523.25, now); // C5
      gain1.gain.setValueAtTime(0.06, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(659.25, now + 0.1); // E5
      gain2.gain.setValueAtTime(0.07, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.35);
    } else if (type === "finish") {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = now + idx * 0.09;
        gain.gain.setValueAtTime(0.07, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.4);
      });
    }
  } catch {
    // Ignore audio errors gracefully
  }
}

export function DrawCeremonyModal({
  isOpen,
  format,
  teams,
  result,
  tournamentTitle,
  seededTeams,
  pot2Teams,
  pot3Teams,
  pot4Teams,
  onComplete,
}: DrawCeremonyModalProps) {
  const [stage, setStage] = useState<"intro" | "drawing" | "completed">("intro");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState<"normal" | "fast">("normal");
  const completedRef = useRef(false);

  const isGroupFormat = format === "groups" || format === "groups-knockout";

  // Build the sequential draw items based on actual result
  const drawSequence: DrawStepItem[] = useMemo(() => {
    if (!result) return [];

    const items: DrawStepItem[] = [];
    let ballNum = 1;

    if (result.format === "groups" || result.format === "groups-knockout") {
      const groups = result.groups || [];
      const maxTeamsInGroup = Math.max(...groups.map((g) => g.teams.length), 0);

      const hasAnySeeds =
        (seededTeams && seededTeams.length > 0) ||
        (pot2Teams && pot2Teams.length > 0) ||
        (pot3Teams && pot3Teams.length > 0) ||
        (pot4Teams && pot4Teams.length > 0);

      const drawnTeamNames = new Set<string>();

      if (hasAnySeeds) {
        // 1. Draw Pot 1 teams first
        if (seededTeams && seededTeams.length > 0) {
          for (const team of seededTeams) {
            const grpIdx = groups.findIndex((g) => g.teams.includes(team));
            if (grpIdx !== -1) {
              const grp = groups[grpIdx];
              drawnTeamNames.add(team);
              items.push({
                id: `pot1-${team}`,
                ballNumber: ballNum++,
                team,
                destinationLabel: `${grp.name} (سرگروه)`,
                potLabel: "سید ۱ (سرگروه)",
                groupIndex: grpIdx,
              });
            }
          }
        }

        // 2. Draw Pot 2 teams next
        if (pot2Teams && pot2Teams.length > 0) {
          for (const team of pot2Teams) {
            const grpIdx = groups.findIndex((g) => g.teams.includes(team));
            if (grpIdx !== -1) {
              const grp = groups[grpIdx];
              const slot = grp.teams.indexOf(team) + 1;
              drawnTeamNames.add(team);
              items.push({
                id: `pot2-${team}`,
                ballNumber: ballNum++,
                team,
                destinationLabel: `${grp.name} (جایگاه ${slot})`,
                potLabel: "سید ۲",
                groupIndex: grpIdx,
              });
            }
          }
        }

        // 3. Draw Pot 3 teams next
        if (pot3Teams && pot3Teams.length > 0) {
          for (const team of pot3Teams) {
            const grpIdx = groups.findIndex((g) => g.teams.includes(team));
            if (grpIdx !== -1) {
              const grp = groups[grpIdx];
              const slot = grp.teams.indexOf(team) + 1;
              drawnTeamNames.add(team);
              items.push({
                id: `pot3-${team}`,
                ballNumber: ballNum++,
                team,
                destinationLabel: `${grp.name} (جایگاه ${slot})`,
                potLabel: "سید ۳",
                groupIndex: grpIdx,
              });
            }
          }
        }

        // 4. Draw Pot 4 teams next
        if (pot4Teams && pot4Teams.length > 0) {
          for (const team of pot4Teams) {
            const grpIdx = groups.findIndex((g) => g.teams.includes(team));
            if (grpIdx !== -1) {
              const grp = groups[grpIdx];
              const slot = grp.teams.indexOf(team) + 1;
              drawnTeamNames.add(team);
              items.push({
                id: `pot4-${team}`,
                ballNumber: ballNum++,
                team,
                destinationLabel: `${grp.name} (جایگاه ${slot})`,
                potLabel: "سید ۴",
                groupIndex: grpIdx,
              });
            }
          }
        }

        // 5. Draw all unseeded teams round by round into open group positions
        for (let slot = 0; slot < maxTeamsInGroup; slot++) {
          for (let gIdx = 0; gIdx < groups.length; gIdx++) {
            const grp = groups[gIdx];
            const team = grp.teams[slot];
            if (team && !drawnTeamNames.has(team)) {
              drawnTeamNames.add(team);
              items.push({
                id: `unseeded-${gIdx}-${slot}`,
                ballNumber: ballNum++,
                team,
                destinationLabel: `${grp.name} (جایگاه ${slot + 1})`,
                potLabel: "قرعه آزاد (بدون سید)",
                groupIndex: gIdx,
              });
            }
          }
        }
      } else {
        // No seeds defined: draw round-by-round across all groups
        for (let slot = 0; slot < maxTeamsInGroup; slot++) {
          for (let gIdx = 0; gIdx < groups.length; gIdx++) {
            const grp = groups[gIdx];
            const team = grp.teams[slot];
            if (team) {
              items.push({
                id: `grp-${gIdx}-${slot}`,
                ballNumber: ballNum++,
                team,
                destinationLabel: `${grp.name} (جایگاه ${slot + 1})`,
                potLabel: `جایگاه ${slot + 1}`,
                groupIndex: gIdx,
              });
            }
          }
        }
      }
    } else if (result.format === "knockout") {
      const matches = (result.knockout.rounds[0]?.matches || []).filter(
        (m: BracketMatch) => !m.isBye && m.home && m.away
      );
      matches.forEach((m: BracketMatch, mIdx: number) => {
        items.push({
          id: `ko-${mIdx}-home`,
          ballNumber: ballNum++,
          team: m.home!,
          destinationLabel: `مسابقه ${mIdx + 1} (میزبان)`,
          matchIndex: mIdx,
          isHome: true,
        });
        items.push({
          id: `ko-${mIdx}-away`,
          ballNumber: ballNum++,
          team: m.away!,
          destinationLabel: `مسابقه ${mIdx + 1} (میهمان)`,
          matchIndex: mIdx,
          isHome: false,
        });
      });
    } else if (result.format === "double-knockout") {
      const matches = (result.doubleKnockout.winnersBracket[0]?.matches || []).filter(
        (m: BracketMatch) => !m.isBye && m.home && m.away
      );
      matches.forEach((m: BracketMatch, mIdx: number) => {
        items.push({
          id: `dko-${mIdx}-home`,
          ballNumber: ballNum++,
          team: m.home!,
          destinationLabel: `بازی ${mIdx + 1} جدول برندگان (میزبان)`,
          matchIndex: mIdx,
          isHome: true,
        });
        items.push({
          id: `dko-${mIdx}-away`,
          ballNumber: ballNum++,
          team: m.away!,
          destinationLabel: `بازی ${mIdx + 1} جدول برندگان (میهمان)`,
          matchIndex: mIdx,
          isHome: false,
        });
      });
    } else if (result.format === "league" || result.format === "double-league") {
      const matches = (result.rounds[0]?.matches || []).filter(
        (m: Match) => !m.isBye && m.home && m.away
      );
      matches.forEach((m: Match, mIdx: number) => {
        items.push({
          id: `lg-${mIdx}-home`,
          ballNumber: ballNum++,
          team: m.home,
          destinationLabel: `بازی ${mIdx + 1} هفته اول (میزبان)`,
          matchIndex: mIdx,
          isHome: true,
        });
        items.push({
          id: `lg-${mIdx}-away`,
          ballNumber: ballNum++,
          team: m.away,
          destinationLabel: `بازی ${mIdx + 1} هفته اول (میهمان)`,
          matchIndex: mIdx,
          isHome: false,
        });
      });
    }

    // Every team in the tournament is drawn through the complete authentic ceremony!
    return items;
  }, [result, seededTeams, pot2Teams, pot3Teams, pot4Teams]);

  // Manage ceremony stages and step timers
  useEffect(() => {
    if (!isOpen) {
      setStage("intro");
      setCurrentStepIndex(0);
      completedRef.current = false;
      return;
    }

    completedRef.current = false;
    setStage("intro");
    setCurrentStepIndex(0);

    // Intro lasts 1.2 seconds, then starts drawing balls
    const tIntro = setTimeout(() => {
      setStage("drawing");
      setCurrentStepIndex(0);
      if (soundEnabled) playAudioTone("reveal");
    }, 1200);

    return () => clearTimeout(tIntro);
  }, [isOpen, soundEnabled]);

  // Step-by-step timer during "drawing" stage
  useEffect(() => {
    if (stage !== "drawing" || isPaused) return;

    if (drawSequence.length === 0) {
      setStage("completed");
      return;
    }

    const stepDuration = speed === "fast" ? 600 : 1150;
    const stepTimer = setTimeout(() => {
      if (currentStepIndex + 1 < drawSequence.length) {
        setCurrentStepIndex((prev) => prev + 1);
        if (soundEnabled) playAudioTone("reveal");
      } else {
        // All balls drawn! Transition to completed stage
        setStage("completed");
        if (soundEnabled) playAudioTone("finish");
      }
    }, stepDuration);

    return () => clearTimeout(stepTimer);
  }, [stage, currentStepIndex, drawSequence, isPaused, speed, soundEnabled]);

  // Auto-advance to schedule page after completion celebration (~1.8s)
  useEffect(() => {
    if (stage !== "completed" || !isOpen) return;
    const tAuto = setTimeout(() => {
      handleFinish();
    }, 1800);
    return () => clearTimeout(tAuto);
  }, [stage, isOpen]);

  if (!isOpen) return null;

  const handleFinish = () => {
    if (!completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  };

  const currentDrawnItem = drawSequence[currentStepIndex];
  const drawnItemsSoFar = drawSequence.slice(0, currentStepIndex + 1);

  // Groups summary data
  const groupsList: GroupResult[] =
    result && (result.format === "groups" || result.format === "groups-knockout")
      ? result.groups
      : [];

  // Dynamic responsive max-width based on number of groups/teams
  const modalMaxWidthClass = useMemo(() => {
    const count = groupsList.length;
    if (count > 6) return "max-w-5xl";
    if (count > 4) return "max-w-4xl";
    return "max-w-2xl";
  }, [groupsList.length]);

  // Dynamic responsive grid columns for groups preview
  const groupGridColsClass = useMemo(() => {
    const count = groupsList.length;
    if (count <= 2) return "grid-cols-1 sm:grid-cols-2";
    if (count <= 4) return "grid-cols-2 sm:grid-cols-4";
    if (count <= 6) return "grid-cols-2 sm:grid-cols-3 md:grid-cols-6";
    if (count <= 8) return "grid-cols-2 sm:grid-cols-4 lg:grid-cols-4";
    return "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6";
  }, [groupsList.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`relative w-full ${modalMaxWidthClass} max-h-[92vh] sm:max-h-[90vh] rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/35 shadow-[0_0_60px_rgba(16,185,129,0.22)] text-white p-4 sm:p-6 md:p-7 overflow-hidden text-right flex flex-col justify-between`}>
        
        {/* Ambient Top Glows */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-96 -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/4 h-56 w-72 rounded-full bg-amber-500/15 blur-3xl" />

        {/* Top Control Bar */}
        <div className="shrink-0 relative z-10 flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
            <span className="rounded-full bg-rose-500/20 border border-rose-500/40 px-2.5 py-0.5 text-[11px] font-black text-rose-300">
              مراسم زنده قرعه‌کشی (Live Official Draw)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-500 transition-colors cursor-pointer"
              title={soundEnabled ? "بی‌صدا کردن مراسم" : "فعال‌سازی افکت صوتی"}
            >
              {soundEnabled ? "🔊 صدا فعال" : "🔇 بی‌صدا"}
            </button>

            <button
              type="button"
              onClick={handleFinish}
              className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 px-3.5 py-1.5 text-xs font-black text-white shadow-sm transition-all cursor-pointer"
            >
              <span>مشاهده مستقیم برنامه</span>
              <span>⏭️</span>
            </button>
          </div>
        </div>

        {/* Center Arena Section */}
        <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center overflow-y-auto py-1 custom-scrollbar">

          {/* STAGE 0: INTRO - THE DRAW TUMBLER (~1.5s) */}
          {stage === "intro" && (
            <div className="flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in duration-300 text-center py-6">
              {/* Spinning Sphere */}
              <div className="relative flex h-28 w-28 items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-400/60 animate-spin" style={{ animationDuration: "4s" }} />
                <div className="absolute inset-2 rounded-full border border-amber-400/40 animate-spin" style={{ animationDuration: "2.5s", animationDirection: "reverse" }} />
                
                <div className="absolute h-6 w-6 -top-1 left-7 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-glow flex items-center justify-center text-xs animate-bounce">
                  ⚽
                </div>
                <div className="absolute h-5 w-5 bottom-1 right-6 rounded-full bg-gradient-to-br from-emerald-300 to-emerald-500 shadow-glow flex items-center justify-center text-[10px]">
                  🌟
                </div>
                <div className="absolute h-5 w-5 top-8 right-1 rounded-full bg-gradient-to-br from-teal-300 to-teal-500 shadow-glow flex items-center justify-center text-[10px]">
                  🏆
                </div>

                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900/90 border border-emerald-500/40 shadow-inner text-2xl">
                  🎲
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-black text-white">
                  آغاز مراسم رسمی قرعه‌کشی {tournamentTitle || "مسابقات"}
                </h3>
                <p className="text-xs text-emerald-400 font-bold">
                  گوی‌های مسابقات در حال چرخش و ترکیب تصادفی در گردونه رسمی...
                </p>
              </div>
            </div>
          )}

          {/* STAGE 1: STEP-BY-STEP BALL DRAWING (~1.4s per ball) */}
          {stage === "drawing" && currentDrawnItem && (
            <div className="w-full space-y-4 animate-in fade-in duration-200">
              
              {/* The Spotlighted Drawn Capsule */}
              <div className="relative overflow-hidden rounded-2xl border-2 border-amber-400/60 bg-gradient-to-br from-slate-900 via-amber-950/20 to-slate-900 p-4 sm:p-5 shadow-[0_0_40px_rgba(245,158,11,0.25)] text-center space-y-2">
                <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-slate-950 font-black text-xs shadow-xs">
                      #{currentDrawnItem.ballNumber}
                    </span>
                    <span className="text-xs font-bold text-amber-300">
                      بیرون کشیده شد از گردونه
                    </span>
                    {currentDrawnItem.potLabel && (
                      <span className="rounded-full bg-amber-400/20 border border-amber-400/40 px-2.5 py-0.5 text-[10px] font-black text-amber-300">
                        {currentDrawnItem.potLabel}
                      </span>
                    )}
                  </div>

                  <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-0.5 text-xs font-bold text-emerald-300">
                    📍 {currentDrawnItem.destinationLabel}
                  </span>
                </div>

                {/* Big Bold Team Name with Glow */}
                <div className="py-2">
                  <span className="inline-block text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-[0_2px_12px_rgba(255,255,255,0.4)] animate-in zoom-in-95 duration-200">
                    🏆 {currentDrawnItem.team}
                  </span>
                </div>

                {/* Status Indicator */}
                <p className="text-[11px] text-slate-400 font-medium">
                  این تیم در جایگاه رسمی مسابقه ثبت و قفل گردید.
                </p>
              </div>

              {/* Live Populating Mini-Board Below */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 sm:p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-black text-slate-400 pb-1 border-b border-slate-800/80">
                  <span>جایگاه‌های ثبت‌شده تا این لحظه ({drawnItemsSoFar.length} از {drawSequence.length}):</span>
                  <span className="text-[11px] text-emerald-400 font-mono">
                    گوی {currentStepIndex + 1} از {drawSequence.length}
                  </span>
                </div>

                {/* Groups Preview or Clashes Preview */}
                {isGroupFormat && groupsList.length > 0 ? (
                  <div className={`grid ${groupGridColsClass} gap-2 max-h-[220px] sm:max-h-[280px] overflow-y-auto pr-1 custom-scrollbar`}>
                    {groupsList.map((grp, gIdx) => (
                      <div
                        key={grp.name}
                        className={`rounded-xl border p-2 text-xs transition-all ${
                          currentDrawnItem?.groupIndex === gIdx
                            ? "border-amber-400/90 bg-amber-950/25 ring-1 ring-amber-400/50 shadow-xs"
                            : "border-slate-800 bg-slate-900/70"
                        }`}
                      >
                        <span className="font-black text-amber-300 block mb-1">
                          {grp.name}
                        </span>
                        <div className="space-y-0.5">
                          {grp.teams.map((t, tIdx) => {
                            const isDrawn = drawnItemsSoFar.some((item) => item.team === t);
                            return isDrawn ? (
                              <div
                                key={t}
                                className="truncate text-[10px] font-bold text-white flex items-center gap-1 animate-in fade-in zoom-in-95 duration-200"
                              >
                                <span className="text-emerald-400 font-black">✓</span>
                                <span className="truncate">{t}</span>
                              </div>
                            ) : (
                              <div
                                key={tIdx}
                                className="truncate text-[10px] font-medium text-slate-600 flex items-center gap-1"
                              >
                                <span className="text-slate-700">○</span>
                                <span className="text-slate-500 italic">در انتظار قرعه</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[180px] sm:max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
                    {drawnItemsSoFar.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-800 bg-slate-900/80 p-2 flex items-center justify-between text-xs"
                      >
                        <span className="font-bold text-white truncate">{item.team}</span>
                        <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                          {item.destinationLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STAGE 2: FINAL CONFIRMATION & FULL DRAW SUMMARY (DOES NOT AUTO-CLOSE) */}
          {stage === "completed" && (
            <div className="w-full space-y-4 animate-in zoom-in-95 duration-300 text-center py-2">
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-3xl shadow-glow text-slate-950 animate-bounce">
                  🏆
                </div>
                <h3 className="text-xl font-black text-emerald-400">
                  قرعه‌کشی رسمی با موفقیت پایان یافت!
                </h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                  تمامی گوی‌ها در جایگاه‌های قانونی خود قرار گرفتند. می‌توانید جدول نهایی قرعه را بررسی فرمایید و سپس وارد برنامه مسابقات شوید:
                </p>
              </div>

              {/* Full Groups Summary Grid */}
              {isGroupFormat && groupsList.length > 0 && (
                <div className={`grid ${groupGridColsClass} gap-2.5 max-h-[260px] sm:max-h-[340px] overflow-y-auto text-right p-1 pr-2 custom-scrollbar`}>
                  {groupsList.map((grp) => (
                    <div
                      key={grp.name}
                      className="rounded-xl border border-emerald-500/30 bg-slate-900/90 p-2.5 space-y-1 shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-xs font-black text-amber-300 border-b border-slate-800 pb-1">
                        <span>{grp.name}</span>
                        <span className="text-[10px] text-slate-400">
                          {grp.teams.length} تیم
                        </span>
                      </div>
                      <div className="space-y-1">
                        {grp.teams.map((t, idx) => (
                          <div
                            key={t}
                            className="flex items-center gap-1.5 text-[11px] font-bold text-slate-200 truncate"
                          >
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] font-mono text-emerald-400">
                              {idx + 1}
                            </span>
                            <span className="truncate">{t}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Prominent Action Button to Proceed */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleFinish}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 hover:brightness-110 px-8 py-3 text-sm font-black text-white shadow-glow transition-all cursor-pointer"
                >
                  <span>ورود به جدول و تقویم مسابقات</span>
                  <span>➔</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Bottom Pacing & Step Controls */}
        <div className="relative z-10 mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 font-bold">
            {stage === "drawing" && (
              <>
                <button
                  type="button"
                  onClick={() => setIsPaused(!isPaused)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-slate-300 hover:border-slate-500 transition-colors cursor-pointer"
                >
                  {isPaused ? "▶️ ادامه مراسم" : "⏸️ مکث"}
                </button>

                <button
                  type="button"
                  onClick={() => setSpeed(speed === "normal" ? "fast" : "normal")}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-slate-300 hover:border-slate-500 transition-colors cursor-pointer"
                  title="تغییر سرعت پخش مراسم قرعه‌کشی"
                >
                  {speed === "normal" ? "⚡ سرعت ۲x" : "🐢 سرعت ۱x"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (currentStepIndex + 1 < drawSequence.length) {
                      setCurrentStepIndex((prev) => prev + 1);
                      if (soundEnabled) playAudioTone("reveal");
                    } else {
                      setStage("completed");
                      if (soundEnabled) playAudioTone("finish");
                    }
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-slate-300 hover:border-slate-500 transition-colors cursor-pointer"
                >
                  گام بعد ⏭️
                </button>
              </>
            )}
          </div>

          <span className="font-bold text-slate-400">
            {stage === "intro"
              ? "در حال بارگذاری گوی‌ها..."
              : stage === "drawing"
              ? `در حال نمایش استخراج گوی شماره ${currentStepIndex + 1}...`
              : "قرعه‌کشی با موفقیت تکمیل شد ✓"}
          </span>
        </div>

      </div>
    </div>
  );
}
