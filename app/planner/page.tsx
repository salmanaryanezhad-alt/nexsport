"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import {
  CompetitionFormat,
  ScheduleResult,
  ScheduleValidationError,
  generateSchedule,
  MatchScore,
  TournamentMetadata,
  formatScheduleAsText,
  exportScheduleToCsv,
  downloadCsvFile,
} from "@/lib/scheduling";
import { Stepper } from "@/components/planner/Stepper";
import { ScheduleView } from "@/components/planner/ScheduleView";

const STORAGE_KEY = "nexsport_wizard_state_v4";

const FORMAT_OPTIONS: { key: CompetitionFormat; title: string; desc: string }[] = [
  { key: "league", title: "لیگ", desc: "هر تیم یک‌بار با هر تیم دیگر بازی می‌کند." },
  { key: "double-league", title: "لیگ رفت و برگشت", desc: "هر تیم دو بار، یک‌بار در خانه و یک‌بار خارج از خانه." },
  { key: "groups", title: "مرحله گروهی", desc: "تقسیم تیم‌ها به چند گروه، با سیدبندی اختیاری." },
  { key: "groups-knockout", title: "گروهی + حذفی", desc: "مرحله گروهی و سپس براکت حذفی برای صعودکننده‌ها." },
  { key: "knockout", title: "حذفی", desc: "براکت تک‌حذفی با پشتیبانی از Bye." },
];

const STEP_LABELS = ["نوع مسابقه", "تعداد تیم‌ها", "نام تیم‌ها", "تنظیمات", "نتیجه"];

const PRESET_IRAN_LEAGUE = [
  "پرسپولیس",
  "استقلال",
  "سپاهان",
  "تراکتور",
  "فولاد خوزستان",
  "گل‌گهر سیرجان",
  "ملوان بندرانزلی",
  "ذوب‌آهن",
  "مس رفسنجان",
  "نساجی مازندران",
  "آلومینیوم اراک",
  "شمس‌آذر قزوین",
  "استقلال خوزستان",
  "خیبر خرم‌آباد",
  "چادرملو اردکان",
  "هوادار تهران",
];

const PRESET_EUROPE = [
  "رئال مادرید",
  "بارسلونا",
  "منچسترسیتی",
  "آرسنال",
  "بایرن مونیخ",
  "لیورپول",
  "اینتر میلان",
  "پاری‌سن‌ژرمن",
  "یوونتوس",
  "اتلتیکو مادرید",
  "دورتموند",
  "میلان",
  "چلسی",
  "بایر لورکوزن",
  "منچستر یونایتد",
  "اسپورتینگ",
];

const btnPrimary =
  "inline-flex items-center justify-center rounded-md bg-pitch px-4 py-2.5 text-sm font-semibold text-chalk transition-colors hover:bg-pitch-light disabled:cursor-not-allowed disabled:opacity-40";
const btnGhost =
  "inline-flex items-center justify-center rounded-md border border-line px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-line/40";

export default function PlannerPage() {
  const [step, setStep] = useState(0);
  const [format, setFormat] = useState<CompetitionFormat | null>(null);
  const [teamCount, setTeamCount] = useState(8);
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [numGroups, setNumGroups] = useState(2);
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(2);
  const [seededTeams, setSeededTeams] = useState<string[]>([]);
  const [avoidPairs, setAvoidPairs] = useState<[string, string][]>([]);
  const [hasThirdPlace, setHasThirdPlace] = useState(false);
  const [metadata, setMetadata] = useState<TournamentMetadata>({
    title: "",
    venue: "",
  });
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [scores, setScores] = useState<Record<string, MatchScore>>({});
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Bulk input modal state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [excelHasHeader, setExcelHasHeader] = useState(true);
  const [rawExcelRows, setRawExcelRows] = useState<string[]>([]);
  const excelInputRef = useRef<HTMLInputElement | null>(null);

  // Avoidance helper selector state
  const [avoidTeamA, setAvoidTeamA] = useState("");
  const [avoidTeamB, setAvoidTeamB] = useState("");

  // Restore from LocalStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.step === "number") setStep(parsed.step);
        if (parsed.format) setFormat(parsed.format);
        if (typeof parsed.teamCount === "number") setTeamCount(parsed.teamCount);
        if (Array.isArray(parsed.teamNames)) setTeamNames(parsed.teamNames);
        if (typeof parsed.numGroups === "number") setNumGroups(parsed.numGroups);
        if (typeof parsed.qualifiersPerGroup === "number")
          setQualifiersPerGroup(parsed.qualifiersPerGroup);
        if (Array.isArray(parsed.seededTeams)) setSeededTeams(parsed.seededTeams);
        if (Array.isArray(parsed.avoidPairs)) setAvoidPairs(parsed.avoidPairs);
        if (typeof parsed.hasThirdPlace === "boolean")
          setHasThirdPlace(parsed.hasThirdPlace);
        if (parsed.metadata) setMetadata(parsed.metadata);
        if (parsed.result) setResult(parsed.result);
        if (parsed.scores) setScores(parsed.scores);
      }
    } catch {
      // Ignore parse error
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save to LocalStorage whenever state changes
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          step,
          format,
          teamCount,
          teamNames,
          numGroups,
          qualifiersPerGroup,
          seededTeams,
          avoidPairs,
          hasThirdPlace,
          metadata,
          result,
          scores,
        })
      );
    } catch {
      // Ignore storage errors
    }
  }, [
    isLoaded,
    step,
    format,
    teamCount,
    teamNames,
    numGroups,
    qualifiersPerGroup,
    seededTeams,
    avoidPairs,
    hasThirdPlace,
    metadata,
    result,
    scores,
  ]);

  const needsGroupRules = format === "groups" || format === "groups-knockout";
  const needsSeedRules = format === "knockout" || needsGroupRules;
  const supportsThirdPlace = format === "knockout" || format === "groups-knockout";

  const namesReady =
    teamNames.length === teamCount && teamNames.every((t) => t.trim().length > 0);

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

  function handleAddAvoidPair() {
    if (!avoidTeamA || !avoidTeamB || avoidTeamA === avoidTeamB) return;
    const exists = avoidPairs.some(
      ([a, b]) =>
        (a === avoidTeamA && b === avoidTeamB) || (a === avoidTeamB && b === avoidTeamA)
    );
    if (!exists) {
      setAvoidPairs([...avoidPairs, [avoidTeamA, avoidTeamB]]);
    }
    setAvoidTeamA("");
    setAvoidTeamB("");
  }

  function handleRemoveAvoidPair(index: number) {
    setAvoidPairs(avoidPairs.filter((_, i) => i !== index));
  }

  function handleApplyBulk(names: string[]) {
    const valid = names.map((n) => n.trim()).filter((n) => n.length > 0);
    if (valid.length === 0) {
      alert("لطفاً حداقل ۱ نام تیم معتبر وارد کنید.");
      return;
    }

    const nextNames: string[] = [];
    // Populate up to teamCount
    for (let i = 0; i < teamCount; i++) {
      if (i < valid.length) {
        nextNames.push(valid[i]);
      } else {
        // Keep existing name or default
        nextNames.push(teamNames[i]?.trim() || `تیم ${i + 1}`);
      }
    }

    setTeamNames(nextNames);
    setShowBulkModal(false);
    setBulkText("");

    if (valid.length < teamCount) {
      const remaining = teamCount - valid.length;
      setInfoMessage(
        `✅ تعداد اسامی واردشده (${valid.length} تیم) کمتر از ظرفیت مسابقه بود؛ ${valid.length} تیم اول جایگزین شدند و ${remaining} تیم با نام پیش‌فرض باقی ماندند.`
      );
      setTimeout(() => setInfoMessage(null), 4500);
    } else if (valid.length > teamCount) {
      setInfoMessage(
        `⚠️ تعداد اسامی واردشده (${valid.length} تیم) بیشتر از تعداد تیم‌های مسابقه (${teamCount} تیم) است؛ تنها ${teamCount} تیم اول لیست به مسابقات وارد شدند.`
      );
      setTimeout(() => setInfoMessage(null), 5000);
    } else {
      setInfoMessage(`✅ تمامی ${teamCount} تیم انتخابی با موفقیت در لیست مسابقات قرار گرفتند!`);
      setTimeout(() => setInfoMessage(null), 3500);
    }
  }

  function handleToggleExcelHeader(checked: boolean) {
    setExcelHasHeader(checked);
    if (rawExcelRows.length > 0) {
      const names = checked ? rawExcelRows.slice(1) : rawExcelRows;
      setBulkText(names.join("\n"));
      setInfoMessage(
        checked
          ? "ℹ️ سطر اول فایل اکسل به عنوان عنوان نادیده گرفته شد."
          : "ℹ️ سطر اول فایل اکسل نیز به عنوان نام تیم در لیست قرار گرفت."
      );
      setTimeout(() => setInfoMessage(null), 3500);
    }
  }

  function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const firstSheetName = wb.SheetNames[0];
        if (!firstSheetName) {
          alert("فایل اکسل انتخاب‌شده هیچ برگه (Sheet) معتبری ندارد.");
          return;
        }
        const ws = wb.Sheets[firstSheetName];
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const extracted: string[] = [];

        for (const row of data) {
          if (
            Array.isArray(row) &&
            row.length > 0 &&
            row[0] !== undefined &&
            row[0] !== null
          ) {
            const val = String(row[0]).trim();
            if (val.length > 0) {
              extracted.push(val);
            }
          }
        }

        if (extracted.length === 0) {
          alert(
            "هیچ نام تیمی در ستون اول (ستون A) فایل اکسل یافت نشد. لطفاً دقت فرمایید اسامی تیم‌ها فقط در ستون اول نوشته شده باشند."
          );
          return;
        }

        setRawExcelRows(extracted);
        const names = excelHasHeader ? extracted.slice(1) : extracted;

        if (excelHasHeader && extracted.length === 1) {
          alert(
            "فایل اکسل تنها شامل ۱ سطر بود که با توجه به تیک «فایل اکسل عنوان دارد»، به عنوان عنوان شناسایی شد. تیک برداشته شد تا همین سطر به عنوان نام تیم خوانده شود."
          );
          setExcelHasHeader(false);
          setBulkText(extracted.join("\n"));
        } else {
          setBulkText(names.join("\n"));
        }

        setShowBulkModal(true);
        const count = excelHasHeader && extracted.length > 1 ? extracted.length - 1 : extracted.length;
        setInfoMessage(
          `📊 فایل اکسل با موفقیت خوانده شد (${count} نام تیم استخراج گردید).`
        );
        setTimeout(() => setInfoMessage(null), 4000);

        if (excelInputRef.current) {
          excelInputRef.current.value = "";
        }
      } catch {
        alert("خطا در پردازش فایل اکسل. لطفاً از فایل معتبر با پسوند xlsx یا csv استفاده فرمایید.");
      }
    };
    reader.readAsBinaryString(file);
  }

  function handleDownloadExcelTemplate() {
    const wb = XLSX.utils.book_new();
    const rows = [
      ["نام تیم (سطر عنوان)"],
      ["تیم پرسپولیس"],
      ["تیم استقلال"],
      ["تیم سپاهان"],
      ["تیم تراکتور"],
      ["تیم فولاد"],
      ["تیم گل‌گهر"],
      ["تیم ملوان"],
      ["تیم ذوب‌آهن"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "اسامی تیم‌ها");
    XLSX.writeFile(wb, "nexsport-sample-teams.xlsx");
  }

  function handleGenerate(isRedraw = false) {
    setError(null);
    try {
      if (!format) throw new ScheduleValidationError("نوع مسابقه انتخاب نشده است.");
      let r: ScheduleResult;

      const trimmedMetadata: TournamentMetadata = {
        title: metadata.title?.trim() || undefined,
        venue: metadata.venue?.trim() || undefined,
      };

      if (format === "groups" || format === "groups-knockout") {
        r = generateSchedule({
          format,
          teams: teamNames,
          numGroups,
          seededTeams,
          qualifiersPerGroup,
          avoidPairs,
          hasThirdPlace,
          metadata: trimmedMetadata,
        });
      } else if (format === "knockout") {
        r = generateSchedule({
          format,
          teams: teamNames,
          seededTeams,
          hasThirdPlace,
          metadata: trimmedMetadata,
        });
      } else {
        r = generateSchedule({
          format,
          teams: teamNames,
          metadata: trimmedMetadata,
        });
      }

      setResult(r);
      if (isRedraw) {
        setScores({});
        setInfoMessage("🎲 قرعه‌کشی مجدد با موفقیت انجام شد!");
        setTimeout(() => setInfoMessage(null), 3500);
      }
      setStep(4);
    } catch (e) {
      setError(
        e instanceof ScheduleValidationError
          ? e.message
          : "خطایی رخ داد. لطفاً دوباره تلاش کنید."
      );
    }
  }

  function handleReset() {
    if (
      window.confirm(
        "آیا مطمئن هستید که می‌خواهید مسابقه جدیدی بسازید؟ اطلاعات فعلی پاک خواهد شد."
      )
    ) {
      localStorage.removeItem(STORAGE_KEY);
      setStep(0);
      setFormat(null);
      setTeamCount(8);
      setTeamNames([]);
      setNumGroups(2);
      setQualifiersPerGroup(2);
      setSeededTeams([]);
      setAvoidPairs([]);
      setHasThirdPlace(false);
      setMetadata({ title: "", venue: "" });
      setResult(null);
      setScores({});
      setError(null);
      setInfoMessage(null);
    }
  }

  function handleResetScores() {
    if (
      window.confirm(
        "آیا مطمئن هستید؟ تمامی گل‌ها و نتایج ثبت‌شده پاک می‌شوند اما جدول بازی‌ها حفظ خواهد شد."
      )
    ) {
      setScores({});
      setInfoMessage("🧹 تمامی نتایج بازی‌ها بازنشانی شدند.");
      setTimeout(() => setInfoMessage(null), 3000);
    }
  }

  function handleScoreChange(
    matchId: string,
    home: number | null,
    away: number | null,
    homePenalty?: number | null,
    awayPenalty?: number | null,
    winner?: string | null
  ) {
    setScores((prev) => {
      const next = { ...prev };
      next[matchId] = {
        home,
        away,
        homePenalty:
          homePenalty !== undefined ? homePenalty : prev[matchId]?.homePenalty,
        awayPenalty:
          awayPenalty !== undefined ? awayPenalty : prev[matchId]?.awayPenalty,
        winner: winner !== undefined ? winner : prev[matchId]?.winner,
      };
      return next;
    });
  }

  async function handleCopyText() {
    if (!result) return;
    try {
      const text = formatScheduleAsText(result, scores);
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    } catch {
      alert("امکان کپی خودکار فراهم نشد. لطفاً دسترسی کلیپ‌بورد را بررسی کنید.");
    }
  }

  function handleDownloadCsv() {
    if (!result) return;
    const csv = exportScheduleToCsv(result, scores);
    downloadCsvFile(csv, `nexsport-${format ?? "schedule"}.csv`);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      {/* Top Bar */}
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="text-sm text-ink/60 hover:text-ink font-medium">
          ← بازگشت به صفحه اصلی
        </Link>
        <div className="flex items-center gap-3">
          {(step > 0 || result) && (
            <button
              onClick={handleReset}
              className="text-xs text-brick hover:underline font-semibold"
            >
              🔄 شروع مسابقه جدید
            </button>
          )}
        </div>
      </div>

      <div className="no-print mb-10">
        <Stepper labels={STEP_LABELS} current={step} />
      </div>

      {/* Info notification */}
      {infoMessage && (
        <div className="no-print mb-6 rounded-md border border-pitch/30 bg-pitch/10 px-4 py-3 text-sm font-semibold text-pitch animate-fade-in">
          {infoMessage}
        </div>
      )}

      {/* STEP 0: FORMAT SELECTION */}
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
                  (format === opt.key
                    ? "border-pitch bg-pitch/5"
                    : "border-line hover:border-pitch/40")
                }
              >
                <p className="font-semibold text-pitch">{opt.title}</p>
                <p className="mt-1.5 text-sm text-ink/60 leading-6">{opt.desc}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* STEP 1: TEAM COUNT */}
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

      {/* STEP 2: TEAM NAMES & BULK IMPORT */}
      {step === 2 && (
        <section>
          {/* Hidden Excel File Input */}
          <input
            type="file"
            ref={excelInputRef}
            accept=".xlsx, .xls, .csv"
            onChange={handleExcelUpload}
            className="hidden"
          />

          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">نام تیم‌ها</h1>
                <span className="rounded-full bg-pitch/10 px-3 py-0.5 text-xs font-bold text-pitch border border-pitch/20">
                  ظرفیت: {teamCount} تیم
                </span>
              </div>
              <p className="text-sm text-ink/60 mt-1">
                نام‌ها باید یکتا باشند؛ می‌توانید تایپ کنید، از فایل اکسل بخوانید یا پیست کنید.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowBulkModal(true);
                  excelInputRef.current?.click();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/40 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-sm"
                title="بارگذاری اسامی آماده از فایل اکسل (.xlsx یا .csv)"
              >
                <span>📊 بارگذاری از اکسل</span>
              </button>
              <button
                type="button"
                onClick={() => setShowBulkModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-pitch/40 bg-pitch/5 px-3.5 py-2 text-xs font-bold text-pitch hover:bg-pitch hover:text-chalk transition-colors shadow-sm"
              >
                <span>📋 ورود متنی / چسباندن</span>
              </button>
            </div>
          </div>

          {/* Bulk Paste Modal / Drawer */}
          {showBulkModal && (
            <div className="mb-6 rounded-xl border border-pitch/30 bg-pitch/5 p-5 animate-fade-in space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-pitch/15 pb-2.5">
                <h3 className="font-bold text-sm text-pitch">
                  ورود اسامی تیم‌ها (از طریق فایل اکسل یا چسباندن متن)
                </h3>
                <span className="rounded-full bg-pitch/10 px-3 py-0.5 text-xs font-bold text-pitch border border-pitch/20">
                  🎯 ظرفیت مسابقه: {teamCount} تیم
                </span>
              </div>

              {/* Excel notice & upload button & Header checkbox */}
              <div className="rounded-lg border border-emerald-300/80 bg-emerald-50/80 p-3.5 text-xs text-emerald-950 space-y-3 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-2 max-w-md">
                    <span className="text-base mt-0.5">📊</span>
                    <div className="leading-5">
                      <span className="font-extrabold text-emerald-900">
                        قانون بارگذاری اکسل:
                      </span>{" "}
                      اسامی تیم‌ها را صرفاً در{" "}
                      <strong className="underline decoration-emerald-600 font-bold">
                        ستون اول (ستون A)
                      </strong>{" "}
                      فایل اکسل وارد کنید. سطرهای خالی نادیده گرفته می‌شوند.
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => excelInputRef.current?.click()}
                      className="rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 transition-colors shadow-xs"
                    >
                      📁 بارگذاری فایل اکسل (.xlsx)
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadExcelTemplate}
                      className="text-xs text-emerald-800 underline hover:text-emerald-950 font-semibold"
                    >
                      دانلود قالب نمونه
                    </button>
                  </div>
                </div>

                {/* Checkbox: Does Excel have a header row? */}
                <div className="pt-2 border-t border-emerald-200/80 flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={excelHasHeader}
                      onChange={(e) => handleToggleExcelHeader(e.target.checked)}
                      className="h-4 w-4 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="font-bold text-emerald-900">
                      فایل اکسل عنوان دارد؟ (ردیف اول به عنوان سرستون خوانده نشود)
                    </span>
                  </label>
                  <span className="rounded bg-emerald-200/60 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
                    {excelHasHeader
                      ? "✓ ردیف اول عنوان است و نادیده گرفته می‌شود (پیش‌فرض)"
                      : "⚠️ ردیف اول نیز به عنوان نام تیم خوانده می‌شود"}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-ink/70">
                  یا اسامی را در کادر زیر پیست / تایپ کنید (هر تیم در یک سطر):
                </label>
                <textarea
                  rows={5}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={"پرسپولیس\nاستقلال\nسپاهان\nتراکتور"}
                  className="w-full rounded-md border border-line bg-white p-3 text-sm focus:border-pitch focus:outline-none"
                />
              </div>

              {bulkText.trim().length > 0 && (
                <div className="text-xs">
                  {bulkText.split(/[\n,]+/).map((s) => s.trim()).filter((s) => s.length > 0)
                    .length < teamCount && (
                    <span className="text-gold-dark font-medium">
                      ℹ️{" "}
                      {
                        bulkText
                          .split(/[\n,]+/)
                          .map((s) => s.trim())
                          .filter((s) => s.length > 0).length
                      }{" "}
                      تیم شناسایی شد. چون کمتر از {teamCount} تیم است، بقیه خانه‌ها با نام
                      پیش‌فرض باقی خواهند ماند.
                    </span>
                  )}
                  {bulkText.split(/[\n,]+/).map((s) => s.trim()).filter((s) => s.length > 0)
                    .length > teamCount && (
                    <span className="text-brick font-medium">
                      ⚠️{" "}
                      {
                        bulkText
                          .split(/[\n,]+/)
                          .map((s) => s.trim())
                          .filter((s) => s.length > 0).length
                      }{" "}
                      تیم شناسایی شد. چون بیشتر از ظرفیت است، تنها {teamCount} تیم اول وارد لیست
                      خواهند شد.
                    </span>
                  )}
                  {bulkText.split(/[\n,]+/).map((s) => s.trim()).filter((s) => s.length > 0)
                    .length === teamCount && (
                    <span className="text-pitch font-bold">
                      ✓ {teamCount} تیم شناسایی شد (دقیقاً برابر با ظرفیت انتخابی مسابقه).
                    </span>
                  )}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-ink/50">درج خودکار نمونه‌ها در کادر:</span>
                  <button
                    type="button"
                    onClick={() => setBulkText(PRESET_IRAN_LEAGUE.join("\n"))}
                    className="rounded bg-white border border-line px-2.5 py-1 hover:border-pitch text-ink/75 font-medium"
                    title="درج ۱۶ تیم لیگ برتر در کادر بالا"
                  >
                    🇮🇷 لیگ برتر ایران
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkText(PRESET_EUROPE.join("\n"))}
                    className="rounded bg-white border border-line px-2.5 py-1 hover:border-pitch text-ink/75 font-medium"
                    title="درج ۱۶ باشگاه برتر اروپا در کادر بالا"
                  >
                    ⚽ باشگاه‌های اروپا
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => setShowBulkModal(false)}
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => handleApplyBulk(bulkText.split(/[\n,]+/))}
                  >
                    ثبت در جدول ({teamCount} تیم)
                  </button>
                </div>
              </div>
            </div>
          )}

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

      {/* STEP 3: SETTINGS, SEEDING, METADATA & AVOIDANCE */}
      {step === 3 && format && (
        <section className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold mb-2">تنظیمات و قوانین مسابقه</h1>
            <p className="text-sm text-ink/60">
              این بخش کاملاً اختیاری است؛ در صورت عدم انتخاب، همه‌چیز استاندارد و عادلانه اجرا می‌شود.
            </p>
          </div>

          {/* Tournament Title & Venue Info */}
          <div className="rounded-xl border border-line bg-chalk/40 p-5 space-y-4">
            <h3 className="font-bold text-sm text-pitch">اطلاعات تورنمنت (جهت سربرگ رسمی و چاپ)</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-ink/70">نام مسابقه یا جام</span>
                <input
                  type="text"
                  value={metadata.title ?? ""}
                  onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                  placeholder="مثال: مسابقات جام رمضان یا لیگ فوتسال"
                  className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-ink/70">محل برگزاری / سالن / زمین</span>
                <input
                  type="text"
                  value={metadata.venue ?? ""}
                  onChange={(e) => setMetadata({ ...metadata, venue: e.target.value })}
                  placeholder="مثال: سالن ورزشی چمران - زمین شماره ۱"
                  className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>

          {/* Group Rules */}
          {needsGroupRules && (
            <div className="rounded-xl border border-line bg-chalk/40 p-5 space-y-4">
              <h3 className="font-bold text-sm text-pitch">تنظیمات گروه‌بندی</h3>
              <div className="grid gap-6 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-ink/70">تعداد گروه‌ها</span>
                  <input
                    type="number"
                    min={1}
                    max={teamCount}
                    value={numGroups}
                    onChange={(e) =>
                      setNumGroups(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
                  />
                </label>
                {format === "groups-knockout" && (
                  <label className="block">
                    <span className="text-xs font-semibold text-ink/70">
                      تعداد صعودکننده از هر گروه
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={qualifiersPerGroup}
                      onChange={(e) =>
                        setQualifiersPerGroup(Math.max(1, Number(e.target.value) || 1))
                      }
                      className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Avoidance Rule (Section 12 of spec) */}
          {needsGroupRules && numGroups > 1 && (
            <div className="rounded-xl border border-line bg-chalk/40 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-pitch">
                  قانون عدم برخورد در یک گروه (Avoidance Rule)
                </h3>
                <span className="text-[11px] text-ink/50">اختیاری</span>
              </div>
              <p className="text-xs text-ink/60">
                اگر دو تیم از یک باشگاه یا یک شهر هستند و نباید در یک گروه قرار بگیرند، جفت آن‌ها را
                انتخاب کنید:
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={avoidTeamA}
                  onChange={(e) => setAvoidTeamA(e.target.value)}
                  className="rounded-md border border-line bg-white px-3 py-1.5 text-xs"
                >
                  <option value="">انتخاب تیم اول...</option>
                  {teamNames.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-ink/40">↮</span>
                <select
                  value={avoidTeamB}
                  onChange={(e) => setAvoidTeamB(e.target.value)}
                  className="rounded-md border border-line bg-white px-3 py-1.5 text-xs"
                >
                  <option value="">انتخاب تیم دوم...</option>
                  {teamNames
                    .filter((t) => t !== avoidTeamA)
                    .map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                </select>
                <button
                  onClick={handleAddAvoidPair}
                  disabled={!avoidTeamA || !avoidTeamB || avoidTeamA === avoidTeamB}
                  className="rounded-md bg-pitch/10 px-3 py-1.5 text-xs font-bold text-pitch hover:bg-pitch hover:text-chalk disabled:opacity-40"
                >
                  + افزودن قانون عدم هم‌گروهی
                </button>
              </div>

              {avoidPairs.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {avoidPairs.map(([a, b], idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-xs text-ink"
                    >
                      <span className="font-semibold text-pitch">{a}</span>
                      <span className="text-ink/40">↮</span>
                      <span className="font-semibold text-pitch">{b}</span>
                      <button
                        onClick={() => handleRemoveAvoidPair(idx)}
                        className="mr-1 text-brick hover:font-bold"
                        title="حذف این قانون"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Third Place Playoff Option */}
          {supportsThirdPlace && (
            <div className="rounded-xl border border-line bg-chalk/40 p-5">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasThirdPlace}
                  onChange={(e) => setHasThirdPlace(e.target.checked)}
                  className="h-4 w-4 rounded border-line text-pitch focus:ring-pitch"
                />
                <div>
                  <span className="text-sm font-bold text-pitch">
                    برگزاری مسابقه رده‌بندی برای مقام سوم (Third Place Playoff)
                  </span>
                  <p className="text-xs text-ink/60 mt-0.5">
                    بازنده‌های دو نیمه‌نهایی برای کسب مدال برنز و جایگاه سوم با یکدیگر رقابت خواهند کرد.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Seeded Teams Selection */}
          {needsSeedRules && (
            <div className="rounded-xl border border-line bg-chalk/40 p-5 space-y-3">
              <p className="text-sm font-bold text-pitch">
                تیم‌های شاخص / سرگروه {needsGroupRules ? `(حداکثر ${numGroups} تیم)` : ""}
              </p>
              <p className="text-xs text-ink/60">
                به ترتیبی که کلیک می‌کنید، اولویت سیدبندی تعیین می‌شود. برای لغو دوباره روی نام تیم
                کلیک کنید.
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
                        (selected
                          ? "border-gold bg-gold/20 text-ink font-bold"
                          : "border-line bg-white text-ink/70 hover:border-pitch/40")
                      }
                    >
                      {selected && <span className="ml-1.5 font-bold">{idx + 1}</span>}
                      {team}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-md border border-brick/30 bg-brick/5 px-4 py-3 text-sm text-brick">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button className={btnGhost} onClick={() => setStep(2)}>
              مرحله قبل
            </button>
            <button className={btnPrimary} onClick={() => handleGenerate(false)}>
              تولید برنامه مسابقات
            </button>
          </div>
        </section>
      )}

      {/* STEP 4: RESULTS VIEW */}
      {step === 4 && result && (
        <section>
          {/* Action Toolbar */}
          <div className="no-print mb-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white/70 p-4 shadow-sm">
            <div>
              <h1 className="text-xl font-bold text-pitch">
                {result.metadata?.title || "برنامه مسابقات NexSport"}
              </h1>
              <p className="text-xs text-ink/60 mt-0.5">
                ثبت نتایج، ضربات پنالتی، چاپ رسمی، خروجی اکسل یا اشتراک در پیام‌رسان‌ها.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                className={btnGhost}
                onClick={() => handleGenerate(true)}
                title="تولید قرعه‌کشی جدید با همین تیم‌ها و تنظیمات"
              >
                🎲 قرعه‌کشی مجدد
              </button>

              <button
                className={btnGhost}
                onClick={handleCopyText}
                title="کپی متن کامل برنامه برای پیام‌رسان‌ها (تلگرام و واتس‌اپ)"
              >
                {copiedText ? "✅ کپی شد!" : "📋 کپی متن"}
              </button>

              <button
                className={btnGhost}
                onClick={handleDownloadCsv}
                title="دریافت فایل اکسل / CSV با پشتیبانی کامل از زبان فارسی"
              >
                📊 خروجی اکسل
              </button>

              <button
                className={btnGhost}
                onClick={() => setStep(3)}
                title="تغییر گروه‌ها، سرگروه‌ها یا تنظیمات"
              >
                ⚙️ ویرایش تنظیمات
              </button>

              <button className={btnPrimary} onClick={() => window.print()}>
                🖨️ چاپ / PDF
              </button>
            </div>
          </div>

          <ScheduleView
            result={result}
            scores={scores}
            onScoreChange={handleScoreChange}
            onResetScores={handleResetScores}
            teams={teamNames}
            qualifiersPerGroup={qualifiersPerGroup}
          />
        </section>
      )}
    </main>
  );
}
