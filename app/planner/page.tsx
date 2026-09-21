"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  calculateDefaultNumGroups,
  nextPowerOfTwo,
  MatchScheduleDetail,
  PointsRule,
} from "@/lib/scheduling";
import { Stepper } from "@/components/planner/Stepper";
import { ScheduleView } from "@/components/planner/ScheduleView";
import { NexSportIcon } from "@/components/NexSportLogo";
import { AuthHeaderNav } from "@/components/auth/AuthHeaderNav";
import { useAuth } from "@/components/auth/AuthContext";
import {
  SavedTournamentsModal,
  SavedTournamentItem,
} from "@/components/planner/SavedTournamentsModal";

const STORAGE_KEY = "nexsport_wizard_state_v4";

function BracketSvgIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 5h5v5H3" />
      <path d="M3 14h5v5H3" />
      <path d="M8 7.5h6v9H8" />
      <path d="M14 12h7" />
      <circle cx="21" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

interface FormatCardInfo {
  key: CompetitionFormat;
  title: string;
  subtitle: string;
  category: "tournament" | "league";
  icon: React.ReactNode;
  tag: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  desc: string;
  idealFor: string;
  features: string[];
  recommended?: boolean;
}

const FORMAT_OPTIONS: FormatCardInfo[] = [
  {
    key: "groups-knockout",
    title: "مرحله گروهی + براکت حذفی",
    subtitle: "World Cup & Champions League Style",
    category: "tournament",
    icon: "🏆",
    tag: "فرمت محبوب رسمی",
    badgeBg: "bg-gold/15",
    badgeBorder: "border-gold/40",
    badgeText: "text-gold-dark",
    desc: "مسابقات با مرحله گروهی آغاز شده و تیم‌های برتر در یک براکت حذفی هیجان‌انگیز (سیستم ضربدری) تا رسیدن به فینال رقابت می‌کنند.",
    idealFor: "جام رمضان، تورنمنت‌های چندجانبه، کاپ‌های رسمی مدارس و باشگاه‌ها",
    features: [
      "عدم برخورد هم‌گروهی‌ها در دور اول حذفی",
      "پشتیبانی از سیدبندی سرگروه‌ها و قانون عدم برخورد",
      "امکان فعال‌سازی مسابقه رده‌بندی برای مقام سوم",
    ],
    recommended: true,
  },
  {
    key: "knockout",
    title: "براکت تک‌حذفی (جام حذفی)",
    subtitle: "Single Elimination Bracket",
    category: "tournament",
    icon: <BracketSvgIcon className="w-7 h-7 text-brick group-hover:text-gold transition-colors" />,
    tag: "سریع‌ترین و پرهیجان‌ترین",
    badgeBg: "bg-brick/10",
    badgeBorder: "border-brick/30",
    badgeText: "text-brick",
    desc: "بازنده در هر مسابقه مستقیماً حذف شده و برنده به مرحله بعد می‌رود. دارای سیستم هوشمند قرعه‌های استراحت (Bye).",
    idealFor: "مسابقات فشرده ۱ یا ۲ روزه، تورنمنت‌های حذفی سریع و آخر هفته‌ها",
    features: [
      "توزیع عادلانه استراحت (Bye) برای هر تعداد دلخواه تیم",
      "پشتیبانی کامل از وقت اضافه و ضربات پنالتی",
      "تعیین قهرمان در کوتاه‌ترین زمان ممکن",
    ],
  },
  {
    key: "double-knockout",
    title: "جدول دو حذفی (Double Elimination)",
    subtitle: "Winners & Losers Brackets",
    category: "tournament",
    icon: "🛡️",
    tag: "محبوب مدارس و المپیادها",
    badgeBg: "bg-emerald-500/15",
    badgeBorder: "border-emerald-500/30",
    badgeText: "text-emerald-700",
    desc: "هیچ تیمی با یک شکست حذف نمی‌شود! بازنده‌ها به جدول شانس مجدد (Losers Bracket) می‌روند و فینال بین قهرمان جدول برندگان و قهرمان شانس مجدد برگزار می‌شود.",
    idealFor: "مسابقات مدارس، المپیادهای دانش‌آموزی و دانشجویی، والیبال، پینگ‌پنگ، کشتی و ورزش‌های الکترونیک",
    features: [
      "جدول دوگانه برندگان و شانس مجدد (امکان بازگشت به فینال با یک باخت)",
      "تعیین طبیعی مقام‌های اول تا سوم بدون نیاز به بازی رده‌بندی",
      "امکان فعال‌سازی فینال مجدد (Bracket Reset) مطابق استاندارد جهانی",
    ],
  },
  {
    key: "league",
    title: "لیگ دوره‌ای (تک‌دور)",
    subtitle: "Single Round-Robin",
    category: "league",
    icon: "⚽",
    tag: "عادلانه‌ترین شیوه رقابت",
    badgeBg: "bg-pitch/10",
    badgeBorder: "border-pitch/30",
    badgeText: "text-pitch",
    desc: "هر تیم دقیقاً یک‌بار با تمام رقبای دیگر مسابقه می‌دهد. مبتنی بر الگوریتم استاندارد جهانی برگر (بدون هیچ بازی تکراری).",
    idealFor: "لیگ‌های محلی، دوره‌های درون‌باشگاهی و تورنمنت‌های دوره‌ای",
    features: [
      "تضمین ریاضی عدم وجود حتی یک مسابقه تکراری",
      "توازن عادلانه میزبانی و میهمانی برای تمامی تیم‌ها",
      "جدول امتیازات لحظه‌ای با تفاضل و گل‌های زده",
    ],
  },
  {
    key: "double-league",
    title: "لیگ رفت و برگشت",
    subtitle: "Home & Away Round-Robin",
    category: "league",
    icon: "🔄",
    tag: "استاندارد حرفه‌ای لیگ‌ها",
    badgeBg: "bg-sky-500/15",
    badgeBorder: "border-sky-500/30",
    badgeText: "text-sky-700",
    desc: "دو دور کامل مسابقه؛ یک بازی در زمین خودی و یک بازی در خانه حریف با تفکیک ساختاریافته نیم‌فصل اول و دوم.",
    idealFor: "لیگ‌های رسمی فصلی، مدارس فوتبال و مسابقات چندماهه",
    features: [
      "تضمین دو مسابقه برای هر دو تیم با جابه‌جایی دقیق میزبان",
      "سازمان‌دهی منظم بازی‌ها در قالب هفته‌های مسابقاتی",
      "ثبت زنده نتایج گل‌ها و جدول رده‌بندی لحظه‌ای",
    ],
  },
  {
    key: "groups",
    title: "فقط مرحله گروهی",
    subtitle: "Group Stage Standings",
    category: "league",
    icon: "👥",
    tag: "دسته‌بندی چندگانه",
    badgeBg: "bg-purple-500/15",
    badgeBorder: "border-purple-500/30",
    badgeText: "text-purple-700",
    desc: "تقسیم متوازن تیم‌ها به چند گروه مستقل و برگزاری مسابقات دوره‌ای مجزا در هر گروه با جداول رده‌بندی تفکیک‌شده.",
    idealFor: "مسابقات انتخابی، فستیوال‌های چندرده‌ای و جشنواره‌های ورزشی",
    features: [
      "سیدبندی سرگروه‌ها برای توزیع متوازن در گروه‌ها",
      "قانون عدم برخورد تیم‌های هم‌باشگاهی یا همشهری",
      "جدول رده‌بندی و امتیازات اختصاصی برای هر گروه",
    ],
  },
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

const COMMON_TEAM_PRESETS = [
  { count: 4, label: "۴ تیم", note: "نیمه‌نهایی / ۴ جانبه" },
  { count: 8, label: "۸ تیم", note: "استاندارد کلاسیک" },
  { count: 12, label: "۱۲ تیم", note: "۳ گروه ۴ تیمی" },
  { count: 16, label: "۱۶ تیم", note: "یک‌هشتم / ۴ گروه" },
  { count: 24, label: "۲۴ تیم", note: "جام ملت‌ها" },
  { count: 32, label: "۳۲ تیم", note: "جام جهانی فوتبال" },
  { count: 48, label: "۴۸ تیم", note: "تورنمنت‌های بزرگ" },
  { count: 64, label: "۶۴ تیم", note: "جام‌های کشوری" },
];

const btnPrimary =
  "inline-flex items-center justify-center rounded-md bg-pitch px-4 py-2.5 text-sm font-semibold text-chalk transition-colors hover:bg-pitch-light disabled:cursor-not-allowed disabled:opacity-40";
const btnGhost =
  "inline-flex items-center justify-center rounded-md border border-line px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-line/40";

function PlannerWizard() {
  const searchParams = useSearchParams();
  const formatQuery = searchParams.get("format") as CompetitionFormat | null;

  const [step, setStep] = useState(0);
  const [format, setFormat] = useState<CompetitionFormat | null>(null);
  const [formatCategory, setFormatCategory] = useState<"all" | "tournament" | "league">("all");
  const [teamCount, setTeamCount] = useState(8);
  const [teamCountInput, setTeamCountInput] = useState("8");
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [numGroups, setNumGroups] = useState(2);
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(2);
  const [seededTeams, setSeededTeams] = useState<string[]>([]);
  const [pot2Teams, setPot2Teams] = useState<string[]>([]);
  const [pot3Teams, setPot3Teams] = useState<string[]>([]);
  const [pot4Teams, setPot4Teams] = useState<string[]>([]);
  const [activePotTab, setActivePotTab] = useState<1 | 2 | 3 | 4>(1);
  const [avoidPairs, setAvoidPairs] = useState<[string, string][]>([]);
  const [hasThirdPlace, setHasThirdPlace] = useState(false);
  const [hasResetFinal, setHasResetFinal] = useState(false);
  const [independentSecondLeg, setIndependentSecondLeg] = useState(true);
  const [advanceBestThirds, setAdvanceBestThirds] = useState(true);
  const [metadata, setMetadata] = useState<TournamentMetadata>({
    title: "",
    venue: "",
  });
  const [pointsRule, setPointsRule] = useState<PointsRule>({
    win: 3,
    draw: 1,
    loss: 0,
    name: "استاندارد فوتبال (۳-۱-۰)",
  });
  const [matchDetails, setMatchDetails] = useState<Record<string, MatchScheduleDetail>>({});
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [scores, setScores] = useState<Record<string, MatchScore>>({});
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Cloud Tournament Storage & Auth Integration
  const { user, openAuthModal } = useAuth();
  const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);
  const [savedModalOpen, setSavedModalOpen] = useState(false);
  const [savedModalMode, setSavedModalMode] = useState<"save" | "list">("list");

  // Bulk input & file input refs
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [excelHasHeader, setExcelHasHeader] = useState(true);
  const [rawExcelRows, setRawExcelRows] = useState<string[]>([]);
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);

  // Avoidance helper selector state
  const [avoidTeamA, setAvoidTeamA] = useState("");
  const [avoidTeamB, setAvoidTeamB] = useState("");

  // Restore from LocalStorage on mount & check for ?format= query param
  useEffect(() => {
    const validFormats: CompetitionFormat[] = [
      "league",
      "double-league",
      "groups",
      "groups-knockout",
      "knockout",
      "double-knockout",
    ];

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.step === "number") setStep(parsed.step);
        if (parsed.format) setFormat(parsed.format);
        if (typeof parsed.teamCount === "number") {
          setTeamCount(parsed.teamCount);
          setTeamCountInput(String(parsed.teamCount));
        }
        if (Array.isArray(parsed.teamNames)) setTeamNames(parsed.teamNames);
        if (typeof parsed.numGroups === "number") setNumGroups(parsed.numGroups);
        if (typeof parsed.qualifiersPerGroup === "number")
          setQualifiersPerGroup(parsed.qualifiersPerGroup);
        if (Array.isArray(parsed.seededTeams)) setSeededTeams(parsed.seededTeams);
        if (Array.isArray(parsed.pot2Teams)) setPot2Teams(parsed.pot2Teams);
        if (Array.isArray(parsed.pot3Teams)) setPot3Teams(parsed.pot3Teams);
        if (Array.isArray(parsed.pot4Teams)) setPot4Teams(parsed.pot4Teams);
        if (Array.isArray(parsed.avoidPairs)) setAvoidPairs(parsed.avoidPairs);
        if (typeof parsed.hasThirdPlace === "boolean")
          setHasThirdPlace(parsed.hasThirdPlace);
        if (typeof parsed.hasResetFinal === "boolean")
          setHasResetFinal(parsed.hasResetFinal);
        if (typeof parsed.independentSecondLeg === "boolean")
          setIndependentSecondLeg(parsed.independentSecondLeg);
        if (typeof parsed.advanceBestThirds === "boolean")
          setAdvanceBestThirds(parsed.advanceBestThirds);
        if (parsed.pointsRule) setPointsRule(parsed.pointsRule);
        if (parsed.metadata) setMetadata(parsed.metadata);
        if (parsed.result) setResult(parsed.result);
        if (parsed.scores) setScores(parsed.scores);
        if (parsed.matchDetails) setMatchDetails(parsed.matchDetails);
        if (typeof parsed.currentSavedId === "string")
          setCurrentSavedId(parsed.currentSavedId);
      }

      // If user came with ?open=saved, open the saved tournaments modal
      if (searchParams.get("open") === "saved") {
        setSavedModalMode("list");
        setSavedModalOpen(true);
      }

      // If user selected a format on the homepage (e.g. /planner?format=knockout), jump directly to that format!
      if (formatQuery && validFormats.includes(formatQuery)) {
        setFormat(formatQuery);
        setStep(1);
        setResult(null);
        setScores({});
        setError(null);
        setNumGroups(calculateDefaultNumGroups(teamCount));
        const matchedTitle = FORMAT_OPTIONS.find((f) => f.key === formatQuery)?.title;
        setInfoMessage(`🎯 فرمت «${matchedTitle}» انتخاب شد. لطفاً تعداد تیم‌ها را مشخص کنید.`);
        setTimeout(() => setInfoMessage(null), 4500);
      }
    } catch {
      // Ignore parse error
    } finally {
      setIsLoaded(true);
    }
  }, [formatQuery]);

  // Listen for open saved tournaments query or custom event
  const openQuery = searchParams.get("open");
  useEffect(() => {
    if (openQuery === "saved") {
      setSavedModalMode("list");
      setSavedModalOpen(true);
    }
  }, [openQuery]);

  useEffect(() => {
    function handleOpenEvent() {
      setSavedModalMode("list");
      setSavedModalOpen(true);
    }
    window.addEventListener("open-saved-tournaments", handleOpenEvent);
    return () => window.removeEventListener("open-saved-tournaments", handleOpenEvent);
  }, []);

  // Save to LocalStorage whenever state changes
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          currentSavedId,
          step,
          format,
          teamCount,
          teamNames,
          numGroups,
          qualifiersPerGroup,
          seededTeams,
          pot2Teams,
          pot3Teams,
          pot4Teams,
          avoidPairs,
          hasThirdPlace,
          hasResetFinal,
          independentSecondLeg,
          advanceBestThirds,
          pointsRule,
          metadata,
          result,
          scores,
          matchDetails,
        })
      );
    } catch {
      // Ignore storage errors
    }
  }, [
    isLoaded,
    currentSavedId,
    step,
    format,
    teamCount,
    teamNames,
    numGroups,
    qualifiersPerGroup,
    seededTeams,
    avoidPairs,
    hasThirdPlace,
    independentSecondLeg,
    advanceBestThirds,
    pointsRule,
    metadata,
    result,
    scores,
    matchDetails,
  ]);

  const needsGroupRules = format === "groups" || format === "groups-knockout";
  const needsSeedRules = format === "knockout" || format === "double-knockout" || needsGroupRules;
  const supportsThirdPlace = format === "knockout" || format === "groups-knockout";

  // Knocout structure math for groups-knockout
  const baseQualifiers = numGroups * qualifiersPerGroup;
  const targetBracketSize = nextPowerOfTwo(Math.max(2, baseQualifiers));
  const missingForPowerOfTwo = targetBracketSize - baseQualifiers;
  const isPowerOfTwo = missingForPowerOfTwo === 0;
  const canUseBestThirds =
    qualifiersPerGroup === 2 &&
    missingForPowerOfTwo > 0 &&
    missingForPowerOfTwo <= numGroups;

  const namesReady =
    teamNames.length === teamCount && teamNames.every((t) => t.trim().length > 0);

  function handleTeamCountChange(count: number) {
    const validCount = Math.min(128, Math.max(2, count));
    setTeamCount(validCount);
    setTeamCountInput(String(validCount));
    setNumGroups(calculateDefaultNumGroups(validCount));
  }

  function handleTypingTeamCount(val: string) {
    // Keep user's raw keystrokes (digits only), allowing empty string while deleting
    const digits = val.replace(/[^0-9]/g, "");
    setTeamCountInput(digits);
    if (digits.length > 0) {
      const parsed = parseInt(digits, 10);
      if (parsed >= 2 && parsed <= 128) {
        setTeamCount(parsed);
        setNumGroups(calculateDefaultNumGroups(parsed));
      }
    }
  }

  function handleBlurTeamCount() {
    let parsed = parseInt(teamCountInput, 10);
    if (isNaN(parsed) || parsed < 2) parsed = 2;
    if (parsed > 128) parsed = 128;
    setTeamCount(parsed);
    setTeamCountInput(String(parsed));
    setNumGroups(calculateDefaultNumGroups(parsed));
  }

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

  function getTeamPot(team: string): 1 | 2 | 3 | 4 | null {
    if (seededTeams.includes(team)) return 1;
    if (pot2Teams.includes(team)) return 2;
    if (pot3Teams.includes(team)) return 3;
    if (pot4Teams.includes(team)) return 4;
    return null;
  }

  function toggleTeamInPot(team: string, potNum: 1 | 2 | 3 | 4) {
    const currentList =
      potNum === 1
        ? seededTeams
        : potNum === 2
        ? pot2Teams
        : potNum === 3
        ? pot3Teams
        : pot4Teams;

    const setTarget =
      potNum === 1
        ? setSeededTeams
        : potNum === 2
        ? setPot2Teams
        : potNum === 3
        ? setPot3Teams
        : setPot4Teams;

    // Deselect if already in this pot
    if (currentList.includes(team)) {
      setTarget((prev) => prev.filter((t) => t !== team));
      return;
    }

    // Limit check: at most numGroups per pot
    if (currentList.length >= numGroups) {
      setError(`حداکثر ${numGroups} تیم (به تعداد گروه‌ها) برای سید ${potNum} قابل انتخاب است.`);
      setTimeout(() => setError(null), 3500);
      return;
    }

    // Remove from other pots
    setSeededTeams((prev) => prev.filter((t) => t !== team));
    setPot2Teams((prev) => prev.filter((t) => t !== team));
    setPot3Teams((prev) => prev.filter((t) => t !== team));
    setPot4Teams((prev) => prev.filter((t) => t !== team));

    // Add to target pot
    setTarget((prev) => [...prev, team]);
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
    if (result && Object.keys(scores).length > 0) {
      const confirmed = window.confirm(
        "⚠️ توجه: شما قبلاً نتایجی برای این مسابقات ثبت کرده‌اید.\nبا تولید مجدد برنامه، تمامی گل‌ها و نتایج ثبت‌شده پاک خواهند شد.\n\nآیا از ادامه مطمئن هستید؟"
      );
      if (!confirmed) return;
      setScores({});
    }

    setError(null);
    try {
      if (!format) throw new ScheduleValidationError("نوع مسابقه انتخاب نشده است.");
      let r: ScheduleResult;

      const trimmedMetadata: TournamentMetadata = {
        title: metadata.title?.trim() || undefined,
        venue: metadata.venue?.trim() || undefined,
        pointsRule,
      };

      if (format === "groups" || format === "groups-knockout") {
        r = generateSchedule({
          format,
          teams: teamNames,
          numGroups,
          seededTeams,
          pot2Teams,
          pot3Teams,
          pot4Teams,
          qualifiersPerGroup,
          advanceBestThirds,
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
      } else if (format === "double-knockout") {
        r = generateSchedule({
          format: "double-knockout",
          teams: teamNames,
          seededTeams,
          hasResetFinal,
          metadata: trimmedMetadata,
        });
      } else if (format === "double-league") {
        r = generateSchedule({
          format: "double-league",
          teams: teamNames,
          independentSecondLeg,
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
      setTeamCountInput("8");
      setTeamNames([]);
      setNumGroups(calculateDefaultNumGroups(8));
      setQualifiersPerGroup(2);
      setSeededTeams([]);
      setPot2Teams([]);
      setPot3Teams([]);
      setPot4Teams([]);
      setActivePotTab(1);
      setAvoidPairs([]);
      setHasThirdPlace(false);
      setHasResetFinal(false);
      setIndependentSecondLeg(true);
      setAdvanceBestThirds(true);
      setMetadata({ title: "", venue: "" });
      setPointsRule({
        win: 3,
        draw: 1,
        loss: 0,
        name: "استاندارد فوتبال (۳-۱-۰)",
      });
      setMatchDetails({});
      setResult(null);
      setScores({});
      setCurrentSavedId(null);
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

  function handleMatchDetailChange(matchId: string, detail: MatchScheduleDetail) {
    setMatchDetails((prev) => {
      if (!detail.date && !detail.time && !detail.pitch) {
        const next = { ...prev };
        delete next[matchId];
        return next;
      }
      return { ...prev, [matchId]: detail };
    });
  }

  function handleOpenSaveCloud() {
    if (!user) {
      openAuthModal("login");
      return;
    }
    setSavedModalMode("save");
    setSavedModalOpen(true);
  }

  function handleOpenSavedList() {
    if (!user) {
      openAuthModal("login");
      return;
    }
    setSavedModalMode("list");
    setSavedModalOpen(true);
  }

  function handleLoadCloudTournament(t: SavedTournamentItem) {
    try {
      const s = t.state;
      if (!s) return;

      if (typeof s.step === "number") setStep(s.step);
      else setStep(4);

      if (s.format) setFormat(s.format);
      if (typeof s.teamCount === "number") {
        setTeamCount(s.teamCount);
        setTeamCountInput(String(s.teamCount));
      }
      if (Array.isArray(s.teamNames)) setTeamNames(s.teamNames);
      if (typeof s.numGroups === "number") setNumGroups(s.numGroups);
      if (typeof s.qualifiersPerGroup === "number")
        setQualifiersPerGroup(s.qualifiersPerGroup);
      if (Array.isArray(s.seededTeams)) setSeededTeams(s.seededTeams);
      if (Array.isArray(s.pot2Teams)) setPot2Teams(s.pot2Teams);
      if (Array.isArray(s.pot3Teams)) setPot3Teams(s.pot3Teams);
      if (Array.isArray(s.pot4Teams)) setPot4Teams(s.pot4Teams);
      if (Array.isArray(s.avoidPairs)) setAvoidPairs(s.avoidPairs);
      if (typeof s.hasThirdPlace === "boolean")
        setHasThirdPlace(s.hasThirdPlace);
      if (typeof s.hasResetFinal === "boolean")
        setHasResetFinal(s.hasResetFinal);
      if (typeof s.independentSecondLeg === "boolean")
        setIndependentSecondLeg(s.independentSecondLeg);
      if (typeof s.advanceBestThirds === "boolean")
        setAdvanceBestThirds(s.advanceBestThirds);
      if (s.pointsRule) setPointsRule(s.pointsRule);
      if (s.metadata) setMetadata(s.metadata);
      else setMetadata({ title: t.title, venue: "" });
      if (s.result) setResult(s.result);
      if (s.scores) setScores(s.scores);
      if (s.matchDetails) setMatchDetails(s.matchDetails);

      setCurrentSavedId(t.id);
      setInfoMessage(`☁️ مسابقه «${t.title}» با موفقیت از فضای ابری بارگذاری شد.`);
      setTimeout(() => setInfoMessage(null), 4000);
    } catch (err) {
      console.error("Error loading tournament:", err);
      alert("خطا در بارگذاری مسابقه از فضای ابری.");
    }
  }

  function handleCloudSaveSuccess(t: SavedTournamentItem) {
    setCurrentSavedId(t.id);
    if (!metadata.title) {
      setMetadata((prev) => ({ ...prev, title: t.title }));
    }
    setInfoMessage(`☁️ مسابقه «${t.title}» با موفقیت در فضای ابری ذخیره شد.`);
    setTimeout(() => setInfoMessage(null), 4000);
  }

  function handleExportJson() {
    if (!result) return;
    const exportData = {
      version: 1,
      exportDate: new Date().toISOString(),
      step,
      format,
      teamCount,
      teamNames,
      numGroups,
      qualifiersPerGroup,
      seededTeams,
      pot2Teams,
      pot3Teams,
      pot4Teams,
      avoidPairs,
      hasThirdPlace,
      hasResetFinal,
      independentSecondLeg,
      advanceBestThirds,
      pointsRule,
      metadata,
      result,
      scores,
      matchDetails,
    };
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeTitle = (metadata.title || format || "tournament")
      .trim()
      .replace(/[\s/\\?%*:|"<>]+/g, "-");
    link.href = url;
    link.download = `nexsport-${safeTitle}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setInfoMessage("💾 فایل پشتیبان مسابقه (.json) با موفقیت دانلود شد.");
    setTimeout(() => setInfoMessage(null), 3500);
  }

  function handleImportJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (!parsed.format || !Array.isArray(parsed.teamNames) || !parsed.result) {
          throw new Error("فایل انتخاب شده ساختار معتبر مسابقات NexSport را ندارد.");
        }

        if (parsed.format) setFormat(parsed.format);
        if (typeof parsed.teamCount === "number") {
          setTeamCount(parsed.teamCount);
          setTeamCountInput(String(parsed.teamCount));
        }
        if (Array.isArray(parsed.teamNames)) setTeamNames(parsed.teamNames);
        if (typeof parsed.numGroups === "number") setNumGroups(parsed.numGroups);
        if (typeof parsed.qualifiersPerGroup === "number")
          setQualifiersPerGroup(parsed.qualifiersPerGroup);
        if (Array.isArray(parsed.seededTeams)) setSeededTeams(parsed.seededTeams);
        if (Array.isArray(parsed.pot2Teams)) setPot2Teams(parsed.pot2Teams);
        if (Array.isArray(parsed.pot3Teams)) setPot3Teams(parsed.pot3Teams);
        if (Array.isArray(parsed.pot4Teams)) setPot4Teams(parsed.pot4Teams);
        if (Array.isArray(parsed.avoidPairs)) setAvoidPairs(parsed.avoidPairs);
        if (typeof parsed.hasThirdPlace === "boolean")
          setHasThirdPlace(parsed.hasThirdPlace);
        if (typeof parsed.hasResetFinal === "boolean")
          setHasResetFinal(parsed.hasResetFinal);
        if (typeof parsed.independentSecondLeg === "boolean")
          setIndependentSecondLeg(parsed.independentSecondLeg);
        if (typeof parsed.advanceBestThirds === "boolean")
          setAdvanceBestThirds(parsed.advanceBestThirds);
        if (parsed.pointsRule) setPointsRule(parsed.pointsRule);
        if (parsed.metadata) setMetadata(parsed.metadata);
        if (parsed.result) setResult(parsed.result);
        if (parsed.scores) setScores(parsed.scores);
        if (parsed.matchDetails) setMatchDetails(parsed.matchDetails);

        setStep(4);
        setInfoMessage("📂 مسابقه با موفقیت از فایل بازیابی شد!");
        setTimeout(() => setInfoMessage(null), 4000);

        if (jsonFileInputRef.current) {
          jsonFileInputRef.current.value = "";
        }
      } catch (err: any) {
        alert(err?.message || "خطا در خواندن فایل مسابقه. لطفاً از فایل معتبر JSON استفاده کنید.");
      }
    };
    reader.readAsText(file);
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
      if (
        home === null &&
        away === null &&
        (homePenalty === null || homePenalty === undefined) &&
        (awayPenalty === null || awayPenalty === undefined) &&
        winner === null
      ) {
        delete next[matchId];
        return next;
      }
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
      const text = formatScheduleAsText(result, scores, matchDetails);
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    } catch {
      alert("امکان کپی خودکار فراهم نشد. لطفاً دسترسی کلیپ‌بورد را بررسی کنید.");
    }
  }

  function handleDownloadCsv() {
    if (!result) return;
    const csv = exportScheduleToCsv(result, scores, matchDetails);
    const safeTitle = (metadata.title || format || "schedule")
      .trim()
      .replace(/[\s/\\?%*:|"<>]+/g, "-");
    downloadCsvFile(csv, `nexsport-${safeTitle}.csv`);
  }

  const tournamentCount = FORMAT_OPTIONS.filter((f) => f.category === "tournament").length;
  const leagueCount = FORMAT_OPTIONS.filter((f) => f.category === "league").length;

  const displayedFormats =
    formatCategory === "all"
      ? FORMAT_OPTIONS
      : FORMAT_OPTIONS.filter((f) => f.category === formatCategory);

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
      {/* Top Bar */}
      <div className="no-print mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-line/70 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink hover:border-pitch hover:text-pitch transition-colors shadow-2xs"
          >
            <span>←</span>
            <span>صفحه اصلی</span>
          </Link>
          <div className="h-4 w-px bg-line/80" />
          <div className="flex items-center gap-2">
            <NexSportIcon size={28} className="shrink-0 drop-shadow-2xs" />
            <span className="text-sm font-black text-ink">برنامه‌ریز مسابقات NexSport</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleOpenSavedList}
            className="inline-flex items-center gap-1.5 rounded-lg border border-pitch/20 bg-white px-2.5 py-1.5 text-xs font-bold text-pitch shadow-2xs hover:bg-pitch hover:text-white transition-all cursor-pointer"
            title="مشاهده و بارگذاری مسابقات ذخیره شده من در فضای ابری"
          >
            <span>📂</span>
            <span className="hidden sm:inline">مسابقات من</span>
          </button>

          {(step > 0 || result) && (
            <button
              type="button"
              onClick={handleOpenSaveCloud}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1.5 text-xs font-bold text-gold-dark hover:bg-gold hover:text-white transition-all cursor-pointer"
              title="ذخیره مسابقه جاری در حساب ابری"
            >
              <span>☁️</span>
              <span className="hidden sm:inline">ذخیره ابری</span>
            </button>
          )}

          <AuthHeaderNav />

          {(step > 0 || result) && (
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brick/30 bg-brick/5 px-3 py-1.5 text-xs font-bold text-brick hover:bg-brick hover:text-white transition-colors"
            >
              <span>🔄</span>
              <span className="hidden sm:inline">شروع مسابقه جدید</span>
            </button>
          )}
        </div>
      </div>

      <div className="no-print mb-8">
        <Stepper labels={STEP_LABELS} current={step} />
      </div>

      {/* Info notification */}
      {infoMessage && (
        <div className="no-print mb-6 rounded-xl border border-pitch/30 bg-pitch/10 px-4 py-3 text-xs sm:text-sm font-semibold text-pitch animate-fade-in flex items-center gap-2 shadow-xs">
          <span>ℹ️</span>
          <span>{infoMessage}</span>
        </div>
      )}

      {/* STEP 0: FORMAT SELECTION */}
      {step === 0 && (
        <section className="animate-fade-in space-y-8">
          {/* Section Hero */}
          <div className="text-center max-w-2xl mx-auto space-y-2.5 pt-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-pitch/10 px-3.5 py-1 text-xs font-bold text-pitch border border-pitch/20">
              <span className="h-2 w-2 rounded-full bg-pitch animate-pulse" />
              <span>گام اول از ۵: تعیین شیوه رقابت</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-ink tracking-tight">
              فرمت برگزاری مسابقات خود را انتخاب کنید
            </h1>
            <p className="text-xs sm:text-sm text-ink/70 leading-relaxed">
              هر فرمت از دقیق‌ترین الگوریتم‌های استاندارد بین‌المللی پیروی می‌کند و جدول بازی‌ها بدون هیچ خطایی ایجاد خواهد شد. روی گزینه مورد نظر کلیک کنید:
            </p>

            {/* Filter Tabs */}
            <div className="pt-3 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setFormatCategory("all")}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  formatCategory === "all"
                    ? "bg-pitch text-chalk shadow-sm"
                    : "bg-white border border-line text-ink/70 hover:border-pitch/40"
                }`}
              >
                همه فرمت‌ها ({FORMAT_OPTIONS.length})
              </button>
              <button
                type="button"
                onClick={() => setFormatCategory("tournament")}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  formatCategory === "tournament"
                    ? "bg-pitch text-chalk shadow-sm"
                    : "bg-white border border-line text-ink/70 hover:border-pitch/40"
                }`}
              >
                🏆 جام‌ها و مسابقات حذفی ({tournamentCount})
              </button>
              <button
                type="button"
                onClick={() => setFormatCategory("league")}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  formatCategory === "league"
                    ? "bg-pitch text-chalk shadow-sm"
                    : "bg-white border border-line text-ink/70 hover:border-pitch/40"
                }`}
              >
                ⚽ لیگ و دوره‌ای ({leagueCount})
              </button>
            </div>

            {/* Restore from JSON backup button */}
            <div className="pt-3 flex justify-center">
              <button
                type="button"
                onClick={() => jsonFileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full border border-pitch/30 bg-white/90 px-4 py-2 text-xs font-bold text-pitch shadow-2xs hover:bg-white hover:border-pitch hover:shadow-xs transition-all"
                title="بارگذاری مسابقه ذخیره شده (.json) از سیستم یا تلفن همراه"
              >
                <span>📂</span>
                <span>بارگذاری مسابقه قبلی (فایل JSON)</span>
              </button>
              <input
                ref={jsonFileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleImportJson}
              />
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {displayedFormats.map((opt) => {
              const isSelected = format === opt.key;
              return (
                <div
                  key={opt.key}
                  onClick={() => {
                    setFormat(opt.key);
                    setStep(1);
                  }}
                  className={
                    "group relative flex flex-col justify-between rounded-2xl border bg-white p-6 transition-all duration-200 cursor-pointer text-right hover:-translate-y-1 hover:shadow-xl " +
                    (isSelected
                      ? "border-pitch ring-2 ring-pitch/20 bg-pitch/5 shadow-md"
                      : opt.recommended
                      ? "border-pitch/40 ring-1 ring-pitch/20 shadow-sm hover:border-pitch"
                      : "border-line/80 shadow-xs hover:border-pitch/50")
                  }
                >
                  {opt.recommended && (
                    <div className="absolute -top-3 right-6 rounded-full bg-gold px-3 py-0.5 text-[11px] font-black text-ink shadow-sm flex items-center gap-1">
                      <span>⭐</span>
                      <span>فرمت پیشنهادی تورنمنت‌ها</span>
                    </div>
                  )}

                  <div>
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-3 mb-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pitch/10 text-2xl group-hover:bg-pitch group-hover:text-gold transition-colors shrink-0 shadow-xs">
                          {opt.icon}
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-pitch group-hover:text-pitch-light transition-colors">
                            {opt.title}
                          </h3>
                          <p className="text-[11px] font-mono text-ink/45 mt-0.5">
                            {opt.subtitle}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${opt.badgeBg} ${opt.badgeBorder} ${opt.badgeText}`}
                      >
                        {opt.tag}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-ink/75 leading-6 mb-4">
                      {opt.desc}
                    </p>

                    {/* Ideal For Box */}
                    <div className="mb-4 rounded-xl bg-chalk/80 border border-line/60 p-2.5 text-[11px] text-ink/70 flex items-start gap-2">
                      <span className="text-pitch font-bold shrink-0 mt-0.5">📍</span>
                      <div className="leading-5">
                        <strong className="text-pitch font-bold">مناسب برای:</strong> {opt.idealFor}
                      </div>
                    </div>

                    {/* Features List */}
                    <ul className="space-y-2 mb-6 border-t border-line/50 pt-3">
                      {opt.features.map((feat, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-xs text-ink/80">
                          <span className="text-pitch font-bold text-xs shrink-0">✓</span>
                          <span className="text-[11px] sm:text-xs">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action Button */}
                  <div className="pt-2 border-t border-line/50">
                    <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-pitch bg-pitch/5 py-2.5 text-xs font-bold text-pitch group-hover:bg-pitch group-hover:text-chalk transition-all shadow-xs">
                      <span>انتخاب این فرمت و ادامه</span>
                      <span className="text-gold group-hover:translate-x-1 transition-transform">←</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Decision Guide Banner */}
          <div className="rounded-2xl border border-pitch/20 bg-gradient-to-r from-pitch/5 via-pitch/10 to-gold/10 p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1 max-w-2xl">
                <h4 className="font-bold text-sm text-pitch flex items-center gap-2">
                  <span>💡</span>
                  <span>کدام فرمت برای مسابقه شما مناسب‌تر است؟</span>
                </h4>
                <p className="text-xs text-ink/75 leading-relaxed">
                  اگر زمان کافی برای رقابت تمام تیم‌ها با یکدیگر دارید، <strong>لیگ دوره‌ای</strong> عادلانه‌ترین روش است. اما اگر زمان شما محدود است (مثلاً تورنمنت یک‌روزه یا آخر هفته)، <strong>براکت تک‌حذفی</strong> یا <strong>گروهی + حذفی</strong> بیشترین هیجان را به مسابقات شما می‌دهند.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-pitch shrink-0 bg-white/70 px-3 py-1.5 rounded-xl border border-line/60">
                <span>⚡ ۱۰۰٪ رایگان و آنی</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* STEP 1: TEAM COUNT */}
      {step === 1 && (
        <section className="animate-fade-in space-y-8">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-black text-ink">تعداد تیم‌های مسابقه</h1>
              {format && (
                <span className="rounded-full bg-pitch/10 px-3.5 py-1 text-xs font-bold text-pitch border border-pitch/20">
                  فرمت انتخابی: {FORMAT_OPTIONS.find((f) => f.key === format)?.title}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-ink/65 leading-relaxed">
              می‌توانید عدد دلخواه خود را مستقیماً در کادر تایپ کنید، از دکمه‌های بزرگ + و − استفاده کنید، یا با یک کلیک از دکمه‌های آماده زیر انتخاب فرمایید:
            </p>
          </div>

          {/* Stepper Controls & Direct Input */}
          <div className="rounded-2xl border border-line/80 bg-white p-5 sm:p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div>
                <span className="text-xs sm:text-sm font-bold text-ink/80 block mb-1">
                  تعداد تیم‌های حاضر در مسابقات:
                </span>
                <span className="text-xs text-ink/50">
                  حداقل ۲ و حداکثر ۱۲۸ تیم مجاز است (می‌توانید مستقیماً عدد بنویسید).
                </span>
              </div>

              {/* Big Touch-Friendly Input & Controls */}
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => handleTeamCountChange(teamCount - 1)}
                  disabled={teamCount <= 2}
                  className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border-2 border-line bg-chalk/50 text-2xl font-black text-ink hover:border-pitch hover:bg-pitch/5 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xs"
                  title="کاهش یک تیم"
                  aria-label="کاهش یک تیم"
                >
                  −
                </button>

                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={teamCountInput}
                    onChange={(e) => handleTypingTeamCount(e.target.value)}
                    onBlur={handleBlurTeamCount}
                    className="h-12 w-28 sm:h-14 sm:w-36 rounded-2xl border-2 border-pitch bg-white text-center text-2xl sm:text-3xl font-black text-pitch focus:outline-none focus:ring-4 focus:ring-pitch/15 shadow-inner transition-all"
                    placeholder="مثلاً ۳۲"
                  />
                  <span className="absolute -bottom-5 left-0 right-0 text-center text-[10px] text-ink/40 font-semibold select-none">
                    تایپ مستقیم عددی
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleTeamCountChange(teamCount + 1)}
                  disabled={teamCount >= 128}
                  className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border-2 border-line bg-chalk/50 text-2xl font-black text-ink hover:border-pitch hover:bg-pitch/5 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xs"
                  title="افزایش یک تیم"
                  aria-label="افزایش یک تیم"
                >
                  +
                </button>

                <span className="text-base sm:text-lg font-bold text-ink/70 mr-1">تیم</span>
              </div>
            </div>

            {/* Quick Selection Presets */}
            <div className="border-t border-line/60 pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink/80 flex items-center gap-1.5">
                  <span>⚡</span>
                  <span>انتخاب سریع و فوری تعداد تیم‌های رایج (بدون نیاز به کلیک‌های متوالی):</span>
                </span>
                <span className="text-[11px] text-ink/40 hidden sm:inline">
                  با یک ضربه فوری اعمال می‌شود
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {COMMON_TEAM_PRESETS.map((p) => {
                  const isCurrent = teamCount === p.count;
                  return (
                    <button
                      key={p.count}
                      type="button"
                      onClick={() => handleTeamCountChange(p.count)}
                      className={`flex flex-col items-start p-3 rounded-xl border text-right transition-all cursor-pointer ${
                        isCurrent
                          ? "border-pitch bg-pitch text-chalk shadow-md scale-[1.02] ring-2 ring-gold/40"
                          : "border-line/80 bg-chalk/30 hover:border-pitch/50 hover:bg-white text-ink"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-sm font-black">{p.label}</span>
                        {isCurrent && (
                          <span className="text-xs font-bold text-gold">✓ انتخاب شد</span>
                        )}
                      </div>
                      <span className={`text-[10px] mt-0.5 ${isCurrent ? "text-chalk/80" : "text-ink/50"}`}>
                        {p.note}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Contextual Tournament Overview Box */}
          <div className="rounded-2xl border border-pitch/20 bg-pitch/5 p-4 sm:p-5 text-xs text-ink/80 space-y-1.5 shadow-2xs">
            <div className="font-bold text-pitch flex items-center gap-2">
              <span>📋</span>
              <span className="text-sm">ساختار مسابقات شما با {teamCount} تیم:</span>
            </div>
            {format === "groups-knockout" && (
              <p className="leading-6 pr-6">
                با <strong>{teamCount} تیم</strong>، مسابقات به صورت استاندارد در <strong>{numGroups} گروه</strong> ({Math.floor(teamCount / Math.max(1, numGroups))} تا {Math.ceil(teamCount / Math.max(1, numGroups))} تیم در هر گروه) آغاز می‌شود و سپس تیم‌های اول و دوم وارد جدول حذفی ضربدری خواهند شد.
              </p>
            )}
            {format === "knockout" && (
              <p className="leading-6 pr-6">
                {Math.log2(teamCount) % 1 === 0 ? (
                  <>تعداد {teamCount} تیم دقیقاً توان ۲ است؛ بنابراین مسابقات بدون استراحت و در <strong>{Math.log2(teamCount)} مرحله کامل</strong> برگزار خواهد شد.</>
                ) : (
                  <>
                    با توجه به اینکه {teamCount} توان ۲ نیست، جدول براکت {Math.pow(2, Math.ceil(Math.log2(teamCount)))} تیمی تشکیل شده و به <strong>{Math.pow(2, Math.ceil(Math.log2(teamCount))) - teamCount} تیم برتر</strong> استراحت مستقیم دور اول (Bye) داده می‌شود.
                  </>
                )}
              </p>
            )}
            {format === "double-knockout" && (
              <p className="leading-6 pr-6">
                در فرمت دو حذفی با <strong>{teamCount} تیم</strong>، مسابقات در دو جدول موازی «برندگان» و «شانس مجدد / بازندگان» برگزار می‌شود. هیچ تیمی با اولین شکست حذف نمی‌شود و با دو باخت از گردونه رقابت‌ها کنار می‌رود. قهرمانان دو جدول در فینال بزرگ به مصاف یکدیگر خواهند رفت.
              </p>
            )}
            {format === "league" && (
              <p className="leading-6 pr-6">
                هر تیم با تمام {teamCount - 1} رقیب خود یک مسابقه می‌دهد؛ مجموعاً <strong>{teamCount % 2 === 0 ? teamCount - 1 : teamCount} هفته مسابقاتی</strong> و <strong>{(teamCount * (teamCount - 1)) / 2} بازی عادلانه</strong> بدون مسابقه تکراری برگزار می‌شود.
              </p>
            )}
            {format === "double-league" && (
              <p className="leading-6 pr-6">
                هر دو تیم یک‌بار در زمین خود و یک‌بار در زمین حریف بازی می‌کنند؛ مجموعاً <strong>{2 * (teamCount % 2 === 0 ? teamCount - 1 : teamCount)} هفته مسابقاتی</strong> و <strong>{teamCount * (teamCount - 1)} بازی رفت‌وبرگشت</strong> برگزار خواهد شد.
              </p>
            )}
            {format === "groups" && (
              <p className="leading-6 pr-6">
                تیم‌ها به <strong>{numGroups} گروه</strong> متوازن ({Math.floor(teamCount / Math.max(1, numGroups))} تا {Math.ceil(teamCount / Math.max(1, numGroups))} تیم در هر گروه) تقسیم شده و درون هر گروه جدول امتیازات اختصاصی محاسبه می‌شود.
              </p>
            )}
          </div>

          <div className="mt-8 flex gap-3">
            <button className={btnGhost} onClick={() => setStep(0)}>
              مرحله قبل (تغییر فرمت)
            </button>
            <button
              className={btnPrimary}
              onClick={() => {
                ensureNames();
                setStep(2);
              }}
            >
              مرحله بعد (اسامی تیم‌ها)
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

          {/* Points System Selector */}
          {(format === "league" ||
            format === "double-league" ||
            format === "groups" ||
            format === "groups-knockout") && (
            <div className="rounded-xl border border-line bg-chalk/40 p-5 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-pitch flex items-center gap-1.5">
                  <span>📊</span>
                  <span>سیستم امتیازدهی جدول رده‌بندی</span>
                </h3>
                <p className="text-xs text-ink/60 mt-0.5">
                  نحوه محاسبه امتیازات را متناسب با رشته ورزشی مسابقات خود انتخاب فرمایید:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                {[
                  {
                    id: "football",
                    title: "⚽ فوتبال و فوتسال (FIFA)",
                    desc: "برد: ۳ امتیاز | مساوی: ۱ | باخت: ۰",
                    rule: { sport: "football" as const, win: 3, draw: 1, loss: 0, name: "فوتبال و فوتسال (۳-۱-۰)" },
                  },
                  {
                    id: "volleyball",
                    title: "🏐 والیبال (قوانین رسمی FIVB)",
                    desc: "۳-۰/۳-۱ (۳ پوئن) | ۳-۲ (۲ برنده، ۱ بازنده) | اولویت اول: بردها",
                    rule: {
                      sport: "volleyball" as const,
                      win: 3,
                      draw: 0,
                      loss: 0,
                      rankByWinsFirst: true,
                      name: "والیبال FIVB (محاسبه خودکار از ست‌ها)",
                    },
                  },
                  {
                    id: "basketball",
                    title: "🏀 بسکتبال (FIBA)",
                    desc: "برد: ۲ امتیاز | باخت: ۱ امتیاز | تساوی ندارد",
                    rule: { sport: "basketball" as const, win: 2, draw: 0, loss: 1, name: "بسکتبال FIBA (۲-۱)" },
                  },
                  {
                    id: "handball",
                    title: "🤾 هندبال (IHF)",
                    desc: "برد: ۲ امتیاز | مساوی: ۱ | باخت: ۰",
                    rule: { sport: "handball" as const, win: 2, draw: 1, loss: 0, name: "هندبال IHF (۲-۱-۰)" },
                  },
                  {
                    id: "beach-soccer",
                    title: "🏖️ فوتبال ساحلی (FIFA)",
                    desc: "برد قانونی: ۳ | وقت اضافه: ۲ | پنالتی: ۱ | باخت: ۰",
                    rule: {
                      sport: "beach-soccer" as const,
                      win: 3,
                      draw: 0,
                      loss: 0,
                      winExtraTime: 2,
                      winPenalties: 1,
                      name: "فوتبال ساحلی (۳-۲-۱-۰)",
                    },
                  },
                  {
                    id: "chess",
                    title: "♟️ شطرنج و انفرادی (پینگ‌پنگ)",
                    desc: "برد: ۲ | مساوی: ۱ | باخت: ۰",
                    rule: { sport: "chess" as const, win: 2, draw: 1, loss: 0, name: "انفرادی و شطرنج (۲-۱-۰)" },
                  },
                ].map((pts) => {
                  const isSelected = pointsRule.name === pts.rule.name;
                  return (
                    <button
                      key={pts.id}
                      type="button"
                      onClick={() => setPointsRule(pts.rule)}
                      className={`flex flex-col text-right p-3 rounded-xl border transition-all ${
                        isSelected
                          ? "border-pitch bg-white shadow-sm ring-2 ring-pitch/20 font-bold"
                          : "border-line bg-white/70 hover:bg-white text-ink/80"
                      }`}
                    >
                      <span className={isSelected ? "text-pitch font-bold text-xs" : "text-ink text-xs font-semibold"}>
                        {pts.title}
                      </span>
                      <span className="text-[11px] text-ink/60 mt-1 leading-normal">
                        {pts.desc}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Sport-specific rule details */}
              {pointsRule.sport === "volleyball" && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-950 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                    <span>🏐</span>
                    <span>نحوه محاسبه خودکار امتیازات و رده‌بندی والیبال بر اساس قوانین رسمی فدراسیون جهانی (FIVB):</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-emerald-900/90 pr-2">
                    <li><b>برد ۳-۰ یا ۳-۱:</b> تیم برنده ۳ امتیاز کامل کسب می‌کند و بازنده ۰ امتیاز.</li>
                    <li><b>برد ۳-۲ (ست پنجم سرنوشت‌ساز):</b> برنده ۲ امتیاز و بازنده به پاداش مقاومت تا ست پنجم ۱ امتیاز می‌گیرد.</li>
                    <li><b>قانون طلایی جدول رده‌بندی:</b> اولویت اول رتبه‌بندی در FIVB <b>«تعداد بردها»</b> است و در صورت برابری تعداد برد، امتیاز مسابقات و تفاضل ست محاسبه می‌شود.</li>
                  </ul>
                </div>
              )}

              {pointsRule.sport === "basketball" && (
                <div className="rounded-lg bg-sky-50 border border-sky-200 p-3 text-xs text-sky-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-sky-900">
                    <span>🏀</span>
                    <span>قوانین امتیازدهی بسکتبال (FIBA):</span>
                  </div>
                  <p className="text-[11px] text-sky-900/90 pr-2">
                    تیم برنده ۲ امتیاز و بازنده ۱ امتیاز دریافت می‌کند (تساوی وجود ندارد و بازی تا تعیین برنده در وقت‌های اضافه ۵ دقیقه‌ای ادامه می‌یابد). در صورت عدم حضور در زمین (باخت انضباطی)، ۰ امتیاز ثبت می‌شود.
                  </p>
                </div>
              )}

              {pointsRule.sport === "handball" && (
                <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3 text-xs text-indigo-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-indigo-900">
                    <span>🤾</span>
                    <span>قوانین امتیازدهی هندبال (IHF):</span>
                  </div>
                  <p className="text-[11px] text-indigo-900/90 pr-2">
                    در مسابقات لیگ، برد دارای ۲ امتیاز، تساوی ۱ امتیاز و باخت ۰ امتیاز است. در مراحل حذفی بازی با وقت‌های اضافه و پنالتی ادامه می‌یابد.
                  </p>
                </div>
              )}

              {pointsRule.sport === "beach-soccer" && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-950 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <span>🏖️</span>
                    <span>قوانین امتیازدهی فوتبال ساحلی (تساوی وجود ندارد):</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-900/90 pr-2">
                    <li><b>برد در وقت قانونی (۳۶ دقیقه):</b> ۳ امتیاز برای برنده | ۰ امتیاز برای بازنده</li>
                    <li><b>برد در وقت اضافه (۳ دقیقه):</b> ۲ امتیاز برای برنده | ۰ امتیاز برای بازنده</li>
                    <li><b>برد در ضربات پنالتی:</b> ۱ امتیاز برای برنده | ۰ امتیاز برای بازنده</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Group Rules */}
          {needsGroupRules && (
            <div className="rounded-xl border border-line bg-chalk/40 p-5 space-y-4">
              <h3 className="font-bold text-sm text-pitch">تنظیمات گروه‌بندی</h3>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="block">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-ink/70">تعداد گروه‌ها</span>
                    <button
                      type="button"
                      onClick={() => setNumGroups(calculateDefaultNumGroups(teamCount))}
                      className="text-[11px] text-pitch hover:underline font-bold"
                      title="تنظیم خودکار بر اساس حداکثر ۴ تیم در هر گروه"
                    >
                      پیش‌فرض ({calculateDefaultNumGroups(teamCount)} گروه)
                    </button>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={teamCount}
                    value={numGroups}
                    onChange={(e) =>
                      setNumGroups(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
                  />
                  <p className="text-[11px] text-ink/50 mt-1">
                    با {teamCount} تیم در {numGroups} گروه، هر گروه شامل{" "}
                    {Math.floor(teamCount / Math.max(1, numGroups))} تا{" "}
                    {Math.ceil(teamCount / Math.max(1, numGroups))} تیم خواهد بود (حداکثر ۴ تیم در حالت استاندارد).
                  </p>
                </div>
                {format === "groups-knockout" && (
                  <label className="block">
                    <span className="text-xs font-semibold text-ink/70">
                      تعداد صعودکننده مستقیم از هر گروه
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
                    <span className="text-[11px] text-ink/50 mt-1 block">
                      استاندارد بین‌المللی: ۲ تیم از هر گروه
                    </span>
                  </label>
                )}
              </div>

              {/* Notice & Guidelines on Power-of-2 and Euro-style 3rd Place Qualifiers */}
              {format === "groups-knockout" && (
                <div className="mt-4 rounded-xl border border-line bg-white p-4 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <span className="text-base">📌</span>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-pitch">
                        قانون استاندارد تقارن مرحله حذفی (توان عدد ۲):
                      </h4>
                      <p className="text-xs text-ink/70 leading-relaxed">
                        تعداد تیم‌های راه‌یافته به مرحله حذفی باید توان عدد ۲ (۴، ۸، ۱۶، ۳۲ تیم) باشد تا جدول بدون استراحت‌های نابرابر و با عدالت کامل برگزار شود.
                      </p>
                    </div>
                  </div>

                  {/* Dynamic Status Display */}
                  {isPowerOfTwo ? (
                    <div className="flex items-center gap-2 rounded-lg bg-pitch/5 border border-pitch/20 p-3 text-xs text-pitch">
                      <span className="font-bold text-sm">✅ ساختار ایده‌آل:</span>
                      <span>
                        با {numGroups} گروه و صعود {qualifiersPerGroup} تیم، مجموعاً <strong>{baseQualifiers} تیم</strong> به مرحله <strong>{targetBracketSize} تیمی</strong> صعود می‌کنند و جدول حذفی کاملاً متقارن است.
                      </span>
                    </div>
                  ) : canUseBestThirds ? (
                    <div className="rounded-lg bg-gold/15 border border-gold/40 p-3.5 space-y-2 text-xs text-ink">
                      <div className="flex items-center justify-between font-bold text-ink">
                        <div className="flex items-center gap-1.5">
                          <span>🏆</span>
                          <span>فرمت استاندارد جام ملت‌های اروپا (UEFA Euro / جام جهانی ۲۰۲۶)</span>
                        </div>
                        <span className="text-[10px] bg-gold/30 text-ink px-2.5 py-0.5 rounded-full font-bold">
                          بدون استراحت (BYE)
                        </span>
                      </div>
                      <p className="leading-relaxed text-ink/85">
                        با صعود ۲ تیم اول هر گروه، مجموعاً <strong>{baseQualifiers} تیم</strong> صعود می‌کنند که توان ۲ نیست. برای تشکیل جدول استاندارد <strong>{targetBracketSize} تیمی</strong>، دقیقاً <strong>{missingForPowerOfTwo} تیم</strong> کم است. سیستم هوشمند نکس‌پورت مشابه مسابقات یورو، این {missingForPowerOfTwo} تیم را از میان <strong>برترین تیم‌های رتبه سوم گروه‌ها</strong> تکمیل می‌کند تا مرحله حذفی بدون استراحت و با نهایت هیجان برگزار شود.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-ink/5 border border-line p-3 text-xs text-ink/80 leading-relaxed">
                      <span className="font-bold text-ink">ℹ️ وضعیت جدول حذفی:</span> با صعود {baseQualifiers} تیم، مرحله حذفی {targetBracketSize} تیمی تشکیل می‌شود و {missingForPowerOfTwo} جایگاه استراحت (BYE) به سرگروه‌های برتر تعلق می‌گیرد.
                    </div>
                  )}

                  {/* Smart Preset Buttons */}
                  {teamCount === 24 && (
                    <div className="pt-2 border-t border-line/60">
                      <span className="text-[11px] font-bold text-ink/60 block mb-2">
                        چیدمان‌های استاندارد و متداول برای مسابقات ۲۴ تیمی:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setNumGroups(6);
                            setQualifiersPerGroup(2);
                          }}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition-all ${
                            numGroups === 6 && qualifiersPerGroup === 2
                              ? "border-pitch bg-pitch text-white shadow-sm"
                              : "border-line bg-chalk/50 hover:bg-white text-ink/80"
                          }`}
                        >
                          🏆 ۶ گروه ۴ تیمی (فرمت یورو: ۱۲ صعودکننده مستقیم + ۴ تیم برتر سوم = ۱۶ تیمی)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNumGroups(4);
                            setQualifiersPerGroup(2);
                          }}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition-all ${
                            numGroups === 4 && qualifiersPerGroup === 2
                              ? "border-pitch bg-pitch text-white shadow-sm"
                              : "border-line bg-chalk/50 hover:bg-white text-ink/80"
                          }`}
                        >
                          ۴ گروه ۶ تیمی (۸ صعودکننده مستقیم به یک‌چهارم نهایی)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNumGroups(8);
                            setQualifiersPerGroup(2);
                          }}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition-all ${
                            numGroups === 8 && qualifiersPerGroup === 2
                              ? "border-pitch bg-pitch text-white shadow-sm"
                              : "border-line bg-chalk/50 hover:bg-white text-ink/80"
                          }`}
                        >
                          ۸ گروه ۳ تیمی (۱۶ صعودکننده مستقیم به یک‌هشتم نهایی)
                        </button>
                      </div>
                    </div>
                  )}

                  {teamCount === 12 && (
                    <div className="pt-2 border-t border-line/60">
                      <span className="text-[11px] font-bold text-ink/60 block mb-2">
                        چیدمان‌های استاندارد پیشنهادی برای ۱۲ تیم:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setNumGroups(3);
                            setQualifiersPerGroup(2);
                          }}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition-all ${
                            numGroups === 3 && qualifiersPerGroup === 2
                              ? "border-pitch bg-pitch text-white shadow-sm"
                              : "border-line bg-chalk/50 hover:bg-white text-ink/80"
                          }`}
                        >
                          🏆 ۳ گروه ۴ تیمی (۶ تیم اول و دوم + ۲ تیم برتر سوم = ۸ تیمی)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNumGroups(4);
                            setQualifiersPerGroup(2);
                          }}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition-all ${
                            numGroups === 4 && qualifiersPerGroup === 2
                              ? "border-pitch bg-pitch text-white shadow-sm"
                              : "border-line bg-chalk/50 hover:bg-white text-ink/80"
                          }`}
                        >
                          ۴ گروه ۳ تیمی (۸ صعودکننده مستقیم به یک‌چهارم نهایی)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Advance Best 3rd-Place Teams Option (Euro / World Cup Style) */}
          {format === "groups-knockout" && canUseBestThirds && (
            <div className="rounded-xl border border-line bg-chalk/40 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-pitch">
                    نحوه تکمیل جدول مرحله حذفی ({targetBracketSize} تیمی)
                  </h3>
                  <p className="text-xs text-ink/60 mt-0.5">
                    با صعود {baseQualifiers} تیم اول و دوم، برای تکمیل مرحله {targetBracketSize} تیمی شیوه موردنظر خود را انتخاب کنید:
                  </p>
                </div>
                <span className="text-[10px] font-bold bg-pitch/10 text-pitch px-2.5 py-1 rounded-full">
                  فرمت جام ملت‌های اروپا
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`relative flex cursor-pointer flex-col rounded-xl border p-4 transition-all ${
                    advanceBestThirds
                      ? "border-pitch bg-white shadow-sm ring-2 ring-pitch/20"
                      : "border-line bg-white/70 hover:border-pitch/40"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="advanceBestThirdsOption"
                        checked={advanceBestThirds}
                        onChange={() => setAdvanceBestThirds(true)}
                        className="text-pitch focus:ring-pitch"
                      />
                      <span className="font-bold text-sm text-pitch">
                        صعود {missingForPowerOfTwo} تیم برتر رتبه سوم (استاندارد یورو)
                      </span>
                    </div>
                    <span className="text-[10px] font-bold bg-pitch/10 text-pitch px-2 py-0.5 rounded-full">
                      پیشنهادی
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-ink/70 leading-relaxed">
                    {baseQualifiers} تیم اول و دوم به همراه {missingForPowerOfTwo} تیم برتر رتبه سوم صعود می‌کنند تا جدول {targetBracketSize} تیمی کاملاً پر شده و هیچ تیمی در دور اول استراحت نابرابر نداشته باشد.
                  </p>
                </label>

                <label
                  className={`relative flex cursor-pointer flex-col rounded-xl border p-4 transition-all ${
                    !advanceBestThirds
                      ? "border-pitch bg-white shadow-sm ring-2 ring-pitch/20"
                      : "border-line bg-white/70 hover:border-pitch/40"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="advanceBestThirdsOption"
                        checked={!advanceBestThirds}
                        onChange={() => setAdvanceBestThirds(false)}
                        className="text-pitch focus:ring-pitch"
                      />
                      <span className="font-bold text-sm text-pitch">
                        صرفاً صعود تیم‌های اول و دوم (با استراحت / BYE)
                      </span>
                    </div>
                    <span className="text-[10px] font-bold bg-ink/10 text-ink/70 px-2 py-0.5 rounded-full">
                      سنتی
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-ink/70 leading-relaxed">
                    فقط {baseQualifiers} تیم صعود می‌کنند و {missingForPowerOfTwo} تیم سرگروه برتر در دور اول حذفی استراحت (BYE) خواهند داشت.
                  </p>
                </label>
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

          {/* Double League Round Style */}
          {format === "double-league" && (
            <div className="rounded-xl border border-line bg-chalk/40 p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-pitch">
                  نحوه زمان‌بندی و تقویم دور برگشت (Double Round-Robin)
                </h3>
                <p className="text-xs text-ink/60 mt-1">
                  شما می‌توانید نحوه ترتیب مسابقات در نیم‌فصل دوم را مطابق استانداردهای روز دنیا یا تقویم کلاسیک انتخاب کنید:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`relative flex cursor-pointer flex-col rounded-xl border p-4 transition-all ${
                    independentSecondLeg
                      ? "border-pitch bg-white shadow-sm ring-2 ring-pitch/20"
                      : "border-line bg-white/70 hover:border-pitch/40"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="secondLegStyle"
                        checked={independentSecondLeg}
                        onChange={() => setIndependentSecondLeg(true)}
                        className="text-pitch focus:ring-pitch"
                      />
                      <span className="font-bold text-sm text-pitch">
                        تقویم نامتقارن (مدرن اروپایی)
                      </span>
                    </div>
                    <span className="text-[10px] font-bold bg-pitch/10 text-pitch px-2 py-0.5 rounded-full">
                      پیش‌فرض لیگ‌های معتبر
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-ink/70 leading-relaxed">
                    مشابه لیگ برتر انگلیس و لالیگا؛ ترتیب هفته‌های دور برگشت به شکل متوازن چیده می‌شود تا هیجان مسابقات بالا بماند و تیم‌ها بلافاصله در هفته بعد با همان حریف قبلی روبه‌رو نشوند.
                  </p>
                </label>

                <label
                  className={`relative flex cursor-pointer flex-col rounded-xl border p-4 transition-all ${
                    !independentSecondLeg
                      ? "border-pitch bg-white shadow-sm ring-2 ring-pitch/20"
                      : "border-line bg-white/70 hover:border-pitch/40"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="secondLegStyle"
                        checked={!independentSecondLeg}
                        onChange={() => setIndependentSecondLeg(false)}
                        className="text-pitch focus:ring-pitch"
                      />
                      <span className="font-bold text-sm text-pitch">
                        تقویم قرینه (کلاسیک و آینه‌ای)
                      </span>
                    </div>
                    <span className="text-[10px] font-bold bg-ink/10 text-ink/70 px-2 py-0.5 rounded-full">
                      سنتی
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-ink/70 leading-relaxed">
                    هفته‌های دور برگشت عیناً به ترتیب دور رفت تکرار می‌شوند (هفته اول دور برگشت تکرار بازی‌های هفته اول دور رفت با جابه‌جایی میزبان و میهمان است).
                  </p>
                </label>
              </div>
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

          {/* Double Knockout Options (Bracket Reset) */}
          {format === "double-knockout" && (
            <div className="rounded-xl border border-line bg-chalk/40 p-5 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasResetFinal}
                  onChange={(e) => setHasResetFinal(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-line text-pitch focus:ring-pitch"
                />
                <div>
                  <span className="text-sm font-bold text-pitch">
                    برگزاری فینال مجدد در صورت باخت قهرمان برندگان (Bracket Reset)
                  </span>
                  <p className="text-xs text-ink/70 mt-1 leading-relaxed">
                    در فرمت رسمی دو حذفی، چون قهرمان جدول برندگان تا پیش از فینال هیچ شکستی نداشته است، در صورتی که در فینال اول از قهرمان بازندگان شکست بخورد، یک مسابقه سرنوشت‌ساز دوم برای تعیین قهرمان نهایی تورنمنت برگزار می‌شود.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Seeded Teams Selection for Knockout and Double Knockout */}
          {(format === "knockout" || format === "double-knockout") && (
            <div className="rounded-xl border border-line bg-chalk/40 p-5 space-y-3">
              <p className="text-sm font-bold text-pitch">
                تیم‌های شاخص مسابقات {format === "double-knockout" ? "دو حذفی" : "تک‌حذفی"} (اختیاری)
              </p>
              <p className="text-xs text-ink/60">
                به ترتیبی که کلیک می‌کنید، اولویت سیدبندی حذفی تعیین می‌شود تا تیم‌های برتر در مراحل اولیه به یکدیگر برخورد نکنند. برای لغو دوباره روی نام تیم کلیک کنید.
              </p>
              <div className="flex flex-wrap gap-2">
                {teamNames.map((team) => {
                  const idx = seededTeams.indexOf(team);
                  const selected = idx !== -1;
                  return (
                    <button
                      key={team}
                      type="button"
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

          {/* Multi-Pot Seeding for Group Stages (Pots 1, 2, 3, 4) */}
          {needsGroupRules && (
            <div className="rounded-xl border border-line bg-chalk/40 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-pitch flex items-center gap-1.5">
                    <span>🎲</span>
                    <span>سیدبندی گروه‌ها (اختیاری - سیدهای ۱، ۲، ۳ و ۴)</span>
                  </h3>
                  <p className="text-xs text-ink/60 mt-0.5">
                    تعیین سیدها اختیاری است. تیم‌های هر سید در گروه‌های مجزا قرعه‌کشی می‌شوند تا با یکدیگر در یک گروه قرار نگیرند (حداکثر {numGroups} تیم در هر سید).
                  </p>
                </div>
                <span className="text-[11px] font-bold bg-pitch/10 text-pitch px-2.5 py-1 rounded-full">
                  حداکثر {numGroups} تیم در هر سید
                </span>
              </div>

              {/* Pot Navigation Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {[
                  { num: 1 as const, title: "سید ۱ (سرگروه)", count: seededTeams.length, icon: "🌟" },
                  { num: 2 as const, title: "سید ۲", count: pot2Teams.length, icon: "🥈" },
                  { num: 3 as const, title: "سید ۳", count: pot3Teams.length, icon: "🥉" },
                  { num: 4 as const, title: "سید ۴", count: pot4Teams.length, icon: "🏅" },
                ].map((pot) => {
                  const isActive = activePotTab === pot.num;
                  return (
                    <button
                      key={pot.num}
                      type="button"
                      onClick={() => setActivePotTab(pot.num)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-right ${
                        isActive
                          ? "border-pitch bg-white shadow-sm ring-2 ring-pitch/20 font-bold"
                          : "border-line bg-white/70 hover:bg-white text-ink/70"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs">
                        <span>{pot.icon}</span>
                        <span className={isActive ? "text-pitch font-bold" : "text-ink"}>{pot.title}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                            pot.count > 0 ? "bg-pitch/10 text-pitch" : "bg-ink/5 text-ink/50"
                          }`}
                        >
                          {pot.count} از {numGroups} تیم
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Active Pot Info & Team Selector */}
              <div className="rounded-xl border border-line bg-white p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-2.5">
                  <div className="text-xs text-ink/80">
                    {activePotTab === 1 && (
                      <span>
                        🌟 <strong>سرگروه‌ها (سید ۱):</strong> در رأس هر یک از {numGroups} گروه قرعه‌کشی می‌شوند (حداکثر {numGroups} تیم).
                      </span>
                    )}
                    {activePotTab === 2 && (
                      <span>
                        🥈 <strong>سید دو:</strong> تیم‌های سطح دو؛ هر تیم در یک گروه جداگانه قرعه‌کشی می‌شود و با هم هم‌گروه نمی‌شوند (حداکثر {numGroups} تیم).
                      </span>
                    )}
                    {activePotTab === 3 && (
                      <span>
                        🥉 <strong>سید سه:</strong> تیم‌های سطح سه؛ در گروه‌های جداگانه قرعه‌کشی می‌شوند (حداکثر {numGroups} تیم).
                      </span>
                    )}
                    {activePotTab === 4 && (
                      <span>
                        🏅 <strong>سید چهار:</strong> تیم‌های سطح چهار؛ در گروه‌های جداگانه قرعه‌کشی می‌شوند (حداکثر {numGroups} تیم).
                      </span>
                    )}
                  </div>

                  {/* Clear Button for current pot */}
                  {((activePotTab === 1 && seededTeams.length > 0) ||
                    (activePotTab === 2 && pot2Teams.length > 0) ||
                    (activePotTab === 3 && pot3Teams.length > 0) ||
                    (activePotTab === 4 && pot4Teams.length > 0)) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (activePotTab === 1) setSeededTeams([]);
                        if (activePotTab === 2) setPot2Teams([]);
                        if (activePotTab === 3) setPot3Teams([]);
                        if (activePotTab === 4) setPot4Teams([]);
                      }}
                      className="text-[11px] text-brick hover:underline font-bold"
                    >
                      ✕ پاک‌کردن تیم‌های سید {activePotTab}
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {teamNames.map((team) => {
                    const currentPot = getTeamPot(team);
                    const isInActivePot = currentPot === activePotTab;
                    const isInOtherPot = currentPot !== null && currentPot !== activePotTab;

                    let buttonClass =
                      "rounded-full border px-3.5 py-1.5 text-xs transition-all flex items-center gap-1.5 ";

                    if (isInActivePot) {
                      if (activePotTab === 1) {
                        buttonClass += "border-gold bg-gold/25 text-ink font-bold shadow-sm";
                      } else if (activePotTab === 2) {
                        buttonClass += "border-sky-500 bg-sky-100 text-sky-950 font-bold shadow-sm";
                      } else if (activePotTab === 3) {
                        buttonClass += "border-amber-600 bg-amber-100 text-amber-950 font-bold shadow-sm";
                      } else {
                        buttonClass += "border-purple-500 bg-purple-100 text-purple-950 font-bold shadow-sm";
                      }
                    } else if (isInOtherPot) {
                      buttonClass += "border-line bg-chalk/60 text-ink/60 hover:border-pitch/40";
                    } else {
                      buttonClass += "border-line bg-white text-ink/80 hover:border-pitch/40 hover:bg-chalk/30";
                    }

                    return (
                      <button
                        key={team}
                        type="button"
                        onClick={() => toggleTeamInPot(team, activePotTab)}
                        className={buttonClass}
                        title={
                          isInOtherPot
                            ? `این تیم هم‌اکنون در سید ${currentPot} است. برای انتقال به سید ${activePotTab} کلیک کنید.`
                            : isInActivePot
                            ? "برای حذف از این سید کلیک کنید."
                            : `افزودن به سید ${activePotTab}`
                        }
                      >
                        {isInActivePot && (
                          <span className="font-bold text-[11px]">✓</span>
                        )}
                        <span>{team}</span>
                        {isInOtherPot && (
                          <span className="text-[10px] text-ink/50 bg-ink/5 px-1.5 py-0.5 rounded-full">
                            سید {currentPot}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pots Summary Bar */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-ink/70">
                <span className="font-bold text-ink/80">خلاصه سیدبندی:</span>
                <span className="inline-flex items-center gap-1 bg-white border border-line px-2.5 py-1 rounded-lg">
                  <span>🌟 سید ۱:</span>
                  <strong className="text-pitch">{seededTeams.length}</strong>
                </span>
                <span className="inline-flex items-center gap-1 bg-white border border-line px-2.5 py-1 rounded-lg">
                  <span>🥈 سید ۲:</span>
                  <strong className="text-pitch">{pot2Teams.length}</strong>
                </span>
                <span className="inline-flex items-center gap-1 bg-white border border-line px-2.5 py-1 rounded-lg">
                  <span>🥉 سید ۳:</span>
                  <strong className="text-pitch">{pot3Teams.length}</strong>
                </span>
                <span className="inline-flex items-center gap-1 bg-white border border-line px-2.5 py-1 rounded-lg">
                  <span>🏅 سید ۴:</span>
                  <strong className="text-pitch">{pot4Teams.length}</strong>
                </span>
                <span className="inline-flex items-center gap-1 bg-white border border-line px-2.5 py-1 rounded-lg">
                  <span>⚪ قرعه آزاد:</span>
                  <strong className="text-pitch">
                    {teamCount - (seededTeams.length + pot2Teams.length + pot3Teams.length + pot4Teams.length)}
                  </strong>
                </span>
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
                className="inline-flex items-center justify-center rounded-md border border-gold/40 bg-gold/15 px-3.5 py-2 text-sm font-bold text-gold-dark transition-colors hover:bg-gold hover:text-white cursor-pointer"
                onClick={handleOpenSaveCloud}
                title="ذخیره این مسابقه و نتایج آن در فضای ابری حساب کاربری"
              >
                ☁️ ذخیره ابری
              </button>

              <button
                className={btnGhost}
                onClick={handleOpenSavedList}
                title="مشاهده و بارگذاری مسابقات ذخیره شده در حساب کاربری"
              >
                📂 مسابقات من
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
                onClick={handleExportJson}
                title="دانلود فایل پشتیبان مسابقه (.json) برای ذخیره روی سیستم یا انتقال به دستگاه دیگر"
              >
                💾 ذخیره فایل (JSON)
              </button>

              <button
                className={btnGhost}
                onClick={() => jsonFileInputRef.current?.click()}
                title="بارگذاری مسابقه قبلی از فایل JSON"
              >
                📂 باز کردن مسابقه
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
            matchDetails={matchDetails}
            onScoreChange={handleScoreChange}
            onMatchDetailChange={handleMatchDetailChange}
            onResetScores={handleResetScores}
            teams={teamNames}
            qualifiersPerGroup={qualifiersPerGroup}
          />
        </section>
      )}

      {/* Cloud Tournament Save / Load Modal */}
      <SavedTournamentsModal
        isOpen={savedModalOpen}
        mode={savedModalMode}
        onClose={() => setSavedModalOpen(false)}
        currentTournament={
          format
            ? {
                id: currentSavedId,
                title:
                  metadata.title ||
                  FORMAT_OPTIONS.find((f) => f.key === format)?.title ||
                  "مسابقه ورزشی",
                format: format,
                teamCount: teamCount,
                state: {
                  step,
                  format,
                  teamCount,
                  teamNames,
                  numGroups,
                  qualifiersPerGroup,
                  seededTeams,
                  pot2Teams,
                  pot3Teams,
                  pot4Teams,
                  avoidPairs,
                  hasThirdPlace,
                  hasResetFinal,
                  independentSecondLeg,
                  advanceBestThirds,
                  pointsRule,
                  metadata,
                  result,
                  scores,
                  matchDetails,
                },
              }
            : undefined
        }
        onLoadTournament={handleLoadCloudTournament}
        onSavedSuccess={handleCloudSaveSuccess}
      />
    </main>
  );
}

export default function PlannerPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-6 py-24 text-center text-ink/60 font-medium">
          در حال بارگذاری برنامه‌ریز مسابقات...
        </div>
      }
    >
      <PlannerWizard />
    </Suspense>
  );
}
