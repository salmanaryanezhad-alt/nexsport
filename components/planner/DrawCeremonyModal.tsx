"use client";

import React, { useState, useEffect, useRef } from "react";
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
  onComplete: () => void;
}

// Gentle Web Audio API synthesizer for athletic draw ceremony sounds
function playAudioTone(type: "shuffle" | "reveal" | "finish") {
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.07);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    } else if (type === "reveal") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(840, now + 0.16);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === "finish") {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = now + idx * 0.08;
        gain.gain.setValueAtTime(0.06, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.35);
      });
    }
  } catch {
    // Ignore audio permission or playback errors
  }
}

export function DrawCeremonyModal({
  isOpen,
  format,
  teams,
  result,
  tournamentTitle,
  onComplete,
}: DrawCeremonyModalProps) {
  const [phase, setPhase] = useState<"mixing" | "revealing" | "confirmed">("mixing");
  const [currentShuffleName, setCurrentShuffleName] = useState("");
  const [revealedItemsCount, setRevealedItemsCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const completedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setPhase("mixing");
      setRevealedItemsCount(0);
      setProgress(0);
      completedRef.current = false;
      return;
    }

    completedRef.current = false;
    setPhase("mixing");
    setProgress(5);

    // 1. Shuffling phase (0 - 1300ms)
    let shuffleInterval: NodeJS.Timeout | null = null;
    let shuffleCounter = 0;
    const teamPool = teams.length > 0 ? teams : ["تیم ۱", "تیم ۲", "تیم ۳", "تیم ۴"];

    shuffleInterval = setInterval(() => {
      const randomIdx = Math.floor(Math.random() * teamPool.length);
      setCurrentShuffleName(teamPool[randomIdx]);
      shuffleCounter++;
      if (soundEnabled && shuffleCounter % 3 === 0) {
        playAudioTone("shuffle");
      }
    }, 80);

    // Progress tick
    const progressTimer = setInterval(() => {
      setProgress((prev) => (prev < 95 ? prev + 2.5 : prev));
    }, 80);

    // Transition to Stage 2: Revealing (at 1300ms)
    const tRevealing = setTimeout(() => {
      if (shuffleInterval) clearInterval(shuffleInterval);
      setPhase("revealing");
      if (soundEnabled) playAudioTone("reveal");

      // Stagger item reveals
      const revealStep1 = setTimeout(() => {
        setRevealedItemsCount(2);
        if (soundEnabled) playAudioTone("reveal");
      }, 400);

      const revealStep2 = setTimeout(() => {
        setRevealedItemsCount(4);
        if (soundEnabled) playAudioTone("reveal");
      }, 900);

      const revealStep3 = setTimeout(() => {
        setRevealedItemsCount(8);
        if (soundEnabled) playAudioTone("reveal");
      }, 1400);

      return () => {
        clearTimeout(revealStep1);
        clearTimeout(revealStep2);
        clearTimeout(revealStep3);
      };
    }, 1300);

    // Transition to Stage 3: Confirmed (at 3200ms)
    const tConfirmed = setTimeout(() => {
      setPhase("confirmed");
      setProgress(100);
      if (soundEnabled) playAudioTone("finish");
    }, 3200);

    // Auto complete and close (at 4200ms)
    const tDone = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
    }, 4200);

    return () => {
      if (shuffleInterval) clearInterval(shuffleInterval);
      clearInterval(progressTimer);
      clearTimeout(tRevealing);
      clearTimeout(tConfirmed);
      clearTimeout(tDone);
    };
  }, [isOpen, teams, soundEnabled, onComplete]);

  if (!isOpen) return null;

  const handleSkip = () => {
    if (!completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  };

  // Extract preview data from ScheduleResult
  const isGroupFormat = format === "groups" || format === "groups-knockout";

  // Groups preview data
  const groupsData: GroupResult[] =
    result && (result.format === "groups" || result.format === "groups-knockout")
      ? result.groups
      : [];

  // Matchups preview data
  let openingMatches: { home: string; away: string }[] = [];
  if (result) {
    if (result.format === "knockout") {
      openingMatches = (result.knockout.rounds[0]?.matches || [])
        .filter((m: BracketMatch) => !m.isBye && m.home && m.away)
        .slice(0, 4)
        .map((m: BracketMatch) => ({ home: m.home!, away: m.away! }));
    } else if (result.format === "double-knockout") {
      openingMatches = (result.doubleKnockout.winnersBracket[0]?.matches || [])
        .filter((m: BracketMatch) => !m.isBye && m.home && m.away)
        .slice(0, 4)
        .map((m: BracketMatch) => ({ home: m.home!, away: m.away! }));
    } else if (result.format === "league" || result.format === "double-league") {
      openingMatches = (result.rounds[0]?.matches || [])
        .filter((m: Match) => !m.isBye && m.home && m.away)
        .slice(0, 4)
        .map((m: Match) => ({ home: m.home, away: m.away }));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/35 shadow-[0_0_60px_rgba(16,185,129,0.22)] text-white p-5 sm:p-8 overflow-hidden text-right">
        
        {/* Ambient Top Glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-96 -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/4 h-56 w-72 rounded-full bg-amber-500/15 blur-3xl" />

        {/* Top Control Bar */}
        <div className="relative z-10 flex items-center justify-between border-b border-slate-800 pb-3 mb-5">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
            <span className="rounded-full bg-rose-500/20 border border-rose-500/40 px-2.5 py-0.5 text-[11px] font-black text-rose-300">
              مراسم رسمی قرعه‌کشی (Live Draw)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-500 transition-colors cursor-pointer"
              title={soundEnabled ? "بی‌صدا کردن مراسم" : "فعال‌سازی افکت صوتی"}
            >
              {soundEnabled ? "🔊 صدا فعال" : "🔇 بی‌صدا"}
            </button>

            <button
              type="button"
              onClick={handleSkip}
              className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 px-3.5 py-1.5 text-xs font-black text-white shadow-sm transition-all cursor-pointer"
            >
              <span>مشاهده مستقیم</span>
              <span>⏭️</span>
            </button>
          </div>
        </div>

        {/* Tournament Title & Subtitle */}
        <div className="relative z-10 text-center space-y-1 mb-5">
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            <NexSportIcon size={26} className="shrink-0 drop-shadow-md" />
            <span>{tournamentTitle || "قرعه‌کشی رسمی مسابقات نکس‌اسپورت"}</span>
          </h2>
          <p className="text-xs text-slate-400">
            تخصیص عادلانه و تصادفی گوی‌ها بر اساس استاندارد‌های فدراسیون جهانی
          </p>
        </div>

        {/* Dynamic Centerpiece Section */}
        <div className="relative z-10 min-h-[260px] flex flex-col items-center justify-center rounded-2xl border border-slate-800/90 bg-slate-950/60 p-4 sm:p-6 backdrop-blur-xs">
          
          {/* PHASE 1: MIXING THE POT (گردونه گوی‌ها) */}
          {phase === "mixing" && (
            <div className="flex flex-col items-center justify-center space-y-5 animate-in fade-in zoom-in duration-300 w-full">
              {/* Animated Glass Tumbler / Sphere */}
              <div className="relative flex h-28 w-28 items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-400/50 animate-spin" style={{ animationDuration: "5s" }} />
                <div className="absolute inset-2 rounded-full border border-amber-400/40 animate-spin" style={{ animationDuration: "3s", animationDirection: "reverse" }} />
                
                {/* Floating Balls Inside */}
                <div className="absolute h-6 w-6 -top-1 left-7 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-glow flex items-center justify-center text-xs animate-bounce">
                  ⚽
                </div>
                <div className="absolute h-5 w-5 bottom-1 right-6 rounded-full bg-gradient-to-br from-emerald-300 to-emerald-500 shadow-glow flex items-center justify-center text-[10px]">
                  🌟
                </div>
                <div className="absolute h-5 w-5 top-8 right-1 rounded-full bg-gradient-to-br from-teal-300 to-teal-500 shadow-glow flex items-center justify-center text-[10px]">
                  🏆
                </div>

                {/* Central Pot Icon */}
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900/90 border border-emerald-500/40 shadow-inner text-2xl">
                  🎲
                </div>
              </div>

              {/* Shuffling Team Slot */}
              <div className="text-center space-y-1 w-full max-w-sm">
                <span className="text-[11px] font-bold text-slate-400 block">
                  در حال مخلوط‌سازی و چرخش تصادفی گوی‌ها...
                </span>
                <div className="h-10 rounded-xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-emerald-950/60 border border-emerald-500/40 px-4 py-2 flex items-center justify-center shadow-inner">
                  <span className="text-base font-black text-amber-300 tracking-wide truncate">
                    {currentShuffleName || "آماده‌سازی پات..."}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* PHASE 2: REVEALING MATCHUPS & GROUPS (بیرون کشیدن و تخصیص جایگاه‌ها) */}
          {phase === "revealing" && (
            <div className="w-full space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                  <span className="animate-spin text-sm">🔄</span>
                  <span>گوی‌های بیرون کشیده شده و ثبت در جدول:</span>
                </span>
                <span className="text-[11px] text-amber-400 font-bold">
                  {isGroupFormat ? "تخصیص به گروه‌ها" : "تشکیل نبردهای مرحله اول"}
                </span>
              </div>

              {/* Groups Presentation */}
              {isGroupFormat && groupsData.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[170px] overflow-y-auto pr-1">
                  {groupsData.slice(0, 6).map((grp, idx) => (
                    <div
                      key={grp.name}
                      className="rounded-xl border border-slate-700/80 bg-slate-900/90 p-2.5 space-y-1.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-xs font-black text-amber-300 border-b border-slate-800 pb-1">
                        <span>{grp.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {grp.teams.length} تیم
                        </span>
                      </div>
                      <div className="space-y-1">
                        {grp.teams.slice(0, 3).map((t, tIdx) => (
                          <div
                            key={t}
                            className={`flex items-center gap-1.5 text-[11px] font-bold text-slate-200 truncate ${
                              tIdx < revealedItemsCount ? "animate-in fade-in duration-200" : "opacity-40"
                            }`}
                          >
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] font-mono text-emerald-400">
                              {tIdx + 1}
                            </span>
                            <span className="truncate">{t}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Matchups Presentation (Knockout / League) */}
              {!isGroupFormat && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[170px] overflow-y-auto pr-1">
                  {openingMatches.length > 0 ? (
                    openingMatches.map((m, idx) => (
                      <div
                        key={idx}
                        className={`rounded-xl border border-slate-800 bg-slate-900/90 p-2.5 flex items-center justify-between gap-2 shadow-2xs transition-all ${
                          idx < revealedItemsCount
                            ? "border-emerald-500/50 bg-emerald-950/20 shadow-glow"
                            : "opacity-40"
                        }`}
                      >
                        <span className="text-xs font-black text-slate-200 truncate flex-1 text-center">
                          {m.home}
                        </span>
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-300 shrink-0">
                          ⚔️ بازی {idx + 1}
                        </span>
                        <span className="text-xs font-black text-slate-200 truncate flex-1 text-center">
                          {m.away}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center text-xs text-slate-400 py-6">
                      جدول مسابقات با موفقیت ترسیم شد...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PHASE 3: CONFIRMED & SEAL OF APPROVAL (تایید و نهایی‌سازی) */}
          {phase === "confirmed" && (
            <div className="flex flex-col items-center justify-center space-y-3 animate-in zoom-in duration-300 py-3 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-3xl shadow-glow text-slate-950 animate-bounce">
                🏆
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-emerald-400">
                  قرعه‌کشی رسمی با موفقیت نهایی شد!
                </h3>
                <p className="text-xs text-slate-300 max-w-sm leading-relaxed">
                  تمامی تقاطع‌ها، سیدبندی‌ها و هفته‌های مسابقاتی با توازن کامل و بدون بازی تکراری ثبت شدند.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSkip}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 px-6 py-2.5 text-xs font-black text-white shadow-glow transition-all cursor-pointer"
              >
                <span>مشاهده برنامه و جدول مسابقات</span>
                <span>➔</span>
              </button>
            </div>
          )}
        </div>

        {/* Progress Bar Footer */}
        <div className="relative z-10 mt-5 pt-3 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold">
            <span>
              {phase === "mixing"
                ? "مرحله ۱: تصادفی‌سازی گوی‌های قرعه‌کشی..."
                : phase === "revealing"
                ? "مرحله ۲: جای‌گذاری تیم‌ها و تشکیل تقویم مسابقات..."
                : "مرحله ۳: تایید نهایی و آماده‌سازی جدول..."}
            </span>
            <span className="font-mono text-emerald-400 font-black">
              {Math.min(100, Math.round(progress))}%
            </span>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
