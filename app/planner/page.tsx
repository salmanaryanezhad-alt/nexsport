"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
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
import { ShareTournamentModal } from "@/components/planner/ShareTournamentModal";
import { RegistrationModal } from "@/components/planner/RegistrationModal";
import { DrawCeremonyModal } from "@/components/planner/DrawCeremonyModal";
import { StoreModal } from "@/components/planner/StoreModal";
import { SavedTeamsPicker } from "@/components/planner/SavedTeamsPicker";
import { toPersianDigits, toEnglishDigits } from "@/lib/digits";
import { encodeTournamentPayload } from "@/lib/tournamentCodec";

const STORAGE_KEY = "nexsport_wizard_state_v4";

function formatGroupDistribution(teamCount: number, numGroups: number): string {
  const G = Math.max(1, numGroups);
  if (teamCount % G === 0) {
    return `هر گروه ${toPersianDigits(teamCount / G)} تیم`;
  }
  const rem = teamCount % G;
  const floor = Math.floor(teamCount / G);
  const ceil = floor + 1;
  const ceilCount = rem;
  const floorCount = G - rem;
  return `${toPersianDigits(ceilCount)} گروه ${toPersianDigits(ceil)} تیمی و ${toPersianDigits(floorCount)} گروه ${toPersianDigits(floor)} تیمی`;
}

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
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-black text-white transition-all hover:brightness-110 hover:shadow-glow hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none shadow-md cursor-pointer";
const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white/95 px-5 py-2.5 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 shadow-2xs cursor-pointer";

function PlannerWizard() {
  const searchParams = useSearchParams();
  const formatQuery = searchParams.get("format") as CompetitionFormat | null;

  const [step, setStep] = useState(0);
  const [format, setFormat] = useState<CompetitionFormat | null>(null);
  const [formatCategory, setFormatCategory] = useState<"all" | "tournament" | "league">("all");
  const [teamCount, setTeamCount] = useState(8);
  const [teamCountInput, setTeamCountInput] = useState("۸");
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [libraryTeamIds, setLibraryTeamIds] = useState<(string | null)[]>([]);
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
  const [customWin, setCustomWin] = useState<number>(3);
  const [customDraw, setCustomDraw] = useState<number>(1);
  const [customLoss, setCustomLoss] = useState<number>(0);

  function handleUpdateCustomPoints(win: number, draw: number, loss: number) {
    const w = Math.max(0, win);
    const d = Math.max(0, draw);
    const l = Math.max(0, loss);
    setCustomWin(w);
    setCustomDraw(d);
    setCustomLoss(l);
    setPointsRule({
      sport: "custom",
      win: w,
      draw: d,
      loss: l,
      name: `سفارشی (${toPersianDigits(w)}-${toPersianDigits(d)}-${toPersianDigits(l)})`,
    });
  }
  const [matchDetails, setMatchDetails] = useState<Record<string, MatchScheduleDetail>>({});
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [scores, setScores] = useState<Record<string, MatchScore>>({});
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [quotaCharged, setQuotaCharged] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const generateLockRef = useRef(false);
  const pendingUnchargedDrawRef = useRef(false);

  // Cloud Tournament Storage & Auth Integration
  const { user, openAuthModal, isAdmin } = useAuth();
  const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);
  const [savedModalOpen, setSavedModalOpen] = useState(false);
  const [savedModalMode, setSavedModalMode] = useState<"save" | "list">("list");
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareModalTournamentId, setShareModalTournamentId] = useState<string | null>(null);
  const [shareModalTournamentTitle, setShareModalTournamentTitle] = useState<string>("");
  const [registrationModalOpen, setRegistrationModalOpen] = useState(false);

  // Store & Quota Management
  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const [storeModalTab, setStoreModalTab] = useState<"credits" | "vip" | "clubpro">("credits");
  const [storeReturnSuccess, setStoreReturnSuccess] = useState<{
    type: "credits" | "vip";
    count?: number;
    totalCredits?: number;
    title?: string;
    refId?: string;
  } | null>(null);
  const [guestLimitModalOpen, setGuestLimitModalOpen] = useState(false);
  const [quota, setQuota] = useState<{
    isGuest: boolean;
    planningCredits?: number;
    freeLinkAvailable?: boolean;
    isVip?: boolean;
    unlimitedPlanning?: boolean;
    vipExpiresAt?: string | null;
    remaining?: number;
    guestCount?: number;
    guestLimit?: number;
    giftPlannings?: number;
    giftLinks?: number;
  } | null>(null);

  const loadQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/tournaments/quota/", { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        if (data.isGuest && user) {
          setQuota({
            isGuest: false,
            planningCredits: isAdmin ? 999999 : 5,
            freeLinkAvailable: true,
            isVip: false,
            unlimitedPlanning: isAdmin,
          });
          return;
        }
        if (data.isGuest && typeof window !== "undefined") {
          const localGuestCount = parseInt(
            localStorage.getItem("nexsport_guest_tournaments_count") || "0",
            10
          );
          const effectiveCount = Math.max(data.guestCount || 0, localGuestCount);
          setQuota({
            ...data,
            guestCount: effectiveCount,
            remaining: Math.max(0, (data.guestLimit || 2) - effectiveCount),
          });
          return;
        }
        setQuota(data);
      }
    } catch {}
  }, [user, isAdmin]);

  useEffect(() => {
    loadQuota();
  }, [loadQuota, user]);

  function applyConsumeResult(data: any) {
    if (data?.isGuest && !user) {
      try {
        const currentLocal = parseInt(localStorage.getItem("nexsport_guest_tournaments_count") || "0", 10);
        const newCount = Math.max(Number(data.count || 0), Number.isFinite(currentLocal) ? currentLocal + 1 : 1);
        localStorage.setItem("nexsport_guest_tournaments_count", String(newCount));
        setQuota((prev) => ({
          isGuest: true,
          guestLimit: prev?.guestLimit ?? 2,
          guestCount: newCount,
          remaining: Math.max(0, (prev?.guestLimit ?? 2) - newCount),
        }));
      } catch {}
      return;
    }
    if (data?.unlimitedPlanning || data?.isVip || isAdmin) {
      setQuota((prev) =>
        prev ? { ...prev, unlimitedPlanning: true, planningCredits: 999999, isVip: Boolean(prev.isVip || data.isVip) } : prev
      );
      return;
    }
    if (typeof data?.remaining === "number") {
      setQuota((prev) => (prev ? { ...prev, planningCredits: data.remaining } : prev));
    }
  }

  async function consumeQuotaForDraw(): Promise<boolean> {
    try {
      const res = await fetch("/api/tournaments/quota/", { method: "POST", credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (user && (res.status === 401 || data.expired || data.isGuest)) {
        openAuthModal("login");
        setError("نشست شما برای ثبت سهمیه معتبر نیست. لطفاً دوباره وارد شوید.");
        return false;
      }
      if (!res.ok) {
        if (data.needsPurchase) {
          setStoreModalTab("credits");
          setStoreModalOpen(true);
        } else if (data.needsAuth) {
          setGuestLimitModalOpen(true);
        }
        setError(data.error || "سهمیه شما برای ساخت برنامه کافی نیست.");
        return false;
      }
      applyConsumeResult(data);
      return true;
    } catch {
      setError("برای ساخت برنامه باید اتصال اینترنت برقرار باشد تا سهمیه ثبت شود.");
      return false;
    }
  }

  useEffect(() => {
    if (!isLoaded || !pendingUnchargedDrawRef.current) return;
    pendingUnchargedDrawRef.current = false;
    let cancelled = false;
    (async () => {
      const charged = await consumeQuotaForDraw();
      if (cancelled) return;
      if (charged) {
        setQuotaCharged(true);
      } else {
        setResult(null);
        setQuotaCharged(false);
        setShowDrawCeremony(false);
        setStep(3);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, user]);

  // Live Draw Ceremony state
  const [showDrawCeremony, setShowDrawCeremony] = useState(false);
  const [ceremonyMode, setCeremonyMode] = useState<"full" | "summary">("full");
  const [isRedrawCeremony, setIsRedrawCeremony] = useState(false);

  // Bulk input & file input refs
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [excelHasHeader, setExcelHasHeader] = useState(true);
  const [rawExcelRows, setRawExcelRows] = useState<string[]>([]);
  const excelInputRef = useRef<HTMLInputElement | null>(null);

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
          setTeamCountInput(toPersianDigits(parsed.teamCount));
        }
        if (Array.isArray(parsed.teamNames)) setTeamNames(parsed.teamNames);
        if (Array.isArray(parsed.libraryTeamIds)) setLibraryTeamIds(parsed.libraryTeamIds);
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
        if (parsed.pointsRule) {
          setPointsRule(parsed.pointsRule);
          if (parsed.pointsRule.sport === "custom") {
            setCustomWin(parsed.pointsRule.win ?? 3);
            setCustomDraw(parsed.pointsRule.draw ?? 1);
            setCustomLoss(parsed.pointsRule.loss ?? 0);
          }
        }
        if (parsed.metadata) setMetadata(parsed.metadata);
        if (parsed.result) setResult(parsed.result);
        if (parsed.scores) setScores(parsed.scores);
        if (parsed.matchDetails) setMatchDetails(parsed.matchDetails);
        if (typeof parsed.currentSavedId === "string")
          setCurrentSavedId(parsed.currentSavedId);
        if (parsed.result) {
          if (parsed.quotaCharged || parsed.step === 4 || parsed.currentSavedId) {
            setQuotaCharged(true);
          } else {
            pendingUnchargedDrawRef.current = true;
          }
        }
      }

      // If user came with ?open=saved, open the saved tournaments modal
      if (searchParams.get("open") === "saved") {
        setSavedModalMode("list");
        setSavedModalOpen(true);
      }

      // If user selected a format on the homepage (e.g. /planner?format=knockout), jump directly to that format!
      if (formatQuery && validFormats.includes(formatQuery)) {
        pendingUnchargedDrawRef.current = false;
        setQuotaCharged(false);
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

  const paymentStatusQuery = searchParams.get("payment_status");
  useEffect(() => {
    if (!paymentStatusQuery) return;
    const itemType = searchParams.get("itemType") || "";
    const tournamentId = searchParams.get("tournamentId") || "";
    const refId = searchParams.get("refId") || "";
    const creditCount = Number(searchParams.get("creditCount") || 0);

    if (paymentStatusQuery === "success") {
      if (itemType === "vip_subscription") {
        setStoreReturnSuccess({ type: "vip", title: "VIP", refId: refId || undefined });
        setStoreModalTab("vip");
        setStoreModalOpen(true);
      } else if (itemType === "planning_credits" || (!itemType && !tournamentId)) {
        setStoreReturnSuccess({
          type: "credits",
          count: creditCount || undefined,
          refId: refId || undefined,
        });
        setStoreModalTab("credits");
        setStoreModalOpen(true);
      } else if (tournamentId) {
        setShareModalTournamentId(tournamentId);
        setShareModalOpen(true);
      }
      loadQuota();
    } else if (
      paymentStatusQuery === "failed" ||
      paymentStatusQuery === "canceled" ||
      paymentStatusQuery === "error"
    ) {
      if (itemType === "vip_subscription") setStoreModalTab("vip");
      else if (!tournamentId) setStoreModalTab("credits");
      if (itemType === "planning_credits" || itemType === "vip_subscription" || !tournamentId) {
        setStoreModalOpen(true);
      }
    }

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      ["payment_status", "refId", "itemType", "tournamentId", "creditCount", "error"].forEach((key) => {
        url.searchParams.delete(key);
      });
      const next = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "");
      window.history.replaceState({}, "", next);
    }
  }, [paymentStatusQuery, searchParams, loadQuota]);

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
          libraryTeamIds,
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
          quotaCharged,
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
    libraryTeamIds,
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
    quotaCharged,
  ]);

  // Auto-sync scores & matchDetails to public spectator links whenever updated
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isLoaded || step !== 4) return;
    const tid = currentSavedId;

    // 1. Local real-time broadcast for same-browser spectator tabs
    try {
      const syncPayload = {
        id: tid,
        scores,
        matchDetails,
        result,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem("nexsport_t_updated", JSON.stringify(syncPayload));

      if (tid) {
        localStorage.setItem(`nexsport_t_${tid}_scores`, JSON.stringify(scores));
        localStorage.setItem(`nexsport_t_${tid}_matchDetails`, JSON.stringify(matchDetails));
      }
    } catch {}

    // 2. Debounced background sync to server
    if (tid) {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(async () => {
        try {
          await fetch(`/api/tournaments/${tid}/sync/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scores,
              matchDetails,
              result,
              fallbackData: {
                title: metadata.title || FORMAT_OPTIONS.find((f) => f.key === format)?.title || "مسابقات ورزشی",
                format,
                sport: pointsRule?.sport,
                teamCount,
                state: {
                  step: 4,
                  format,
                  teamCount,
                  teamNames,
                  libraryTeamIds,
                  numGroups,
                  qualifiersPerGroup,
                  seededTeams,
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
                  payment: { isPaid: true, amount: 200000 },
                },
              },
            }),
          });
        } catch {
          // Fallback silently
        }
      }, 400);
    }

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [scores, matchDetails, result, currentSavedId, step, isLoaded]);

  const accountSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!isLoaded || !user || !currentSavedId || !format) return;
    if (accountSaveTimeoutRef.current) clearTimeout(accountSaveTimeoutRef.current);
    accountSaveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch("/api/tournaments", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: currentSavedId,
            title:
              metadata.title ||
              FORMAT_OPTIONS.find((f) => f.key === format)?.title ||
              "مسابقه ورزشی",
            format,
            sport: pointsRule?.sport,
            teamCount,
            state: {
              step,
              format,
              teamCount,
              teamNames,
              libraryTeamIds,
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
          }),
        });
      } catch {
        // silent autosave
      }
    }, 900);
    return () => {
      if (accountSaveTimeoutRef.current) clearTimeout(accountSaveTimeoutRef.current);
    };
  }, [
    isLoaded,
    user,
    currentSavedId,
    step,
    format,
    teamCount,
    teamNames,
    libraryTeamIds,
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
  ]);

  const needsGroupRules = format === "groups" || format === "groups-knockout";
  const needsSeedRules = format === "knockout" || format === "double-knockout" || needsGroupRules;
  const supportsThirdPlace = format === "knockout" || format === "groups-knockout";
  const scheduleAlreadyDrawn = Boolean(result);

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
    setTeamCountInput(toPersianDigits(validCount));
    setNumGroups(calculateDefaultNumGroups(validCount));
  }

  function handleTypingTeamCount(val: string) {
    const eng = toEnglishDigits(val).replace(/[^0-9]/g, "");
    setTeamCountInput(toPersianDigits(eng));
    if (eng.length > 0) {
      const parsed = parseInt(eng, 10);
      if (parsed >= 2 && parsed <= 128) {
        setTeamCount(parsed);
        setNumGroups(calculateDefaultNumGroups(parsed));
      }
    }
  }

  function handleBlurTeamCount() {
    const eng = toEnglishDigits(teamCountInput).replace(/[^0-9]/g, "");
    let parsed = parseInt(eng, 10);
    if (isNaN(parsed) || parsed < 2) parsed = 2;
    if (parsed > 128) parsed = 128;
    setTeamCount(parsed);
    setTeamCountInput(toPersianDigits(parsed));
    setNumGroups(calculateDefaultNumGroups(parsed));
  }

  function ensureNames() {
    setTeamNames((prev) => {
      const next = [...prev];
      while (next.length < teamCount) next.push(`تیم ${toPersianDigits(next.length + 1)}`);
      return next.slice(0, teamCount);
    });
  }

  function hasCustomTeamNames() {
    return Array.from({ length: teamCount }).some((_, i) => {
      const n = String(teamNames[i] || "").trim();
      if (!n) return false;
      if (n === `تیم ${toPersianDigits(i + 1)}`) return false;
      return !/^تیم\s*[0-9۰-۹٠-٩]+$/.test(n);
    });
  }

  function confirmReplaceTeamNames(actionLabel: string) {
    if (!hasCustomTeamNames()) return true;
    return window.confirm(
      `با «${actionLabel}» همه نام‌هایی که وارد کرده‌اید جایگزین می‌شود. ادامه می‌دهید؟`
    );
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
      setError(`حداکثر ${toPersianDigits(numGroups)} تیم (به تعداد گروه‌ها) برای سید ${toPersianDigits(potNum)} قابل انتخاب است.`);
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
        nextNames.push(teamNames[i]?.trim() || `تیم ${toPersianDigits(i + 1)}`);
      }
    }

    setTeamNames(nextNames);
    setLibraryTeamIds([]);
    setShowBulkModal(false);
    setBulkText("");

    if (valid.length < teamCount) {
      const remaining = teamCount - valid.length;
      setInfoMessage(
        `✅ تعداد اسامی واردشده (${toPersianDigits(valid.length)} تیم) کمتر از ظرفیت مسابقه بود؛ ${toPersianDigits(valid.length)} تیم اول جایگزین شدند و ${toPersianDigits(remaining)} تیم با نام پیش‌فرض باقی ماندند.`
      );
      setTimeout(() => setInfoMessage(null), 4500);
    } else if (valid.length > teamCount) {
      setInfoMessage(
        `⚠️ تعداد اسامی واردشده (${toPersianDigits(valid.length)} تیم) بیشتر از تعداد تیم‌های مسابقه (${toPersianDigits(teamCount)} تیم) است؛ تنها ${toPersianDigits(teamCount)} تیم اول لیست به مسابقات وارد شدند.`
      );
      setTimeout(() => setInfoMessage(null), 5000);
    } else {
      setInfoMessage(`✅ تمامی ${toPersianDigits(teamCount)} تیم انتخابی با موفقیت در لیست مسابقات قرار گرفتند!`);
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
          `📊 فایل اکسل با موفقیت خوانده شد (${toPersianDigits(count)} نام تیم استخراج گردید).`
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

  async function handleGenerate() {
    if (generateLockRef.current || isGenerating) return;

    if (user) {
      if (quota && !quota.isVip && !quota.unlimitedPlanning && !isAdmin && (quota.planningCredits ?? 5) <= 0) {
        setStoreModalTab("credits");
        setStoreModalOpen(true);
        return;
      }
    } else if (quota && (quota.guestCount ?? 0) >= (quota.guestLimit ?? 2)) {
      setGuestLimitModalOpen(true);
      return;
    }

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

      // Sanitize team names (trim whitespace)
      const cleanTeamNames = teamNames.map((t) => t.trim());

      // Prune any stale seeds or avoid pairs that are no longer part of active teamNames
      const activeTeamSet = new Set(cleanTeamNames);
      const cleanSeeds = (seededTeams || []).map((t) => t.trim()).filter((t) => activeTeamSet.has(t));
      const cleanPot2 = (pot2Teams || []).map((t) => t.trim()).filter((t) => activeTeamSet.has(t));
      const cleanPot3 = (pot3Teams || []).map((t) => t.trim()).filter((t) => activeTeamSet.has(t));
      const cleanPot4 = (pot4Teams || []).map((t) => t.trim()).filter((t) => activeTeamSet.has(t));
      const cleanAvoidPairs = (avoidPairs || [])
        .map(([a, b]) => [a.trim(), b.trim()] as [string, string])
        .filter(([a, b]) => activeTeamSet.has(a) && activeTeamSet.has(b));

      if (cleanSeeds.length !== seededTeams.length) setSeededTeams(cleanSeeds);
      if (cleanPot2.length !== pot2Teams.length) setPot2Teams(cleanPot2);
      if (cleanPot3.length !== pot3Teams.length) setPot3Teams(cleanPot3);
      if (cleanPot4.length !== pot4Teams.length) setPot4Teams(cleanPot4);
      if (cleanAvoidPairs.length !== avoidPairs.length) setAvoidPairs(cleanAvoidPairs);

      if (format === "groups" || format === "groups-knockout") {
        r = generateSchedule({
          format,
          teams: cleanTeamNames,
          numGroups,
          seededTeams: cleanSeeds,
          pot2Teams: cleanPot2,
          pot3Teams: cleanPot3,
          pot4Teams: cleanPot4,
          qualifiersPerGroup,
          advanceBestThirds,
          avoidPairs: cleanAvoidPairs,
          hasThirdPlace,
          metadata: trimmedMetadata,
        });
      } else if (format === "knockout") {
        r = generateSchedule({
          format,
          teams: cleanTeamNames,
          seededTeams: cleanSeeds,
          hasThirdPlace,
          metadata: trimmedMetadata,
        });
      } else if (format === "double-knockout") {
        r = generateSchedule({
          format: "double-knockout",
          teams: cleanTeamNames,
          seededTeams: cleanSeeds,
          hasResetFinal,
          metadata: trimmedMetadata,
        });
      } else if (format === "double-league") {
        r = generateSchedule({
          format: "double-league",
          teams: cleanTeamNames,
          independentSecondLeg,
          metadata: trimmedMetadata,
        });
      } else {
        r = generateSchedule({
          format,
          teams: cleanTeamNames,
          metadata: trimmedMetadata,
        });
      }

      generateLockRef.current = true;
      setIsGenerating(true);
      const charged = await consumeQuotaForDraw();
      if (!charged) {
        generateLockRef.current = false;
        setIsGenerating(false);
        return;
      }

      setQuotaCharged(true);
      setResult(r);
      setScores({});
      setIsRedrawCeremony(false);
      setCeremonyMode("full");
      setShowDrawCeremony(true);
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ...parsed, result: r, scores: {}, quotaCharged: true })
        );
      } catch {}
    } catch (e) {
      setError(
        e instanceof ScheduleValidationError
          ? e.message
          : e instanceof Error
          ? e.message
          : "خطایی رخ داد. لطفاً دوباره تلاش کنید."
      );
    } finally {
      generateLockRef.current = false;
      setIsGenerating(false);
    }
  }

  function applyPostDrawSettings() {
    if (!result) return;
    const trimmedMetadata: TournamentMetadata = {
      ...result.metadata,
      title: metadata.title?.trim() || undefined,
      venue: metadata.venue?.trim() || undefined,
      pointsRule,
    };
    setMetadata({
      title: trimmedMetadata.title || "",
      venue: trimmedMetadata.venue || "",
      pointsRule,
    });
    setResult({ ...result, metadata: trimmedMetadata });
    setStep(4);
    setInfoMessage("نام مسابقه، محل برگزاری و سیستم امتیازدهی به‌روزرسانی شد. قرعه‌کشی و برنامه بازی‌ها بدون تغییر باقی ماند.");
    setTimeout(() => setInfoMessage(null), 4000);
  }

  function handleCeremonyComplete() {
    setShowDrawCeremony(false);
    setStep(4);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      setLibraryTeamIds([]);
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
      setCustomWin(3);
      setCustomDraw(1);
      setCustomLoss(0);
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
      setQuotaCharged(false);
      setShowDrawCeremony(false);
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

  function handleOpenShareModal(tournamentId?: string, tournamentTitle?: string) {
    if (!user) {
      openAuthModal("login");
      return;
    }
    if (tournamentId) {
      setShareModalTournamentId(tournamentId);
      setShareModalTournamentTitle(tournamentTitle || "");
    } else {
      setShareModalTournamentId(currentSavedId);
      setShareModalTournamentTitle(
        metadata.title?.trim() ||
        FORMAT_OPTIONS.find((f) => f.key === format)?.title ||
        "مسابقه ورزشی"
      );
    }
    setShareModalOpen(true);
  }

  function handleOpenRegistrationModal() {
    if (!user) {
      openAuthModal("login");
      return;
    }
    setRegistrationModalOpen(true);
  }

  function isFillableTeamSlot(name: string, index: number) {
    const t = String(name || "").trim();
    if (!t) return true;
    if (t === `تیم ${toPersianDigits(index + 1)}`) return true;
    return /^تیم\s*[0-9۰-۹٠-٩]+$/.test(t);
  }

  function insertApprovedRegistrationNames(names: string[]) {
    const unique = names.map((n) => n.trim()).filter(Boolean);
    const next = Array.from({ length: teamCount }, (_, i) => teamNames[i] || "");
    for (const name of unique) {
      if (next.some((n) => n.trim() === name)) continue;
      const idx = next.findIndex((n, i) => isFillableTeamSlot(n, i));
      if (idx < 0) break;
      next[idx] = name;
    }
    setTeamNames(next);
  }

  async function handleEnsureSavedForShare(): Promise<string | null> {
    const currentId = currentSavedId || undefined;
    const title =
      metadata.title?.trim() ||
      FORMAT_OPTIONS.find((f) => f.key === format)?.title ||
      "مسابقات ورزشی";

    const payload = {
      id: currentId,
      title,
      format,
      sport: pointsRule?.sport,
      teamCount,
      state: {
        step: 4,
        format,
        teamCount,
        teamNames,
        libraryTeamIds,
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
    };

    try {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.tournament?.id) {
          setCurrentSavedId(data.tournament.id);
          try {
            const token = encodeTournamentPayload(data.tournament);
            if (token) {
              document.cookie = `nexsport_t_${data.tournament.id}=${token}; path=/; max-age=2592000; SameSite=Lax`;
            }
            localStorage.setItem(`nexsport_t_${data.tournament.id}`, JSON.stringify(data.tournament));
          } catch {}
          return data.tournament.id;
        }
      }
    } catch (err) {
      console.error("[Ensure Saved For Share Error]", err);
    }
    return null;
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
        setTeamCountInput(toPersianDigits(s.teamCount));
      }
      if (Array.isArray(s.teamNames)) setTeamNames(s.teamNames);
      if (Array.isArray(s.libraryTeamIds)) setLibraryTeamIds(s.libraryTeamIds);
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
      if (s.pointsRule) {
        setPointsRule(s.pointsRule);
        if (s.pointsRule.sport === "custom") {
          setCustomWin(s.pointsRule.win ?? 3);
          setCustomDraw(s.pointsRule.draw ?? 1);
          setCustomLoss(s.pointsRule.loss ?? 0);
        }
      }
      if (s.metadata) setMetadata(s.metadata);
      else setMetadata({ title: t.title, venue: "" });
      if (s.result) setResult(s.result);
      if (s.scores) setScores(s.scores);
      if (s.matchDetails) setMatchDetails(s.matchDetails);

      setCurrentSavedId(t.id);
      setQuotaCharged(true);
      setInfoMessage(`مسابقه «${t.title}» با موفقیت بارگذاری شد.`);
      setTimeout(() => setInfoMessage(null), 4000);
    } catch (err) {
      console.error("Error loading tournament:", err);
      alert("خطا در بارگذاری مسابقه.");
    }
  }

  const loadQuery = searchParams.get("load");
  useEffect(() => {
    if (!isLoaded || !user || !loadQuery) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tournaments/${loadQuery}/`, { credentials: "same-origin" });
        const data = await res.json().catch(() => ({}));
        if (cancelled || !res.ok || !data.tournament) return;
        handleLoadCloudTournament(data.tournament);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user, loadQuery]);

  function handleCloudSaveSuccess(t: SavedTournamentItem) {
    setCurrentSavedId(t.id);
    if (!metadata.title) {
      setMetadata((prev) => ({ ...prev, title: t.title }));
    }
    setInfoMessage(`مسابقه «${t.title}» ذخیره شد. تغییرات بعدی به‌صورت خودکار ذخیره می‌شوند.`);
    setTimeout(() => setInfoMessage(null), 4000);
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

  const tournamentCount = FORMAT_OPTIONS.filter((f) => f.category === "tournament").length;
  const leagueCount = FORMAT_OPTIONS.filter((f) => f.category === "league").length;

  const displayedFormats =
    formatCategory === "all"
      ? FORMAT_OPTIONS
      : FORMAT_OPTIONS.filter((f) => f.category === formatCategory);

  return (
    <>
      <header className="sticky top-0 z-50 no-print border-b border-slate-200/80 bg-white/85 backdrop-blur-md shadow-2xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 py-3.5">
          <Link href="/" className="flex items-center gap-2.5 text-pitch hover:opacity-95 transition-opacity shrink-0">
            <div className="relative flex items-center justify-center">
              <NexSportIcon className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 drop-shadow-sm" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900 leading-tight">
                Nex<span className="text-emerald-700">Sport</span>
              </span>
              <span className="text-[10px] text-slate-500 font-semibold tracking-wider">برنامه‌ریز مسابقات</span>
            </div>
          </Link>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleOpenSavedList}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-50/60 px-3 py-1.5 text-xs font-black text-emerald-800 shadow-2xs hover:bg-emerald-600 hover:text-white transition-all cursor-pointer"
              title="مشاهده و بارگذاری مسابقات ذخیره شده من"
            >
              <span>📂</span>
              <span className="hidden sm:inline">مسابقات من</span>
            </button>

            {(step > 0 || result) && (
              <button
                type="button"
                onClick={handleOpenSaveCloud}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/50 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-900 hover:bg-amber-500 hover:text-white transition-all cursor-pointer"
                title="ذخیره مسابقه جاری"
              >
                <span>💾</span>
                <span className="hidden sm:inline">ذخیره</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (!user) {
                  openAuthModal("login");
                  return;
                }
                setStoreModalOpen(true);
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black shadow-2xs transition-all cursor-pointer ${
                user && quota?.isVip
                  ? "border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100"
                  : !user
                  ? (quota?.guestCount ?? 0) >= (quota?.guestLimit ?? 2)
                    ? "border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 animate-pulse"
                    : "border-slate-200 bg-white text-slate-700 hover:border-emerald-500"
                  : isAdmin || quota?.unlimitedPlanning || (quota?.planningCredits ?? 5) > 0
                  ? "border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100/70"
                  : "border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 animate-pulse"
              }`}
              title={!user ? "ورود به حساب کاربری" : isAdmin || quota?.unlimitedPlanning ? "اعتبار نامحدود مدیر" : "افزایش اعتبار / اشتراک ویژه VIP"}
            >
              {user && quota?.isVip ? (
                <>
                  <span>👑</span>
                  <span>عضو VIP</span>
                </>
              ) : user && (isAdmin || quota?.unlimitedPlanning) ? (
                <>
                  <span>💎</span>
                  <span>اعتبار: نامحدود</span>
                </>
              ) : user ? (
                <>
                  <span>💎</span>
                  <span>
                    اعتبار: {toPersianDigits(quota?.planningCredits ?? 5)}
                  </span>
                </>
              ) : (
                <>
                  <span>👤</span>
                  <span>
                    مهمان: {toPersianDigits(quota?.guestCount || 0)}/{toPersianDigits(quota?.guestLimit || 2)}
                  </span>
                </>
              )}
            </button>

            {(step > 0 || result) && (
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-600 hover:text-white transition-colors cursor-pointer"
                title="شروع مسابقه جدید و بازگشت به صفحه اول برنامه‌ریزی"
              >
                <span>🔄</span>
                <span className="hidden sm:inline">مسابقه جدید</span>
              </button>
            )}

            <AuthHeaderNav />
          </div>
        </div>
      </header>

      <main
        className={`mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 transition-all ${
          step === 4
            ? "max-w-[1700px] w-full"
            : step === 0
            ? "max-w-7xl w-full"
            : "max-w-5xl"
        }`}
      >

      {step > 0 && (
        <div className="no-print mb-8 max-w-4xl mx-auto">
          <Stepper labels={STEP_LABELS} current={step} />
        </div>
      )}

      {/* Info notification */}
      {infoMessage && (
        <div className="no-print mb-6 max-w-4xl mx-auto rounded-xl border border-pitch/30 bg-pitch/10 px-4 py-3 text-xs sm:text-sm font-semibold text-pitch animate-fade-in flex items-center gap-2 shadow-xs">
          <span>ℹ️</span>
          <span>{infoMessage}</span>
        </div>
      )}

      {/* STEP 0: FORMAT SELECTION */}
      {step === 0 && (
        <section className="animate-fade-in space-y-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#06281C] via-[#0B3B24] to-[#041F16] text-white px-5 sm:px-8 py-10 sm:py-12 text-center">
            <div className="absolute inset-0 bg-pitch-lines pointer-events-none opacity-40" />
            <div className="absolute top-0 right-1/4 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-10 h-48 w-48 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />
            <div className="relative space-y-3 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-950/60 px-3.5 py-1.5 text-xs font-bold text-emerald-200 shadow-inner backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>گام اول: انتخاب فرمت برگزاری</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight">
              مسابقه‌تان را با فرمت حرفه‌ای شروع کنید
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/80 leading-relaxed">
              هر فرمت از دقیق‌ترین الگوریتم‌های استاندارد بین‌المللی پیروی می‌کند و جدول بازی‌ها بدون هیچ خطایی ایجاد خواهد شد. روی گزینه مورد نظر کلیک کنید:
            </p>

            {/* Filter Tabs */}
            <div className="pt-3 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setFormatCategory("all")}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  formatCategory === "all"
                    ? "bg-amber-400 text-slate-950 shadow-sm"
                    : "bg-white/10 border border-white/20 text-emerald-50 hover:bg-white/20"
                }`}
              >
                همه فرمت‌ها ({toPersianDigits(FORMAT_OPTIONS.length)})
              </button>
              <button
                type="button"
                onClick={() => setFormatCategory("tournament")}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  formatCategory === "tournament"
                    ? "bg-amber-400 text-slate-950 shadow-sm"
                    : "bg-white/10 border border-white/20 text-emerald-50 hover:bg-white/20"
                }`}
              >
                🏆 جام‌ها و مسابقات حذفی ({toPersianDigits(tournamentCount)})
              </button>
              <button
                type="button"
                onClick={() => setFormatCategory("league")}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  formatCategory === "league"
                    ? "bg-amber-400 text-slate-950 shadow-sm"
                    : "bg-white/10 border border-white/20 text-emerald-50 hover:bg-white/20"
                }`}
              >
                ⚽ لیگ و دوره‌ای ({toPersianDigits(leagueCount)})
              </button>
            </div>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid gap-5 grid-cols-1 md:grid-cols-3">
            {displayedFormats.map((opt) => {
              const isSelected = format === opt.key;
              const accentGradient =
                opt.key === "groups-knockout"
                  ? "from-purple-500 to-indigo-600"
                  : opt.key === "knockout"
                  ? "from-rose-500 to-pink-600"
                  : opt.key === "double-knockout"
                  ? "from-teal-500 to-emerald-600"
                  : opt.key === "double-league"
                  ? "from-amber-500 to-amber-600"
                  : opt.key === "groups"
                  ? "from-blue-500 to-cyan-600"
                  : "from-emerald-500 to-teal-600";

              return (
                <div
                  key={opt.key}
                  onClick={() => {
                    setFormat(opt.key);
                    setStep(1);
                  }}
                  className={
                    "group relative flex flex-col justify-between rounded-2xl border bg-white p-6 transition-all duration-300 cursor-pointer text-right hover:-translate-y-1.5 hover:shadow-card-hover overflow-hidden " +
                    (opt.recommended ? "pt-9 " : "pt-7 ") +
                    (isSelected
                      ? "border-emerald-600 ring-2 ring-emerald-500/30 bg-emerald-50/15 shadow-md"
                      : opt.recommended
                      ? "border-amber-400 ring-1 ring-amber-400/30 shadow-card hover:border-amber-500"
                      : "border-slate-200/90 shadow-card hover:border-emerald-500/60")
                  }
                >
                  {/* Top colored accent stripe */}
                  <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${accentGradient}`} />

                  {opt.recommended && (
                    <div className="absolute top-2.5 right-6 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-0.5 text-[11px] font-black text-slate-950 shadow-xs flex items-center gap-1">
                      <span>⭐</span>
                      <span>فرمت پیشنهادی تورنمنت‌ها</span>
                    </div>
                  )}

                  <div className="flex-1 flex flex-col">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-3 mb-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl group-hover:scale-105 transition-transform shrink-0 shadow-2xs border border-slate-200/80">
                          {opt.icon}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg font-black text-slate-900 group-hover:text-pitch transition-colors leading-snug">
                            {opt.title}
                          </h3>
                          <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                            {opt.subtitle}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0 whitespace-nowrap ${opt.badgeBg} ${opt.badgeBorder} ${opt.badgeText}`}
                      >
                        {opt.tag}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-600 leading-6 mb-4">
                      {opt.desc}
                    </p>

                    {/* Ideal For Box */}
                    <div className="mb-4 rounded-xl bg-slate-50 border border-slate-200/70 p-2.5 text-[11px] text-slate-700 flex items-start gap-2">
                      <span className="text-emerald-700 font-bold shrink-0 mt-0.5">📍</span>
                      <div className="leading-5">
                        <strong className="text-slate-900 font-bold">مناسب برای:</strong> {opt.idealFor}
                      </div>
                    </div>

                    {/* Features List */}
                    <ul className="space-y-2 mb-6 border-t border-slate-100 pt-3">
                      {opt.features.map((feat, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-xs text-slate-700">
                          <span className="text-emerald-700 font-bold text-xs shrink-0">✓</span>
                          <span className="text-[11px] sm:text-xs leading-5">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action Button */}
                  <div className="pt-2 border-t border-slate-100 mt-auto">
                    <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-800 group-hover:bg-pitch group-hover:text-white group-hover:border-pitch transition-all shadow-2xs">
                      <span>انتخاب این فرمت و ادامه</span>
                      <span className="text-amber-500 group-hover:text-amber-300 group-hover:-translate-x-1 transition-transform">←</span>
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
                <span>⚡ شروع سریع و آسان</span>
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
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900">تعداد تیم‌های مسابقه</h1>
              {format && (
                <span className="rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-200/80 shadow-2xs">
                  فرمت انتخابی: {FORMAT_OPTIONS.find((f) => f.key === format)?.title}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              می‌توانید عدد دلخواه خود را مستقیماً در کادر تایپ کنید، از دکمه‌های بزرگ + و − استفاده کنید، یا با یک کلیک از دکمه‌های آماده زیر انتخاب فرمایید:
            </p>
          </div>

          {/* Stepper Controls & Direct Input */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-card space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div>
                <span className="text-xs sm:text-sm font-black text-slate-800 block mb-1">
                  تعداد تیم‌های حاضر در مسابقات:
                </span>
                <span className="text-xs text-slate-500">
                  حداقل ۲ و حداکثر ۱۲۸ تیم مجاز است (می‌توانید مستقیماً عدد بنویسید).
                </span>
              </div>

              {/* Big Touch-Friendly Input & Controls */}
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => handleTeamCountChange(teamCount - 1)}
                  disabled={teamCount <= 2}
                  className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border-2 border-slate-200 bg-slate-50 text-2xl font-black text-slate-800 hover:border-emerald-500 hover:bg-emerald-50/50 hover:text-emerald-700 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
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
                    className="h-12 w-28 sm:h-14 sm:w-36 rounded-2xl border-2 border-emerald-500 bg-emerald-50/20 text-center text-2xl sm:text-3xl font-black text-emerald-950 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 shadow-inner transition-all"
                    placeholder="مثلاً ۳۲"
                  />
                  <span className="absolute -bottom-5 left-0 right-0 text-center text-[10px] text-slate-400 font-bold select-none">
                    تایپ مستقیم عددی
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleTeamCountChange(teamCount + 1)}
                  disabled={teamCount >= 128}
                  className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border-2 border-slate-200 bg-slate-50 text-2xl font-black text-slate-800 hover:border-emerald-500 hover:bg-emerald-50/50 hover:text-emerald-700 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
                  title="افزایش یک تیم"
                  aria-label="افزایش یک تیم"
                >
                  +
                </button>

                <span className="text-base sm:text-lg font-bold text-slate-700 mr-1">تیم</span>
              </div>
            </div>

            {/* Quick Selection Presets */}
            <div className="border-t border-slate-100 pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="text-amber-500">⚡</span>
                  <span>انتخاب سریع و فوری تعداد تیم‌های رایج (بدون نیاز به کلیک‌های متوالی):</span>
                </span>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
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
                          ? "border-emerald-500 bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-glow scale-[1.02] ring-2 ring-emerald-400/40"
                          : "border-slate-200/90 bg-slate-50/70 hover:border-emerald-500/50 hover:bg-white text-slate-800 hover:shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-sm font-black">{p.label}</span>
                        {isCurrent && (
                          <span className="text-xs font-bold text-amber-300">✓ انتخاب شد</span>
                        )}
                      </div>
                      <span className={`text-[10px] mt-0.5 ${isCurrent ? "text-emerald-100" : "text-slate-500"}`}>
                        {p.note}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Contextual Tournament Overview Box */}
          <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-50/70 to-teal-50/50 p-4 sm:p-5 text-xs text-slate-700 space-y-2 shadow-2xs">
            <div className="font-black text-emerald-800 flex items-center gap-2">
              <span className="text-base">📋</span>
              <span className="text-sm font-black">ساختار مسابقات شما با {toPersianDigits(teamCount)} تیم:</span>
            </div>
            {format === "groups-knockout" && (
              <p className="leading-6 pr-6 text-slate-700">
                با <strong>{toPersianDigits(teamCount)} تیم</strong>، مسابقات در <strong>{toPersianDigits(numGroups)} گروه</strong> ({formatGroupDistribution(teamCount, numGroups)}) آغاز می‌شود و سپس تیم‌های اول و دوم وارد جدول حذفی خواهند شد.
              </p>
            )}
            {format === "knockout" && (
              <p className="leading-6 pr-6 text-slate-700">
                {Math.log2(teamCount) % 1 === 0 ? (
                  <>تعداد {toPersianDigits(teamCount)} تیم دقیقاً توان ۲ است؛ بنابراین مسابقات بدون استراحت و در <strong>{toPersianDigits(Math.log2(teamCount))} مرحله کامل</strong> برگزار خواهد شد.</>
                ) : (
                  <>
                    با توجه به اینکه {toPersianDigits(teamCount)} توان ۲ نیست، جدول براکت {toPersianDigits(Math.pow(2, Math.ceil(Math.log2(teamCount))))} تیمی تشکیل شده و به <strong>{toPersianDigits(Math.pow(2, Math.ceil(Math.log2(teamCount))) - teamCount)} تیم برتر</strong> استراحت مستقیم دور اول (Bye) داده می‌شود.
                  </>
                )}
              </p>
            )}
            {format === "double-knockout" && (
              <p className="leading-6 pr-6 text-slate-700">
                در فرمت دو حذفی با <strong>{toPersianDigits(teamCount)} تیم</strong>، مسابقات در دو جدول موازی «برندگان» و «شانس مجدد / بازندگان» برگزار می‌شود. هیچ تیمی با اولین شکست حذف نمی‌شود و با دو باخت از گردونه رقابت‌ها کنار می‌رود. قهرمانان دو جدول در فینال بزرگ به مصاف یکدیگر خواهند رفت.
              </p>
            )}
            {format === "league" && (
              <p className="leading-6 pr-6 text-slate-700">
                هر تیم با تمام {toPersianDigits(teamCount - 1)} رقیب خود یک مسابقه می‌دهد؛ مجموعاً <strong>{toPersianDigits(teamCount % 2 === 0 ? teamCount - 1 : teamCount)} هفته مسابقاتی</strong> و <strong>{toPersianDigits((teamCount * (teamCount - 1)) / 2)} بازی عادلانه</strong> بدون مسابقه تکراری برگزار می‌شود.
              </p>
            )}
            {format === "double-league" && (
              <p className="leading-6 pr-6 text-slate-700">
                هر دو تیم یک‌بار در زمین خود و یک‌بار در زمین حریف بازی می‌کنند؛ مجموعاً <strong>{toPersianDigits(2 * (teamCount % 2 === 0 ? teamCount - 1 : teamCount))} هفته مسابقاتی</strong> و <strong>{toPersianDigits(teamCount * (teamCount - 1))} بازی رفت‌وبرگشت</strong> برگزار خواهد شد.
              </p>
            )}
            {format === "groups" && (
              <p className="leading-6 pr-6 text-slate-700">
                تیم‌ها به <strong>{toPersianDigits(numGroups)} گروه</strong> ({formatGroupDistribution(teamCount, numGroups)}) تقسیم شده و درون هر گروه جدول امتیازات اختصاصی محاسبه می‌شود.
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
        <section className="animate-fade-in space-y-6">
          {/* Hidden Excel File Input */}
          <input
            type="file"
            ref={excelInputRef}
            accept=".xlsx, .xls, .csv"
            onChange={handleExcelUpload}
            className="hidden"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900">نام تیم‌ها</h1>
                <span className="rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-black text-emerald-800 border border-emerald-200/80 shadow-2xs">
                  ظرفیت: {toPersianDigits(teamCount)} تیم
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                نام‌ها باید یکتا باشند؛ می‌توانید تایپ کنید، از تیم‌های ذخیره‌شده انتخاب کنید، از لینک ثبت‌نام تأیید کنید، از فایل اکسل بخوانید یا پیست کنید.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleOpenRegistrationModal}
                className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/40 bg-violet-50 px-3.5 py-2 text-xs font-black text-violet-900 hover:bg-violet-100 transition-colors shadow-2xs cursor-pointer"
              >
                <span>📝 لینک ثبت‌نام</span>
              </button>
              <SavedTeamsPicker
                teamCount={teamCount}
                currentNames={teamNames}
                currentIds={libraryTeamIds}
                onApply={(names, ids) => {
                  setTeamNames(names);
                  setLibraryTeamIds(ids);
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setShowBulkModal(true);
                  excelInputRef.current?.click();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-50 px-3.5 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer"
                title="بارگذاری اسامی آماده از فایل اکسل (.xlsx یا .csv)"
              >
                <span>📊 بارگذاری از اکسل</span>
              </button>
              <button
                type="button"
                onClick={() => setShowBulkModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:border-emerald-500 hover:text-emerald-700 transition-colors shadow-2xs cursor-pointer"
              >
                <span>📋 ورود متنی / چسباندن</span>
              </button>
            </div>
          </div>

          {/* Bulk Paste Modal / Drawer */}
          {showBulkModal && (
            <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-white to-emerald-50/20 p-5 sm:p-6 shadow-card animate-fade-in space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <h3 className="font-black text-sm text-emerald-950 flex items-center gap-2">
                  <span>📥</span>
                  <span>ورود سریع اسامی تیم‌ها (فایل اکسل یا متن)</span>
                </h3>
                <span className="rounded-full bg-emerald-50 px-3 py-0.5 text-xs font-black text-emerald-800 border border-emerald-200/80">
                  🎯 ظرفیت مسابقه: {toPersianDigits(teamCount)} تیم
                </span>
              </div>

              {/* Excel notice & upload button & Header checkbox */}
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-4 text-xs text-emerald-950 space-y-3 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-2 max-w-md">
                    <span className="text-base mt-0.5">📊</span>
                    <div className="leading-5">
                      <span className="font-black text-emerald-900">
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
                      className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white font-black px-3.5 py-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      📁 بارگذاری فایل اکسل (.xlsx)
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadExcelTemplate}
                      className="text-xs text-emerald-800 underline hover:text-emerald-950 font-bold"
                    >
                      دانلود قالب نمونه
                    </button>
                  </div>
                </div>

                {/* Checkbox: Does Excel have a header row? */}
                <div className="pt-2 border-t border-emerald-200/70 flex flex-wrap items-center justify-between gap-2">
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
                  <span className="rounded-full bg-emerald-200/60 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900">
                    {excelHasHeader
                      ? "✓ ردیف اول عنوان است و نادیده گرفته می‌شود (پیش‌فرض)"
                      : "⚠️ ردیف اول نیز به عنوان نام تیم خوانده می‌شود"}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  یا اسامی را در کادر زیر پیست / تایپ کنید (هر تیم در یک سطر):
                </label>
                <textarea
                  rows={5}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={"پرسپولیس\nاستقلال\nسپاهان\nتراکتور"}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none shadow-inner"
                />
              </div>

              {bulkText.trim().length > 0 && (
                <div className="text-xs font-bold">
                  {bulkText.split(/[\n,]+/).map((s) => s.trim()).filter((s) => s.length > 0)
                    .length < teamCount && (
                    <span className="text-amber-700">
                      ℹ️{" "}
                      {
                        bulkText
                          .split(/[\n,]+/)
                          .map((s) => s.trim())
                          .filter((s) => s.length > 0).length
                      }{" "}
                      تیم شناسایی شد. چون کمتر از {toPersianDigits(teamCount)} تیم است، بقیه خانه‌ها با نام
                      پیش‌فرض باقی خواهند ماند.
                    </span>
                  )}
                  {bulkText.split(/[\n,]+/).map((s) => s.trim()).filter((s) => s.length > 0)
                    .length > teamCount && (
                    <span className="text-rose-600">
                      ⚠️{" "}
                      {
                        bulkText
                          .split(/[\n,]+/)
                          .map((s) => s.trim())
                          .filter((s) => s.length > 0).length
                      }{" "}
                      تیم شناسایی شد. چون بیشتر از ظرفیت است، تنها {toPersianDigits(teamCount)} تیم اول وارد لیست
                      خواهند شد.
                    </span>
                  )}
                  {bulkText.split(/[\n,]+/).map((s) => s.trim()).filter((s) => s.length > 0)
                    .length === teamCount && (
                    <span className="text-emerald-700">
                      ✓ {toPersianDigits(teamCount)} تیم شناسایی شد (دقیقاً برابر با ظرفیت انتخابی مسابقه).
                    </span>
                  )}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-500 font-bold">درج خودکار نمونه‌ها در کادر:</span>
                  <button
                    type="button"
                    onClick={() => setBulkText(PRESET_IRAN_LEAGUE.join("\n"))}
                    className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1 hover:border-emerald-500 hover:text-emerald-700 text-slate-700 font-bold transition-colors cursor-pointer"
                    title="درج ۱۶ تیم لیگ برتر در کادر بالا"
                  >
                    🇮🇷 لیگ برتر ایران
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkText(PRESET_EUROPE.join("\n"))}
                    className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1 hover:border-emerald-500 hover:text-emerald-700 text-slate-700 font-bold transition-colors cursor-pointer"
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
                    ثبت در جدول ({toPersianDigits(teamCount)} تیم)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Preset Fill Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-black text-slate-800">تکمیل سریع اسامی:</span>
              <button
                type="button"
                onClick={() => {
                  if (!confirmReplaceTeamNames("لیگ برتر ایران")) return;
                  const sample = PRESET_IRAN_LEAGUE.slice(0, teamCount);
                  const next = [...sample];
                  while (next.length < teamCount) next.push(`تیم ${toPersianDigits(next.length + 1)}`);
                  setTeamNames(next);
                  setLibraryTeamIds([]);
                }}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:border-emerald-500 hover:text-emerald-700 transition-colors cursor-pointer"
              >
                🇮🇷 لیگ برتر ایران
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!confirmReplaceTeamNames("باشگاه‌های اروپا")) return;
                  const sample = PRESET_EUROPE.slice(0, teamCount);
                  const next = [...sample];
                  while (next.length < teamCount) next.push(`تیم ${toPersianDigits(next.length + 1)}`);
                  setTeamNames(next);
                  setLibraryTeamIds([]);
                }}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:border-emerald-500 hover:text-emerald-700 transition-colors cursor-pointer"
              >
                ⚽ باشگاه‌های اروپا
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setTeamNames(Array.from({ length: teamCount }).map(() => ""));
                  setLibraryTeamIds([]);
                }}
                className="text-rose-600 hover:underline font-black cursor-pointer"
              >
                پاک‌سازی همه
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                const ok = window.confirm(
                  "همه نام‌های واردشده به «تیم ۱، تیم ۲، …» برمی‌گردد و اتصال تیم‌های ذخیره‌شده پاک می‌شود. این کار قابل بازگشت نیست. ادامه می‌دهید؟"
                );
                if (!ok) return;
                setTeamNames(Array.from({ length: teamCount }).map((_, i) => `تیم ${toPersianDigits(i + 1)}`));
                setLibraryTeamIds([]);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-500 hover:border-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
              title="بازنشانی اسامی"
            >
              بازنشانی
            </button>
          </div>

          {/* Modern Athletic Team Input Grid */}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: teamCount }).map((_, i) => {
              const name = teamNames[i] ?? "";
              const pot = getTeamPot(name);
              return (
                <div
                  key={i}
                  className="group relative flex items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-2xs transition-all hover:border-emerald-400/80 hover:shadow-xs focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-700 group-hover:bg-emerald-50 group-hover:text-emerald-800 transition-colors">
                    {toPersianDigits(i + 1)}
                  </div>
                  <input
                    value={name}
                    onChange={(e) => {
                      const next = [...teamNames];
                      next[i] = e.target.value;
                      setTeamNames(next);
                      setLibraryTeamIds((prev) => {
                        const ids = [...prev];
                        while (ids.length < teamCount) ids.push(null);
                        ids[i] = null;
                        return ids;
                      });
                    }}
                    className="w-full bg-transparent text-sm font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none"
                    placeholder={`تیم ${toPersianDigits(i + 1)}`}
                  />
                  {pot && (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                      سید {toPersianDigits(pot)}
                    </span>
                  )}
                  {name && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => {
                        const next = [...teamNames];
                        next[i] = "";
                        setTeamNames(next);
                        setLibraryTeamIds((prev) => {
                          const ids = [...prev];
                          while (ids.length < teamCount) ids.push(null);
                          ids[i] = null;
                          return ids;
                        });
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-rose-600 text-slate-400 p-1 text-xs transition-opacity cursor-pointer"
                      title="پاک کردن نام تیم"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
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
        <section className="animate-fade-in space-y-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">
              {scheduleAlreadyDrawn ? "تنظیمات مسابقه" : "تنظیمات و قوانین مسابقه"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              {scheduleAlreadyDrawn
                ? "پس از تولید برنامه، فقط نام مسابقه، محل برگزاری و سیستم امتیازدهی قابل تغییر است. قرعه‌کشی و جدول بازی‌ها بدون تغییر می‌ماند."
                : "این بخش کاملاً اختیاری است؛ در صورت عدم انتخاب، همه‌چیز استاندارد و عادلانه اجرا می‌شود."}
            </p>
          </div>

          {/* Tournament Title & Venue Info */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-card space-y-4">
            <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
              <span className="text-base text-amber-500">🏆</span>
              <span>اطلاعات تورنمنت (جهت سربرگ رسمی و چاپ)</span>
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold text-slate-700">نام مسابقه یا جام</span>
                <input
                  type="text"
                  value={metadata.title ?? ""}
                  onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                  placeholder="مثال: مسابقات جام رمضان یا لیگ فوتسال"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-inner"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-700">محل برگزاری / سالن / زمین</span>
                <input
                  type="text"
                  value={metadata.venue ?? ""}
                  onChange={(e) => setMetadata({ ...metadata, venue: e.target.value })}
                  placeholder="مثال: سالن ورزشی چمران - زمین شماره ۱"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-inner"
                />
              </label>
            </div>
          </div>

          {/* Points System Selector */}
          {(format === "league" ||
            format === "double-league" ||
            format === "groups" ||
            format === "groups-knockout") && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-card space-y-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <span className="text-base">📊</span>
                  <span>سیستم امتیازدهی جدول رده‌بندی</span>
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  نحوه محاسبه امتیازات را متناسب با رشته ورزشی مسابقات خود انتخاب فرمایید:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {[
                  {
                    id: "football",
                    title: "⚽ فوتبال و فوتسال (FIFA)",
                    desc: "برد: ۳ امتیاز | مساوی: ۱ | باخت: ۰",
                    badge: "۳-۱-۰",
                    rule: { sport: "football" as const, win: 3, draw: 1, loss: 0, name: "فوتبال و فوتسال (۳-۱-۰)" },
                  },
                  {
                    id: "volleyball",
                    title: "🏐 والیبال (قوانین رسمی FIVB)",
                    desc: "۳-۰/۳-۱ (۳ پوئن) | ۳-۲ (۲ برنده، ۱ بازنده) | اولویت اول: بردها",
                    badge: "FIVB",
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
                    badge: "۲-۱",
                    rule: { sport: "basketball" as const, win: 2, draw: 0, loss: 1, name: "بسکتبال FIBA (۲-۱)" },
                  },
                  {
                    id: "handball",
                    title: "🤾 هندبال (IHF)",
                    desc: "برد: ۲ امتیاز | مساوی: ۱ | باخت: ۰",
                    badge: "۲-۱-۰",
                    rule: { sport: "handball" as const, win: 2, draw: 1, loss: 0, name: "هندبال IHF (۲-۱-۰)" },
                  },
                  {
                    id: "beach-soccer",
                    title: "🏖️ فوتبال ساحلی (FIFA)",
                    desc: "برد قانونی: ۳ | وقت اضافه: ۲ | پنالتی: ۱ | باخت: ۰",
                    badge: "۳-۲-۱-۰",
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
                    id: "custom",
                    title: "⚙️ سفارشی‌سازی دلخواه",
                    desc: `برد: ${toPersianDigits(customWin)} | مساوی: ${toPersianDigits(customDraw)} | باخت: ${toPersianDigits(customLoss)}`,
                    badge: "سفارشی",
                    rule: {
                      sport: "custom" as const,
                      win: customWin,
                      draw: customDraw,
                      loss: customLoss,
                      name: `سفارشی (${toPersianDigits(customWin)}-${toPersianDigits(customDraw)}-${toPersianDigits(customLoss)})`,
                    },
                  },
                ].map((pts) => {
                  const isSelected = pts.id === "custom"
                    ? pointsRule.sport === "custom"
                    : pointsRule.name === pts.rule.name;
                  return (
                    <button
                      key={pts.id}
                      type="button"
                      onClick={() => {
                        if (pts.id === "custom") {
                          handleUpdateCustomPoints(customWin, customDraw, customLoss);
                        } else {
                          setPointsRule(pts.rule);
                        }
                      }}
                      className={`flex flex-col text-right p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50/40 shadow-sm ring-2 ring-emerald-500/20"
                          : "border-slate-200/90 bg-slate-50/60 hover:border-slate-300 hover:bg-white text-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className={`text-xs font-black ${isSelected ? "text-emerald-950" : "text-slate-800"}`}>
                          {pts.title}
                        </span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          isSelected ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
                        }`}>
                          {pts.badge}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-600 leading-relaxed">
                        {pts.desc}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Scoring Configuration Panel */}
              {pointsRule.sport === "custom" && (
                <div className="rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/40 p-4 sm:p-5 space-y-4 shadow-sm animate-fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">⚙️</span>
                      <div>
                        <h4 className="text-sm font-black text-emerald-950">
                          تنظیم دستی و اختصاصی امتیازات مسابقه
                        </h4>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          امتیاز مورد نظر خود را برای برد، مساوی و باخت وارد کنید؛ جدول رده‌بندی بر همین مبنا به صورت خودکار محاسبه خواهد شد:
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-600 text-white px-3 py-1 text-xs font-black shadow-2xs">
                      سیستم: {toPersianDigits(customWin)} - {toPersianDigits(customDraw)} - {toPersianDigits(customLoss)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {/* Win Points */}
                    <div className="bg-white rounded-xl border border-emerald-200/90 p-3.5 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                          <span>🟢</span>
                          <span>امتیاز برد (پیروزی):</span>
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateCustomPoints(Math.max(0, customWin - 1), customDraw, customLoss)}
                          className="h-10 w-10 rounded-xl bg-slate-100 hover:bg-emerald-100 text-slate-800 font-black text-lg flex items-center justify-center transition-colors cursor-pointer border border-slate-200"
                          title="کاهش امتیاز برد"
                        >
                          −
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={toPersianDigits(customWin)}
                          onChange={(e) => {
                            const eng = toEnglishDigits(e.target.value).replace(/[^0-9]/g, "");
                            const val = eng === "" ? 0 : Math.max(0, parseInt(eng, 10));
                            handleUpdateCustomPoints(val, customDraw, customLoss);
                          }}
                          className="flex-1 h-10 rounded-xl border-2 border-emerald-500/70 bg-emerald-50/20 text-center font-black text-xl text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateCustomPoints(customWin + 1, customDraw, customLoss)}
                          className="h-10 w-10 rounded-xl bg-slate-100 hover:bg-emerald-100 text-slate-800 font-black text-lg flex items-center justify-center transition-colors cursor-pointer border border-slate-200"
                          title="افزایش امتیاز برد"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-500 block text-center font-medium">
                        امتیاز اختصاصی به تیم برنده در مسابقه
                      </span>
                    </div>

                    {/* Draw Points */}
                    <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                          <span>⚪</span>
                          <span>امتیاز مساوی (تساوی):</span>
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateCustomPoints(customWin, Math.max(0, customDraw - 1), customLoss)}
                          className="h-10 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-lg flex items-center justify-center transition-colors cursor-pointer border border-slate-200"
                          title="کاهش امتیاز مساوی"
                        >
                          −
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={toPersianDigits(customDraw)}
                          onChange={(e) => {
                            const eng = toEnglishDigits(e.target.value).replace(/[^0-9]/g, "");
                            const val = eng === "" ? 0 : Math.max(0, parseInt(eng, 10));
                            handleUpdateCustomPoints(customWin, val, customLoss);
                          }}
                          className="flex-1 h-10 rounded-xl border-2 border-slate-300 bg-slate-50/50 text-center font-black text-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateCustomPoints(customWin, customDraw + 1, customLoss)}
                          className="h-10 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-lg flex items-center justify-center transition-colors cursor-pointer border border-slate-200"
                          title="افزایش امتیاز مساوی"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-500 block text-center font-medium">
                        امتیاز کسب‌شده توسط هر دو تیم در تساوی
                      </span>
                    </div>

                    {/* Loss Points */}
                    <div className="bg-white rounded-xl border border-rose-200/90 p-3.5 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-rose-900 flex items-center gap-1.5">
                          <span>🔴</span>
                          <span>امتیاز باخت (شکست):</span>
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateCustomPoints(customWin, customDraw, Math.max(0, customLoss - 1))}
                          className="h-10 w-10 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-800 font-black text-lg flex items-center justify-center transition-colors cursor-pointer border border-slate-200"
                          title="کاهش امتیاز باخت"
                        >
                          −
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={toPersianDigits(customLoss)}
                          onChange={(e) => {
                            const eng = toEnglishDigits(e.target.value).replace(/[^0-9]/g, "");
                            const val = eng === "" ? 0 : Math.max(0, parseInt(eng, 10));
                            handleUpdateCustomPoints(customWin, customDraw, val);
                          }}
                          className="flex-1 h-10 rounded-xl border-2 border-rose-400/60 bg-rose-50/20 text-center font-black text-xl text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-400/30"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateCustomPoints(customWin, customDraw, customLoss + 1)}
                          className="h-10 w-10 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-800 font-black text-lg flex items-center justify-center transition-colors cursor-pointer border border-slate-200"
                          title="افزایش امتیاز باخت"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-500 block text-center font-medium">
                        امتیاز تیم بازنده مسابقه (معمولاً ۰)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sport-specific rule details */}
              {pointsRule.sport === "volleyball" && (
                <div className="rounded-xl bg-amber-50/90 border border-amber-200/90 p-4 text-xs text-amber-950 space-y-1.5 shadow-2xs">
                  <div className="font-black flex items-center gap-1.5 text-amber-900">
                    <span className="text-base">🏐</span>
                    <span>نحوه محاسبه خودکار امتیازات و رده‌بندی والیبال بر اساس قوانین رسمی فدراسیون جهانی (FIVB):</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-900/90 pr-2 leading-relaxed">
                    <li><b>برد ۳-۰ یا ۳-۱:</b> تیم برنده ۳ امتیاز کامل کسب می‌کند و بازنده ۰ امتیاز.</li>
                    <li><b>برد ۳-۲ (ست پنجم سرنوشت‌ساز):</b> برنده ۲ امتیاز و بازنده به پاداش مقاومت تا ست پنجم ۱ امتیاز می‌گیرد.</li>
                    <li><b>قانون طلایی جدول رده‌بندی:</b> اولویت اول رتبه‌بندی در FIVB <b>«تعداد بردها»</b> است و در صورت برابری تعداد برد، امتیاز مسابقات و تفاضل ست محاسبه می‌شود.</li>
                  </ul>
                </div>
              )}

              {pointsRule.sport === "basketball" && (
                <div className="rounded-xl bg-sky-50/90 border border-sky-200/90 p-4 text-xs text-sky-950 space-y-1.5 shadow-2xs">
                  <div className="font-black flex items-center gap-1.5 text-sky-900">
                    <span className="text-base">🏀</span>
                    <span>قوانین امتیازدهی بسکتبال (FIBA):</span>
                  </div>
                  <p className="text-[11px] text-sky-900/90 pr-2 leading-relaxed">
                    تیم برنده ۲ امتیاز و بازنده ۱ امتیاز دریافت می‌کند (تساوی وجود ندارد و بازی تا تعیین برنده در وقت‌های اضافه ۵ دقیقه‌ای ادامه می‌یابد). در صورت عدم حضور در زمین (باخت انضباطی)، ۰ امتیاز ثبت می‌شود.
                  </p>
                </div>
              )}

              {pointsRule.sport === "handball" && (
                <div className="rounded-xl bg-indigo-50/90 border border-indigo-200/90 p-4 text-xs text-indigo-950 space-y-1.5 shadow-2xs">
                  <div className="font-black flex items-center gap-1.5 text-indigo-900">
                    <span className="text-base">🤾</span>
                    <span>قوانین امتیازدهی هندبال (IHF):</span>
                  </div>
                  <p className="text-[11px] text-indigo-900/90 pr-2 leading-relaxed">
                    در مسابقات لیگ، برد دارای ۲ امتیاز، تساوی ۱ امتیاز و باخت ۰ امتیاز است. در مراحل حذفی بازی با وقت‌های اضافه و پنالتی ادامه می‌یابد.
                  </p>
                </div>
              )}

              {pointsRule.sport === "beach-soccer" && (
                <div className="rounded-xl bg-amber-50/90 border border-amber-200/90 p-4 text-xs text-amber-950 space-y-1.5 shadow-2xs">
                  <div className="font-black flex items-center gap-1.5 text-amber-900">
                    <span className="text-base">🏖️</span>
                    <span>قوانین امتیازدهی فوتبال ساحلی (تساوی وجود ندارد):</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-900/90 pr-2 leading-relaxed">
                    <li><b>برد در وقت قانونی (۳۶ دقیقه):</b> ۳ امتیاز برای برنده | ۰ امتیاز برای بازنده</li>
                    <li><b>برد در وقت اضافه (۳ دقیقه):</b> ۲ امتیاز برای برنده | ۰ امتیاز برای بازنده</li>
                    <li><b>برد در ضربات پنالتی:</b> ۱ امتیاز برای برنده | ۰ امتیاز برای بازنده</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Group Rules */}
          {!scheduleAlreadyDrawn && needsGroupRules && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-card space-y-5">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <span className="text-base text-emerald-600">⚽</span>
                <span>تنظیمات گروه‌بندی مسابقات</span>
              </h3>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="block">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-700">تعداد گروه‌ها</span>
                    <button
                      type="button"
                      onClick={() => setNumGroups(calculateDefaultNumGroups(teamCount))}
                      className="text-[11px] text-emerald-700 hover:underline font-bold cursor-pointer"
                      title="تنظیم خودکار بر اساس حداکثر ۴ تیم در هر گروه"
                    >
                      پیش‌فرض ({toPersianDigits(calculateDefaultNumGroups(teamCount))} گروه)
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-inner"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                    {teamCount % Math.max(1, numGroups) === 0 ? (
                      <>
                        با {toPersianDigits(teamCount)} تیم در {toPersianDigits(numGroups)} گروه، هر گروه شامل{" "}
                        <strong className="text-emerald-700">{toPersianDigits(Math.floor(teamCount / Math.max(1, numGroups)))} تیم</strong> خواهد بود.
                      </>
                    ) : (
                      <>
                        با {toPersianDigits(teamCount)} تیم در {toPersianDigits(numGroups)} گروه،{" "}
                        <strong className="text-emerald-700">{formatGroupDistribution(teamCount, numGroups)}</strong> تشکیل خواهد شد.
                      </>
                    )}
                  </p>
                </div>
                {format === "groups-knockout" && (
                  <label className="block">
                    <span className="text-xs font-bold text-slate-700 mb-1.5 block">
                      تعداد صعودکننده مستقیم از هر گروه
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={qualifiersPerGroup}
                      onChange={(e) =>
                        setQualifiersPerGroup(Math.max(1, Number(e.target.value) || 1))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-inner"
                    />
                    <span className="text-[11px] text-slate-500 mt-1.5 block font-medium">
                      استاندارد بین‌المللی: ۲ تیم برتر از هر گروه
                    </span>
                  </label>
                )}
              </div>

              {/* Notice & Guidelines on Power-of-2 and Euro-style 3rd Place Qualifiers */}
              {format === "groups-knockout" && (
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <span className="text-base mt-0.5">📌</span>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-black text-slate-900">
                        قانون استاندارد تقارن مرحله حذفی (توان عدد ۲):
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        تعداد تیم‌های راه‌یافته به مرحله حذفی باید توان عدد ۲ (۴، ۸، ۱۶، ۳۲ تیم) باشد تا جدول بدون استراحت‌های نابرابر و با عدالت کامل برگزار شود.
                      </p>
                    </div>
                  </div>

                  {/* Dynamic Status Display */}
                  {isPowerOfTwo ? (
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-950 font-medium">
                      <span className="font-black text-emerald-800">✅ ساختار ایده‌آل:</span>
                      <span>
                        با {toPersianDigits(numGroups)} گروه و صعود {toPersianDigits(qualifiersPerGroup)} تیم، مجموعاً <strong>{toPersianDigits(baseQualifiers)} تیم</strong> به مرحله <strong>{toPersianDigits(targetBracketSize)} تیمی</strong> صعود می‌کنند و جدول حذفی کاملاً متقارن است.
                      </span>
                    </div>
                  ) : canUseBestThirds ? (
                    <div className="rounded-xl bg-amber-50/90 border border-amber-200/90 p-4 space-y-2 text-xs text-amber-950">
                      <div className="flex items-center justify-between font-black">
                        <div className="flex items-center gap-1.5 text-amber-900">
                          <span>🏆</span>
                          <span>فرمت استاندارد جام ملت‌های اروپا (UEFA Euro / جام جهانی ۲۰۲۶)</span>
                        </div>
                        <span className="text-[10px] bg-amber-200 text-amber-900 px-2.5 py-0.5 rounded-full font-black">
                          بدون استراحت (BYE)
                        </span>
                      </div>
                      <p className="leading-relaxed text-amber-950/90">
                        با صعود ۲ تیم اول هر گروه، مجموعاً <strong>{toPersianDigits(baseQualifiers)} تیم</strong> صعود می‌کنند که توان ۲ نیست. برای تشکیل جدول استاندارد <strong>{toPersianDigits(targetBracketSize)} تیمی</strong>، دقیقاً <strong>{toPersianDigits(missingForPowerOfTwo)} تیم</strong> کم است. سیستم هوشمند NexSport مشابه مسابقات یورو، این {toPersianDigits(missingForPowerOfTwo)} تیم را از میان <strong>برترین تیم‌های رتبه سوم گروه‌ها</strong> تکمیل می‌کند تا مرحله حذفی بدون استراحت و با نهایت هیجان برگزار شود.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-slate-100 border border-slate-200 p-3 text-xs text-slate-700 leading-relaxed">
                      <span className="font-black text-slate-900">ℹ️ وضعیت جدول حذفی:</span> با صعود {toPersianDigits(baseQualifiers)} تیم، مرحله حذفی {toPersianDigits(targetBracketSize)} تیمی تشکیل می‌شود و {toPersianDigits(missingForPowerOfTwo)} جایگاه استراحت (BYE) به سرگروه‌های برتر تعلق می‌گیرد.
                    </div>
                  )}

                  {/* Smart Preset Buttons */}
                  {teamCount === 24 && (
                    <div className="pt-2 border-t border-slate-200/80">
                      <span className="text-[11px] font-black text-slate-700 block mb-2">
                        چیدمان‌های استاندارد و متداول برای مسابقات ۲۴ تیمی:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setNumGroups(6);
                            setQualifiersPerGroup(2);
                          }}
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-all cursor-pointer ${
                            numGroups === 6 && qualifiersPerGroup === 2
                              ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                              : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
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
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-all cursor-pointer ${
                            numGroups === 4 && qualifiersPerGroup === 2
                              ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                              : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
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
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-all cursor-pointer ${
                            numGroups === 8 && qualifiersPerGroup === 2
                              ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                              : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          ۸ گروه ۳ تیمی (۱۶ صعودکننده مستقیم به یک‌هشتم نهایی)
                        </button>
                      </div>
                    </div>
                  )}

                  {teamCount === 12 && (
                    <div className="pt-2 border-t border-slate-200/80">
                      <span className="text-[11px] font-black text-slate-700 block mb-2">
                        چیدمان‌های استاندارد پیشنهادی برای ۱۲ تیم:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setNumGroups(3);
                            setQualifiersPerGroup(2);
                          }}
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-all cursor-pointer ${
                            numGroups === 3 && qualifiersPerGroup === 2
                              ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                              : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
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
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-all cursor-pointer ${
                            numGroups === 4 && qualifiersPerGroup === 2
                              ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                              : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
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
          {!scheduleAlreadyDrawn && format === "groups-knockout" && canUseBestThirds && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                    <span className="text-base text-amber-500">🏆</span>
                    <span>نحوه تکمیل جدول مرحله حذفی ({toPersianDigits(targetBracketSize)} تیمی)</span>
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    با صعود {toPersianDigits(baseQualifiers)} تیم اول و دوم، برای تکمیل مرحله {toPersianDigits(targetBracketSize)} تیمی شیوه موردنظر خود را انتخاب کنید:
                  </p>
                </div>
                <span className="text-[11px] font-black bg-amber-100 text-amber-900 px-3 py-1 rounded-full border border-amber-200/80">
                  فرمت جام ملت‌های اروپا
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`relative flex cursor-pointer flex-col rounded-xl border p-4 transition-all ${
                    advanceBestThirds
                      ? "border-emerald-500 bg-emerald-50/40 shadow-sm ring-2 ring-emerald-500/20"
                      : "border-slate-200/90 bg-slate-50/60 hover:border-slate-300 hover:bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="advanceBestThirdsOption"
                        checked={advanceBestThirds}
                        onChange={() => setAdvanceBestThirds(true)}
                        className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="font-black text-sm text-slate-900">
                        صعود {toPersianDigits(missingForPowerOfTwo)} تیم برتر رتبه سوم (استاندارد یورو)
                      </span>
                    </div>
                    <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      پیشنهادی
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed pr-6">
                    {toPersianDigits(baseQualifiers)} تیم اول و دوم به همراه {toPersianDigits(missingForPowerOfTwo)} تیم برتر رتبه سوم صعود می‌کنند تا جدول {toPersianDigits(targetBracketSize)} تیمی کاملاً پر شده و هیچ تیمی در دور اول استراحت نابرابر نداشته باشد.
                  </p>
                </label>

                <label
                  className={`relative flex cursor-pointer flex-col rounded-xl border p-4 transition-all ${
                    !advanceBestThirds
                      ? "border-emerald-500 bg-emerald-50/40 shadow-sm ring-2 ring-emerald-500/20"
                      : "border-slate-200/90 bg-slate-50/60 hover:border-slate-300 hover:bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="advanceBestThirdsOption"
                        checked={!advanceBestThirds}
                        onChange={() => setAdvanceBestThirds(false)}
                        className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="font-black text-sm text-slate-900">
                        صرفاً صعود تیم‌های اول و دوم (با استراحت / BYE)
                      </span>
                    </div>
                    <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                      سنتی
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed pr-6">
                    فقط {toPersianDigits(baseQualifiers)} تیم صعود می‌کنند و {toPersianDigits(missingForPowerOfTwo)} تیم سرگروه برتر در دور اول حذفی استراحت (BYE) خواهند داشت.
                  </p>
                </label>
              </div>
            </div>
          )}

          {/* Avoidance Rule (Section 12 of spec) */}
          {!scheduleAlreadyDrawn && needsGroupRules && numGroups > 1 && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <span className="text-base text-rose-500">🛡️</span>
                  <span>قانون عدم برخورد در یک گروه (Avoidance Rule)</span>
                </h3>
                <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">اختیاری</span>
              </div>
              <p className="text-xs text-slate-600">
                اگر دو تیم از یک باشگاه یا یک شهر هستند و نباید در یک گروه قرار بگیرند، جفت آن‌ها را
                انتخاب کنید:
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <select
                  value={avoidTeamA}
                  onChange={(e) => setAvoidTeamA(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">انتخاب تیم اول...</option>
                  {teamNames.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-bold text-slate-400">↮</span>
                <select
                  value={avoidTeamB}
                  onChange={(e) => setAvoidTeamB(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:outline-none"
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
                  className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-100 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  + افزودن قانون عدم هم‌گروهی
                </button>
              </div>

              {avoidPairs.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {avoidPairs.map(([a, b], idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1 text-xs text-slate-800 shadow-2xs"
                    >
                      <span className="font-black text-emerald-800">{a}</span>
                      <span className="text-slate-400">↮</span>
                      <span className="font-black text-emerald-800">{b}</span>
                      <button
                        onClick={() => handleRemoveAvoidPair(idx)}
                        className="mr-1 text-rose-500 hover:text-rose-700 font-black cursor-pointer"
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
          {!scheduleAlreadyDrawn && format === "double-league" && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-card space-y-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <span className="text-base text-amber-500">🔄</span>
                  <span>نحوه زمان‌بندی و تقویم دور برگشت (Double Round-Robin)</span>
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  شما می‌توانید نحوه ترتیب مسابقات در نیم‌فصل دوم را مطابق استانداردهای روز دنیا یا تقویم کلاسیک انتخاب کنید:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`relative flex cursor-pointer flex-col rounded-xl border p-4 transition-all ${
                    independentSecondLeg
                      ? "border-emerald-500 bg-emerald-50/40 shadow-sm ring-2 ring-emerald-500/20"
                      : "border-slate-200/90 bg-slate-50/60 hover:border-slate-300 hover:bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="secondLegStyle"
                        checked={independentSecondLeg}
                        onChange={() => setIndependentSecondLeg(true)}
                        className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="font-black text-sm text-slate-900">
                        تقویم نامتقارن (مدرن اروپایی)
                      </span>
                    </div>
                    <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      پیش‌فرض لیگ‌های معتبر
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed pr-6">
                    مشابه لیگ برتر انگلیس و لالیگا؛ ترتیب هفته‌های دور برگشت به شکل متوازن چیده می‌شود تا هیجان مسابقات بالا بماند و تیم‌ها بلافاصله در هفته بعد با همان حریف قبلی روبه‌رو نشوند.
                  </p>
                </label>

                <label
                  className={`relative flex cursor-pointer flex-col rounded-xl border p-4 transition-all ${
                    !independentSecondLeg
                      ? "border-emerald-500 bg-emerald-50/40 shadow-sm ring-2 ring-emerald-500/20"
                      : "border-slate-200/90 bg-slate-50/60 hover:border-slate-300 hover:bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="secondLegStyle"
                        checked={!independentSecondLeg}
                        onChange={() => setIndependentSecondLeg(false)}
                        className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="font-black text-sm text-slate-900">
                        تقویم قرینه (کلاسیک و آینه‌ای)
                      </span>
                    </div>
                    <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                      سنتی
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed pr-6">
                    هفته‌های دور برگشت عیناً به ترتیب دور رفت تکرار می‌شوند (هفته اول دور برگشت تکرار بازی‌های هفته اول دور رفت با جابه‌جایی میزبان و میهمان است).
                  </p>
                </label>
              </div>
            </div>
          )}

          {/* Third Place Playoff Option */}
          {!scheduleAlreadyDrawn && supportsThirdPlace && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasThirdPlace}
                  onChange={(e) => setHasThirdPlace(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <div>
                  <span className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <span>🥉</span>
                    <span>برگزاری مسابقه رده‌بندی برای مقام سوم (Third Place Playoff)</span>
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    بازنده‌های دو نیمه‌نهایی برای کسب مدال برنز و جایگاه سوم با یکدیگر رقابت خواهند کرد.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Double Knockout Options (Bracket Reset) */}
          {!scheduleAlreadyDrawn && format === "double-knockout" && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasResetFinal}
                  onChange={(e) => setHasResetFinal(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <div>
                  <span className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <span>🔄</span>
                    <span>برگزاری فینال مجدد در صورت باخت قهرمان برندگان (Bracket Reset)</span>
                  </span>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    در فرمت رسمی دو حذفی، چون قهرمان جدول برندگان تا پیش از فینال هیچ شکستی نداشته است، در صورتی که در فینال اول از قهرمان بازندگان شکست بخورد، یک مسابقه سرنوشت‌ساز دوم برای تعیین قهرمان نهایی تورنمنت برگزار می‌شود.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Seeded Teams Selection for Knockout and Double Knockout */}
          {!scheduleAlreadyDrawn && (format === "knockout" || format === "double-knockout") && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-card space-y-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span className="text-base text-amber-500">🌟</span>
                <span>تیم‌های شاخص مسابقات {format === "double-knockout" ? "دو حذفی" : "تک‌حذفی"} (اختیاری)</span>
              </h3>
              <p className="text-xs text-slate-600">
                به ترتیبی که کلیک می‌کنید، اولویت سیدبندی حذفی تعیین می‌شود تا تیم‌های برتر در مراحل اولیه به یکدیگر برخورد نکنند. برای لغو دوباره روی نام تیم کلیک کنید.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {teamNames.map((team) => {
                  const idx = seededTeams.indexOf(team);
                  const selected = idx !== -1;
                  return (
                    <button
                      key={team}
                      type="button"
                      onClick={() => toggleSeed(team)}
                      className={
                        "rounded-full border px-4 py-1.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 " +
                        (selected
                          ? "border-amber-500 bg-amber-50 text-amber-950 shadow-xs ring-2 ring-amber-400/30"
                          : "border-slate-200 bg-white text-slate-700 hover:border-emerald-500/60 hover:bg-slate-50")
                      }
                    >
                      {selected && <span className="font-black text-amber-600">سید {toPersianDigits(idx + 1)}</span>}
                      <span>{team}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Multi-Pot Seeding for Group Stages (Pots 1, 2, 3, 4) */}
          {!scheduleAlreadyDrawn && needsGroupRules && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <span className="text-base">🎲</span>
                    <span>سیدبندی گروه‌ها (اختیاری - سیدهای ۱، ۲، ۳ و ۴)</span>
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    تعیین سیدها اختیاری است. تیم‌های هر سید در گروه‌های مجزا قرعه‌کشی می‌شوند تا با یکدیگر در یک گروه قرار نگیرند (حداکثر {toPersianDigits(numGroups)} تیم در هر سید).
                  </p>
                </div>
                <span className="text-[11px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-3 py-1 rounded-full shadow-2xs">
                  حداکثر {toPersianDigits(numGroups)} تیم در هر سید
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
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center cursor-pointer ${
                        isActive
                          ? "border-emerald-500 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/20 font-black"
                          : "border-slate-200/90 bg-slate-50/70 hover:bg-white text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-black">
                        <span>{pot.icon}</span>
                        <span className={isActive ? "text-emerald-950 font-black" : "text-slate-800 font-bold"}>{pot.title}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                            pot.count > 0 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {toPersianDigits(pot.count)} از {toPersianDigits(numGroups)} تیم
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Active Pot Info & Team Selector */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5">
                  <div className="text-xs text-slate-700">
                    {activePotTab === 1 && (
                      <span>
                        🌟 <strong>سرگروه‌ها (سید ۱):</strong> در رأس هر یک از {toPersianDigits(numGroups)} گروه قرعه‌کشی می‌شوند (حداکثر {toPersianDigits(numGroups)} تیم).
                      </span>
                    )}
                    {activePotTab === 2 && (
                      <span>
                        🥈 <strong>سید دو:</strong> تیم‌های سطح دو؛ هر تیم در یک گروه جداگانه قرعه‌کشی می‌شود و با هم هم‌گروه نمی‌شوند (حداکثر {toPersianDigits(numGroups)} تیم).
                      </span>
                    )}
                    {activePotTab === 3 && (
                      <span>
                        🥉 <strong>سید سه:</strong> تیم‌های سطح سه؛ در گروه‌های جداگانه قرعه‌کشی می‌شوند (حداکثر {toPersianDigits(numGroups)} تیم).
                      </span>
                    )}
                    {activePotTab === 4 && (
                      <span>
                        🏅 <strong>سید چهار:</strong> تیم‌های سطح چهار؛ در گروه‌های جداگانه قرعه‌کشی می‌شوند (حداکثر {toPersianDigits(numGroups)} تیم).
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
                      className="text-[11px] text-rose-600 hover:underline font-black cursor-pointer"
                    >
                      ✕ پاک‌کردن تیم‌های سید {toPersianDigits(activePotTab)}
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {teamNames.map((team) => {
                    const currentPot = getTeamPot(team);
                    const isInActivePot = currentPot === activePotTab;
                    const isInOtherPot = currentPot !== null && currentPot !== activePotTab;

                    let buttonClass =
                      "rounded-full border px-3.5 py-1.5 text-xs transition-all flex items-center gap-1.5 cursor-pointer ";

                    if (isInActivePot) {
                      if (activePotTab === 1) {
                        buttonClass += "border-amber-400 bg-amber-100 text-amber-950 font-black shadow-xs ring-2 ring-amber-400/30";
                      } else if (activePotTab === 2) {
                        buttonClass += "border-sky-400 bg-sky-100 text-sky-950 font-black shadow-xs ring-2 ring-sky-400/30";
                      } else if (activePotTab === 3) {
                        buttonClass += "border-teal-400 bg-teal-100 text-teal-950 font-black shadow-xs ring-2 ring-teal-400/30";
                      } else {
                        buttonClass += "border-purple-400 bg-purple-100 text-purple-950 font-black shadow-xs ring-2 ring-purple-400/30";
                      }
                    } else if (isInOtherPot) {
                      buttonClass += "border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300";
                    } else {
                      buttonClass += "border-slate-200 bg-white text-slate-800 hover:border-emerald-500 hover:bg-slate-50";
                    }

                    return (
                      <button
                        key={team}
                        type="button"
                        onClick={() => toggleTeamInPot(team, activePotTab)}
                        className={buttonClass}
                        title={
                          isInOtherPot
                            ? `این تیم هم‌اکنون در سید ${toPersianDigits(currentPot)} است. برای انتقال به سید ${toPersianDigits(activePotTab)} کلیک کنید.`
                            : isInActivePot
                            ? "برای حذف از این سید کلیک کنید."
                            : `افزودن به سید ${toPersianDigits(activePotTab)}`
                        }
                      >
                        {isInActivePot && (
                          <span className="font-black text-[11px]">✓</span>
                        )}
                        <span>{team}</span>
                        {isInOtherPot && (
                          <span className="text-[10px] text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded-full font-bold">
                            سید {toPersianDigits(currentPot)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pots Summary Bar */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-600">
                <span className="font-black text-slate-800">خلاصه سیدبندی:</span>
                <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-xl shadow-2xs">
                  <span>🌟 سید ۱:</span>
                  <strong className="text-emerald-700">{toPersianDigits(seededTeams.length)}</strong>
                </span>
                <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-xl shadow-2xs">
                  <span>🥈 سید ۲:</span>
                  <strong className="text-emerald-700">{toPersianDigits(pot2Teams.length)}</strong>
                </span>
                <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-xl shadow-2xs">
                  <span>🥉 سید ۳:</span>
                  <strong className="text-emerald-700">{toPersianDigits(pot3Teams.length)}</strong>
                </span>
                <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-xl shadow-2xs">
                  <span>🏅 سید ۴:</span>
                  <strong className="text-emerald-700">{toPersianDigits(pot4Teams.length)}</strong>
                </span>
                <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-xl shadow-2xs">
                  <span>⚪ قرعه آزاد:</span>
                  <strong className="text-emerald-700">
                    {toPersianDigits(teamCount - (seededTeams.length + pot2Teams.length + pot3Teams.length + pot4Teams.length))}
                  </strong>
                </span>
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800 shadow-2xs">
              ⚠️ {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            {scheduleAlreadyDrawn ? (
              <>
                <button className={btnGhost} onClick={() => setStep(4)}>
                  بازگشت به برنامه مسابقات
                </button>
                <button className={btnPrimary} onClick={applyPostDrawSettings}>
                  اعمال تنظیمات
                </button>
              </>
            ) : (
              <>
                <button className={btnGhost} onClick={() => setStep(2)}>
                  مرحله قبل
                </button>
                <button
                  className={btnPrimary}
                  disabled={isGenerating}
                  onClick={() => handleGenerate()}
                >
                  {isGenerating ? "در حال ثبت سهمیه و تولید..." : "تولید برنامه مسابقات"}
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {/* STEP 4: RESULTS VIEW */}
      {step === 4 && result && (
        <section className="animate-fade-in space-y-6">
          {/* Action Toolbar */}
          <div className="no-print flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-card">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🏆</span>
                <h1 className="text-xl font-black text-slate-900">
                  {result.metadata?.title || "برنامه مسابقات NexSport"}
                </h1>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                ثبت نتایج، ضربات پنالتی، چاپ رسمی یا اشتراک از طریق لینک اختصاصی.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-50 px-3.5 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-100 hover:shadow-xs transition-all cursor-pointer"
                onClick={() => {
                  setCeremonyMode("summary");
                  setShowDrawCeremony(true);
                }}
                title="مشاهده جدول و نتیجه نهایی قرعه‌کشی مسابقات"
              >
                <span>📋</span>
                <span>نتیجه قرعه‌کشی</span>
              </button>

              <button
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500 bg-gradient-to-r from-emerald-600 to-teal-700 px-3.5 py-2 text-xs font-black text-white hover:from-emerald-700 hover:to-teal-800 shadow-sm hover:shadow-md transition-all cursor-pointer"
                onClick={() => handleOpenShareModal()}
                title="ایجاد، فعال‌سازی و دریافت لینک اختصاصی مسابقه برای تماشاگران و بازیکنان"
              >
                <span>🔗</span>
                <span>ایجاد لینک اختصاصی</span>
              </button>

              <button
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-black text-amber-900 hover:bg-amber-100 hover:shadow-xs transition-all cursor-pointer"
                onClick={handleOpenSaveCloud}
                title="ذخیره این مسابقه و نتایج آن"
              >
                <span>💾</span>
                <span>ذخیره</span>
              </button>

              <button
                className={btnGhost}
                onClick={handleOpenSavedList}
                title="مشاهده و بارگذاری مسابقات ذخیره شده در حساب کاربری"
              >
                <span>📂</span>
                <span>مسابقات من</span>
              </button>

              <button
                className={btnGhost}
                onClick={() => setStep(3)}
                title="تغییر نام مسابقه، محل برگزاری و سیستم امتیازدهی"
              >
                <span>⚙️</span>
                <span>تنظیمات</span>
              </button>

              <button
                className={btnGhost}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("nexsport-open-print"));
                }}
                title="تنظیمات پیشرفته چاپ و دریافت فایل PDF"
              >
                <span>🖨️</span>
                <span>چاپ / PDF</span>
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
                  libraryTeamIds,
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
        onOpenShareModal={(id, title) => handleOpenShareModal(id, title)}
      />

      {/* Share / Public Tournament Link Modal */}
      <ShareTournamentModal
        isOpen={shareModalOpen}
        onClose={() => {
          setShareModalOpen(false);
          setShareModalTournamentId(null);
          setShareModalTournamentTitle("");
        }}
        tournamentId={shareModalTournamentId || currentSavedId}
        tournamentTitle={
          shareModalTournamentTitle ||
          metadata.title ||
          FORMAT_OPTIONS.find((f) => f.key === format)?.title ||
          "مسابقه ورزشی"
        }
        onEnsureSaved={handleEnsureSavedForShare}
        tournamentData={{
          id: shareModalTournamentId || currentSavedId,
          title:
            shareModalTournamentTitle ||
            metadata.title ||
            FORMAT_OPTIONS.find((f) => f.key === format)?.title ||
            "مسابقه ورزشی",
          format,
          sport: pointsRule?.sport,
          teamCount,
          state: {
            step: 4,
            format,
            teamCount,
            teamNames,
            libraryTeamIds,
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
            payment: {
              isPaid: true,
              amount: 200000,
              paidAt: new Date().toISOString(),
            },
          },
        }}
      />

      <RegistrationModal
        isOpen={registrationModalOpen}
        onClose={() => setRegistrationModalOpen(false)}
        tournamentId={currentSavedId}
        tournamentTitle={
          metadata.title?.trim() ||
          FORMAT_OPTIONS.find((f) => f.key === format)?.title ||
          "مسابقه ورزشی"
        }
        onEnsureSaved={handleEnsureSavedForShare}
        onInsertApprovedNames={(names) => {
          insertApprovedRegistrationNames(names);
          setRegistrationModalOpen(false);
        }}
      />

      {/* Live Draw Ceremony Modal */}
      {showDrawCeremony && result && (
        <DrawCeremonyModal
          isOpen={showDrawCeremony}
          initialMode={ceremonyMode}
          format={format}
          teams={teamNames}
          result={result}
          tournamentTitle={metadata.title}
          seededTeams={seededTeams}
          pot2Teams={pot2Teams}
          pot3Teams={pot3Teams}
          pot4Teams={pot4Teams}
          onComplete={handleCeremonyComplete}
        />
      )}

      {/* Guest Limit Modal */}
      {guestLimitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-amber-300 text-right space-y-4"
            dir="rtl"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 text-2xl shrink-0">
                ⚠️
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900">
                  سقف مسابقات رایگان مهمان تکمیل شد
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  حداکثر {toPersianDigits(quota?.guestLimit || 2)} مسابقه برای هر دستگاه مهمان
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-amber-50/80 border border-amber-200 p-3.5 text-xs text-amber-950 leading-relaxed space-y-2">
              <p>
                شما از سقف {toPersianDigits(quota?.guestLimit || 2)} برنامه‌ریزی مسابقه رایگان کاربر مهمان در این دستگاه استفاده نموده‌اید.
              </p>
              <div className="font-bold text-emerald-900 bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                🎁 <strong>هدیه ثبت‌نام رایگان:</strong> با ثبت‌نام در کمتر از ۳۰ ثانیه،{" "}
                <strong>
                  {toPersianDigits(quota?.giftPlannings ?? 5)} برنامه‌ریزی مسابقه
                  {(quota?.giftLinks ?? 1) > 0
                    ? ` + ${toPersianDigits(quota?.giftLinks ?? 1)} ایجاد لینک اختصاصی تماشاگران رایگان`
                    : ""}
                </strong>{" "}
                دریافت کنید!
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setGuestLimitModalOpen(false);
                  openAuthModal("register");
                }}
                className="w-full sm:flex-1 rounded-xl bg-emerald-600 py-2.5 px-4 font-black text-xs text-white hover:bg-emerald-700 shadow-sm transition-all cursor-pointer text-center"
              >
                ثبت‌نام سریع و دریافت هدیه ←
              </button>
              <button
                type="button"
                onClick={() => {
                  setGuestLimitModalOpen(false);
                  openAuthModal("login");
                }}
                className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white py-2.5 px-4 font-bold text-xs text-slate-700 hover:bg-slate-50 transition-all cursor-pointer text-center"
              >
                ورود به حساب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Store & Membership Modal */}
      <StoreModal
        isOpen={storeModalOpen}
        onClose={() => {
          setStoreModalOpen(false);
          setStoreReturnSuccess(null);
        }}
        initialTab={storeModalTab}
        initialSuccess={storeReturnSuccess}
        onSuccess={() => {
          loadQuota();
        }}
      />
    </main>
    </>
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
