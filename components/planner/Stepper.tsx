import React from "react";
import { toPersianDigits } from "@/lib/digits";

export function Stepper({ labels, current }: { labels: string[]; current: number }) {
  const progressPercent = Math.min(100, Math.round((current / (labels.length - 1)) * 100));

  return (
    <nav aria-label="مراحل برنامه‌ریزی مسابقات" className="w-full space-y-2.5">
      {/* Progress track */}
      <div className="relative w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 via-pitch to-amber-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Steps Pill List */}
      <ol className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-2 bg-white p-1.5 sm:p-2 rounded-2xl border border-slate-200/90 shadow-card">
        {labels.map((label, i) => {
          const isDone = i < current;
          const isActive = i === current;

          return (
            <li
              key={label}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 px-2 sm:px-3 rounded-xl transition-all ${
                isActive
                  ? "bg-slate-900 text-white font-black shadow-md ring-2 ring-emerald-500/30"
                  : isDone
                  ? "bg-emerald-50 text-emerald-900 font-bold border border-emerald-200/60"
                  : "bg-transparent text-slate-400 font-medium"
              }`}
            >
              <span
                className={`flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full text-[10px] sm:text-xs font-black shrink-0 transition-transform ${
                  isActive
                    ? "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-xs scale-105"
                    : isDone
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {isDone ? "✓" : toPersianDigits(i + 1)}
              </span>
              <span className="text-[11px] sm:text-xs truncate">{label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
