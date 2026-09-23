"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthContext";

export interface SavedTournamentItem {
  id: string;
  user_id: string;
  title: string;
  format: string;
  sport: string | null;
  team_count: number;
  state?: any;
  created_at: string;
  updated_at: string;
}

interface SavedTournamentsModalProps {
  isOpen: boolean;
  mode: "save" | "list";
  onClose: () => void;
  // Current tournament state to save (for mode === 'save')
  currentTournament?: {
    id?: string | null;
    title: string;
    format: string;
    teamCount: number;
    sport?: string;
    state: any;
  };
  // Callback when a tournament is selected to load into planner
  onLoadTournament: (tournament: SavedTournamentItem) => void;
  // Callback when tournament is saved
  onSavedSuccess?: (tournament: SavedTournamentItem) => void;
}

const SPORT_OPTIONS = [
  "فوتبال",
  "فوتسال",
  "والیبال",
  "بسکتبال",
  "تنیس روی میز",
  "هندبال",
  "بازی‌های الکترونیک (FIFA/PES)",
  "سایر",
];

const FORMAT_LABELS: Record<string, string> = {
  "groups-knockout": "گروهی + حذفی",
  "league-single": "لیگ تک‌دوره‌ای",
  "league-double": "لیگ رفت و برگشت",
  "knockout": "تک‌حذفی استاندارد",
  "double-knockout": "دوحذفی (Double Elimination)",
};

export function SavedTournamentsModal({
  isOpen,
  mode: initialMode,
  onClose,
  currentTournament,
  onLoadTournament,
  onSavedSuccess,
}: SavedTournamentsModalProps) {
  const { user, openAuthModal, handleSessionExpired } = useAuth();

  const [mode, setMode] = useState<"save" | "list">(initialMode);
  const [tournaments, setTournaments] = useState<SavedTournamentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Save form state
  const [saveTitle, setSaveTitle] = useState("");
  const [saveSport, setSaveSport] = useState("فوتبال");
  const [saveAsNew, setSaveAsNew] = useState(false);

  function handleClose() {
    if (typeof window !== "undefined" && window.location.search.includes("open=saved")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    onClose();
  }

  useEffect(() => {
    setMode(initialMode);
    setError(null);
    setSuccessMsg(null);
    if (initialMode === "save" && currentTournament) {
      setSaveTitle(currentTournament.title || "تورنمنت جدید");
      setSaveSport(currentTournament.sport || "فوتبال");
      setSaveAsNew(!currentTournament.id);
    }
  }, [initialMode, isOpen, currentTournament]);

  // Fetch list of tournaments when in "list" mode
  useEffect(() => {
    if (!isOpen || !user || mode !== "list") return;

    let isMounted = true;
    async function fetchTournaments() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/tournaments");
        const data = await res.json();
        if (isMounted) {
          if (res.ok) {
            setTournaments(data.tournaments || []);
          } else if (res.status === 401 || data.expired) {
            handleSessionExpired();
          } else {
            setError(data.error || "خطا در بارگذاری فهرست مسابقات.");
          }
        }
      } catch {
        if (isMounted) setError("امکان اتصال به سرور جهت دریافت مسابقات وجود ندارد.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchTournaments();
    return () => {
      isMounted = false;
    };
  }, [isOpen, user, mode, handleSessionExpired]);

  if (!isOpen) return null;

  // If user is not logged in, prompt to log in
  if (!user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-line text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/15 text-3xl">
            ☁️
          </div>
          <h3 className="text-base font-black text-pitch mb-2">ورود به حساب کاربری</h3>
          <p className="text-xs text-ink/70 leading-relaxed mb-6">
            برای ذخیره ابری مسابقات و دسترسی به جداول و براکت‌های خود از هر دستگاهی، ابتدا وارد حساب کاربری خود شوید یا به‌صورت رایگان ثبت‌نام کنید.
          </p>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-xl border border-line py-2.5 text-xs font-bold text-ink/70 hover:bg-chalk transition-colors cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={() => {
                handleClose();
                openAuthModal("login");
              }}
              className="flex-1 rounded-xl bg-pitch py-2.5 text-xs font-bold text-white hover:bg-pitch-light shadow-sm transition-colors cursor-pointer"
            >
              ورود یا ثبت‌نام
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Handle Save
  async function handleSaveTournament(e: React.FormEvent) {
    e.preventDefault();
    if (!currentTournament) return;
    setError(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      const targetId = saveAsNew ? undefined : currentTournament.id || undefined;
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: targetId,
          title: saveTitle.trim() || "مسابقه بدون عنوان",
          format: currentTournament.format,
          sport: saveSport,
          teamCount: currentTournament.teamCount,
          state: currentTournament.state,
        }),
      });

      const data = await res.json();
      if (res.status === 401 || data.expired) {
        handleSessionExpired();
        throw new Error("نشست شما منقضی شده است. لطفاً مجدداً وارد شوید.");
      }
      if (!res.ok) {
        throw new Error(data.error || "خطا در ذخیره مسابقه.");
      }

      setSuccessMsg("مسابقه با موفقیت در فضای ابری ذخیره شد!");
      if (onSavedSuccess && data.tournament) {
        onSavedSuccess(data.tournament);
      }
      setTimeout(() => {
        handleClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || "خطا در برقراری ارتباط با سرور.");
    } finally {
      setActionLoading(false);
    }
  }

  // Handle Delete
  async function handleDelete(tournamentId: string, tournamentTitle: string) {
    if (!window.confirm(`آیا از حذف مسابقه «${tournamentTitle}» اطمینان دارید؟ این عملیات غیرقابل بازگشت است.`)) {
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.status === 401 || data.expired) {
        handleSessionExpired();
        throw new Error("نشست شما منقضی شده است. لطفاً مجدداً وارد شوید.");
      }
      if (!res.ok) {
        throw new Error(data.error || "خطا در حذف مسابقه.");
      }
      setTournaments((prev) => prev.filter((t) => t.id !== tournamentId));
      setSuccessMsg("مسابقه با موفقیت حذف شد.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err?.message || "خطا در حذف مسابقه.");
    } finally {
      setActionLoading(false);
    }
  }

  // Handle Load
  async function handleLoad(tournamentId: string) {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}`);
      const data = await res.json();
      if (res.status === 401 || data.expired) {
        handleSessionExpired();
        throw new Error("نشست شما منقضی شده است. لطفاً مجدداً وارد شوید.");
      }
      if (!res.ok || !data.tournament) {
        throw new Error(data.error || "خطا در دریافت اطلاعات کامل مسابقه.");
      }

      onLoadTournament(data.tournament);
      handleClose();
    } catch (err: any) {
      setError(err?.message || "خطا در بارگذاری مسابقه.");
    } finally {
      setActionLoading(false);
    }
  }

  function formatPersianDate(isoDate: string) {
    try {
      const d = new Date(isoDate);
      return new Intl.DateTimeFormat("fa-IR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(d);
    } catch {
      return isoDate;
    }
  }

  const filteredTournaments = tournaments.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.sport && t.sport.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-line overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line/60 bg-chalk/60 px-5 py-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">{mode === "save" ? "☁️" : "📂"}</span>
            <span className="font-bold text-sm text-pitch">
              {mode === "save" ? "ذخیره مسابقه در حساب ابری" : "مسابقات ذخیره شده من"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Switch tabs if user has tournament active */}
            {currentTournament && (
              <div className="inline-flex rounded-lg border border-line/80 bg-white p-0.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setMode("save")}
                  className={
                    "rounded-md px-2.5 py-1 transition-colors cursor-pointer " +
                    (mode === "save"
                      ? "bg-pitch text-white"
                      : "text-ink/60 hover:text-ink")
                  }
                >
                  ذخیره فعلی
                </button>
                <button
                  type="button"
                  onClick={() => setMode("list")}
                  className={
                    "rounded-md px-2.5 py-1 transition-colors cursor-pointer " +
                    (mode === "list"
                      ? "bg-pitch text-white"
                      : "text-ink/60 hover:text-ink")
                  }
                >
                  فهرست مسابقات
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg p-1 text-ink/40 hover:bg-chalk hover:text-ink transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mx-5 mt-4 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800 flex items-center gap-2 shrink-0">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-5 mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 flex items-center gap-2 shrink-0">
            <span>✓</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {mode === "save" && currentTournament ? (
            <form onSubmit={handleSaveTournament} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1.5">
                  عنوان مسابقه <span className="text-brick">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  placeholder="مثال: جام رمضان فوتسال ۱۴۰۵"
                  className="w-full rounded-lg border border-line bg-white px-3.5 py-2 text-sm focus:border-pitch focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1.5">
                  رشته ورزشی
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {SPORT_OPTIONS.map((sport) => (
                    <button
                      key={sport}
                      type="button"
                      onClick={() => setSaveSport(sport)}
                      className={
                        "rounded-lg px-2.5 py-1 text-xs font-medium border transition-colors cursor-pointer " +
                        (saveSport === sport
                          ? "border-pitch bg-pitch text-white"
                          : "border-line bg-white text-ink/70 hover:bg-chalk")
                      }
                    >
                      {sport}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tournament Summary info */}
              <div className="rounded-xl border border-line/70 bg-chalk/40 p-3.5 text-xs space-y-1.5">
                <div className="flex justify-between text-ink/70">
                  <span>فرمت مسابقات:</span>
                  <span className="font-bold text-ink">
                    {FORMAT_LABELS[currentTournament.format] || currentTournament.format}
                  </span>
                </div>
                <div className="flex justify-between text-ink/70">
                  <span>تعداد تیم‌ها:</span>
                  <span className="font-bold text-ink">{currentTournament.teamCount} تیم</span>
                </div>
              </div>

              {/* If existing tournament ID exists */}
              {currentTournament.id && (
                <div className="rounded-xl border border-gold/30 bg-gold/5 p-3 text-xs space-y-2">
                  <p className="font-bold text-ink">این مسابقه قبلاً ذخیره شده است. چه‌کاری انجام شود؟</p>
                  <label className="flex items-center gap-2 cursor-pointer text-ink/80">
                    <input
                      type="radio"
                      name="saveStrategy"
                      checked={!saveAsNew}
                      onChange={() => setSaveAsNew(false)}
                      className="accent-pitch cursor-pointer"
                    />
                    <span>به‌روزرسانی همین مسابقه (نسخه فعلی بازنویسی می‌شود)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-ink/80">
                    <input
                      type="radio"
                      name="saveStrategy"
                      checked={saveAsNew}
                      onChange={() => setSaveAsNew(true)}
                      className="accent-pitch cursor-pointer"
                    />
                    <span>ذخیره به عنوان یک مسابقه جدید و مستقل (نسخه جدید)</span>
                  </label>
                </div>
              )}

              <div className="pt-2 flex gap-2.5">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 rounded-xl border border-line py-2.5 text-xs font-bold text-ink/70 hover:bg-chalk transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 rounded-xl bg-pitch py-2.5 text-xs font-bold text-white hover:bg-pitch-light shadow-sm transition-colors disabled:opacity-50 cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  <span>💾</span>
                  <span>{actionLoading ? "در حال ذخیره..." : "ذخیره در فضای ابری"}</span>
                </button>
              </div>
            </form>
          ) : (
            <div>
              {/* Search bar */}
              {tournaments.length > 3 && (
                <div className="mb-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="جستجو در عناوین یا رشته مسابقات..."
                    className="w-full rounded-lg border border-line bg-white px-3 py-1.5 text-xs focus:border-pitch focus:outline-none"
                  />
                </div>
              )}

              {loading ? (
                <div className="py-12 text-center text-xs text-ink/60">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-pitch border-t-transparent mb-2" />
                  <p>در حال فراخوانی مسابقات ذخیره شده شما...</p>
                </div>
              ) : tournaments.length === 0 ? (
                <div className="py-12 text-center text-ink/60">
                  <div className="text-4xl mb-2">📁</div>
                  <p className="font-bold text-sm text-ink mb-1">شما هنوز هیچ مسابقه‌ای ذخیره نکرده‌اید.</p>
                  <p className="text-xs text-ink/60 max-w-sm mx-auto leading-relaxed">
                    با زدن دکمه «ذخیره ابری» در مرحله جدول مسابقات، می‌توانید برنامه‌ها و نتایج خود را ذخیره کنید تا همیشه همراه شما باشند.
                  </p>
                </div>
              ) : filteredTournaments.length === 0 ? (
                <div className="py-8 text-center text-xs text-ink/60">
                  مسابقه‌ای مطابق با عبارت جستجوی شما یافت نشد.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredTournaments.map((t) => (
                    <div
                      key={t.id}
                      className="group rounded-xl border border-line/80 bg-white p-3.5 hover:border-pitch/40 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-ink">{t.title}</h4>
                          {t.sport && (
                            <span className="rounded-md bg-gold/15 border border-gold/30 px-2 py-0.5 text-[10px] font-bold text-gold-dark">
                              {t.sport}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-ink/60">
                          <span>{FORMAT_LABELS[t.format] || t.format}</span>
                          <span>•</span>
                          <span>{t.team_count} تیم</span>
                          <span>•</span>
                          <span title={t.updated_at}>آخرین ویرایش: {formatPersianDate(t.updated_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleLoad(t.id)}
                          className="rounded-lg bg-pitch px-3 py-1.5 text-xs font-bold text-white hover:bg-pitch-light transition-colors cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <span>بارگذاری</span>
                          <span>↗</span>
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleDelete(t.id, t.title)}
                          title="حذف مسابقه"
                          className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
