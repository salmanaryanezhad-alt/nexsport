"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CompetitionFormat,
  ScheduleResult,
  ScheduleValidationError,
  generateSchedule,
} from "@/lib/scheduling";
import { Stepper } from "@/components/planner/Stepper";
import { ScheduleView } from "@/components/planner/ScheduleView";

const FORMAT_OPTIONS: { key: CompetitionFormat; title: string; desc: string }[] = [
  { key: "league", title: "لیگ", desc: "هر تیم یک‌بار با هر تیم دیگر بازی می‌کند." },
  { key: "double-league", title: "لیگ رفت و برگشت", desc: "هر تیم دو بار، یک‌بار در خانه و یک‌بار خارج از خانه." },
  { key: "groups", title: "مرحله گروهی", desc: "تقسیم تیم‌ها به چند گروه، با سیدبندی اختیاری." },
  { key: "groups-knockout", title: "گروهی + حذفی", desc: "مرحله گروهی و سپس براکت حذفی برای صعودکننده‌ها." },
  { key: "knockout", title: "حذفی", desc: "براکت تک‌حذفی با پشتیبانی از Bye." },
];

const STEP_LABELS = ["نوع مسابقه", "تعداد تیم‌ها", "نام تیم‌ها", "تنظیمات", "نتیجه"];

const btnPrimary =
  "inline-flex items-center justify-center rounded-md bg-pitch px-5 py-2.5 text-sm font-semibold text-chalk transition-colors hover:bg-pitch-light disabled:cursor-not-allowed disabled:opacity-40";
const btnGhost =
  "inline-flex items-center justify-center rounded-md border border-line px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-line/40";

export default function PlannerPage() {
  const [step, setStep] = useState(0);
  const [format, setFormat] = useState<CompetitionFormat | null>(null);
  const [teamCount, setTeamCount] = useState(8);
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [numGroups, setNumGroups] = useState(2);
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(2);
  const [seededTeams, setSeededTeams] = useState<string[]>([]);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const needsGroupRules = format === "groups" || format === "groups-knockout";
  const needsSeedRules = format === "knockout" || needsGroupRules;

  const namesReady = teamNames.length === teamCount && teamNames.every((t) => t.trim().length > 0);

  function ensureNames() {
    setTeamNames((prev) => {
      const next = [...prev];
      while (next.length < teamCount) next.push(`تیم ${next.length + 1}`);
      return next.slice(0, teamCount);
    });
  }

  function toggleSeed(team: string) {
    setSeededTeams((prev) =>
      prev.includes(team) ? prev.filter((t) => t !== team) : [...prev, team]
    );
  }

  function handleGenerate() {
    setError(null);
    try {
      if (!format) throw new ScheduleValidationError("نوع مسابقه انتخاب نشده است.");
      if (format === "groups" || format === "groups-knockout") {
        const r = generateSchedule({
          format,
          teams: teamNames,
          numGroups,
          seededTeams,
          qualifiersPerGroup,
        });
        setResult(r);
      } else if (format === "knockout") {
        setResult(generateSchedule({ format, teams: teamNames, seededTeams }));
      } else {
        setResult(generateSchedule({ format, teams: teamNames }));
      }
      setStep(4);
    } catch (e) {
      setError(e instanceof ScheduleValidationError ? e.message : "خطایی رخ داد. لطفاً دوباره تلاش کنید.");
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-10 flex items-center justify-between">
        <Link href="/" className="text-sm text-ink/50 hover:text-ink">
          ← بازگشت به صفحه اصلی
        </Link>
      </div>

      <div className="no-print mb-10">
        <Stepper labels={STEP_LABELS} current={step} />
      </div>

      {step === 0 && (
        <section>
          <h1 className="text-2xl font-bold mb-6">نوع مسابقه را انتخاب کنید</h1>
          <div className="grid gap-4 sm:grid-cols-2">
            {FORMAT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  setFormat(opt.key);
                  setStep(1);
                }}
                className={
                  "rounded-md border p-5 text-right transition-colors " +
                  (format === opt.key ? "border-pitch bg-pitch/5" : "border-line hover:border-pitch/40")
                }
              >
                <p className="font-semibold text-pitch">{opt.title}</p>
                <p className="mt-1.5 text-sm text-ink/60 leading-6">{opt.desc}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 1 && (
        <section>
          <h1 className="text-2xl font-bold mb-2">تعداد تیم‌ها</h1>
          <p className="text-sm text-ink/60 mb-6">حداقل ۲ تیم لازم است.</p>
          <input
            type="number"
            min={2}
            max={128}
            value={teamCount}
            onChange={(e) => setTeamCount(Math.max(2, Number(e.target.value) || 2))}
            className="w-40 rounded-md border border-line px-4 py-2.5 text-lg"
          />
          <div className="mt-10 flex gap-3">
            <button className={btnGhost} onClick={() => setStep(0)}>
              مرحله قبل
            </button>
            <button
              className={btnPrimary}
              onClick={() => {
                ensureNames();
                setStep(2);
              }}
            >
              مرحله بعد
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section>
          <h1 className="text-2xl font-bold mb-2">نام تیم‌ها</h1>
          <p className="text-sm text-ink/60 mb-6">نام‌ها باید یکتا باشند؛ می‌توانید نام پیش‌فرض را ویرایش کنید.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: teamCount }).map((_, i) => (
              <input
                key={i}
                value={teamNames[i] ?? ""}
                onChange={(e) => {
                  const next = [...teamNames];
                  next[i] = e.target.value;
                  setTeamNames(next);
                }}
                className="rounded-md border border-line px-4 py-2 text-sm"
                placeholder={`تیم ${i + 1}`}
              />
            ))}
          </div>
          <div className="mt-10 flex gap-3">
            <button className={btnGhost} onClick={() => setStep(1)}>
              مرحله قبل
            </button>
            <button
              className={btnPrimary}
              disabled={!namesReady}
              onClick={() => setStep(3)}
            >
              مرحله بعد
            </button>
          </div>
        </section>
      )}

      {step === 3 && format && (
        <section>
          <h1 className="text-2xl font-bold mb-2">تنظیمات (اختیاری)</h1>
          <p className="text-sm text-ink/60 mb-6">
            اگر چیزی انتخاب نکنید، قرعه‌کشی کاملاً تصادفی انجام می‌شود.
          </p>

          {needsGroupRules && (
            <div className="mb-8 grid gap-6 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">تعداد گروه‌ها</span>
                <input
                  type="number"
                  min={1}
                  max={teamCount}
                  value={numGroups}
                  onChange={(e) => setNumGroups(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1.5 w-full rounded-md border border-line px-4 py-2"
                />
              </label>
              {format === "groups-knockout" && (
                <label className="block">
                  <span className="text-sm font-medium">تعداد صعودکننده از هر گروه</span>
                  <input
                    type="number"
                    min={1}
                    value={qualifiersPerGroup}
                    onChange={(e) => setQualifiersPerGroup(Math.max(1, Number(e.target.value) || 1))}
                    className="mt-1.5 w-full rounded-md border border-line px-4 py-2"
                  />
                </label>
              )}
            </div>
          )}

          {needsSeedRules && (
            <div>
              <p className="text-sm font-medium mb-1">
                تیم‌های شاخص / سرگروه {needsGroupRules ? `(حداکثر ${numGroups} تیم)` : ""}
              </p>
              <p className="text-xs text-ink/50 mb-3">
                به ترتیبی که کلیک می‌کنید، اولویت سیدبندی تعیین می‌شود. برای حذف یک تیم از لیست دوباره روی آن کلیک کنید.
              </p>
              <div className="flex flex-wrap gap-2">
                {teamNames.map((team) => {
                  const idx = seededTeams.indexOf(team);
                  const selected = idx !== -1;
                  return (
                    <button
                      key={team}
                      onClick={() => toggleSeed(team)}
                      className={
                        "rounded-full border px-3.5 py-1.5 text-sm transition-colors " +
                        (selected ? "border-gold bg-gold/20 text-ink" : "border-line text-ink/70 hover:border-pitch/40")
                      }
                    >
                      {selected && <span className="ml-1.5 font-semibold">{idx + 1}</span>}
                      {team}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!needsGroupRules && !needsSeedRules && (
            <p className="text-sm text-ink/60">این فرمت تنظیمات اضافی ندارد.</p>
          )}

          {error && (
            <p className="mt-6 rounded-md border border-brick/30 bg-brick/5 px-4 py-3 text-sm text-brick">
              {error}
            </p>
          )}

          <div className="mt-10 flex gap-3">
            <button className={btnGhost} onClick={() => setStep(2)}>
              مرحله قبل
            </button>
            <button className={btnPrimary} onClick={handleGenerate}>
              تولید برنامه
            </button>
          </div>
        </section>
      )}

      {step === 4 && result && (
        <section>
          <div className="no-print mb-8 flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-2xl font-bold">برنامه مسابقات</h1>
            <div className="flex gap-3">
              <button className={btnGhost} onClick={() => setStep(3)}>
                ویرایش تنظیمات
              </button>
              <button className={btnPrimary} onClick={() => window.print()}>
                چاپ / ذخیره PDF
              </button>
            </div>
          </div>
          <ScheduleView result={result} />
        </section>
      )}
    </main>
  );
}
