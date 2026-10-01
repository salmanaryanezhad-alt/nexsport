"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { NexSportIcon } from "@/components/NexSportLogo";
import { toPersianDigits } from "@/lib/digits";

interface AdminTournamentItem {
  id: string;
  user_id: string;
  title: string;
  format: string;
  sport: string | null;
  team_count: number;
  created_at: string;
  updated_at: string;
  linkActive: boolean;
  owner: {
    id: string;
    name: string;
    email: string;
    mobile: string;
  };
}

const FORMAT_LABELS: Record<string, string> = {
  "groups-knockout": "گروهی + حذفی",
  "league-single": "لیگ تک‌دوره‌ای",
  league: "لیگ تک‌دوره‌ای",
  "league-double": "لیگ رفت و برگشت",
  "double-league": "لیگ رفت و برگشت",
  knockout: "تک‌حذفی",
  "double-knockout": "دوحذفی",
  groups: "گروهی",
};

function formatPersianDate(dateString?: string) {
  if (!dateString) return "—";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return dateString;
  }
}

export function AdminTournamentsModal() {
  const {
    isAdminTournamentsModalOpen,
    closeAdminTournamentsModal,
    isAdmin,
    adminTournamentsFilterUserId,
    openUsersModal,
  } = useAuth();
  const [items, setItems] = useState<AdminTournamentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  const fetchTournaments = async (userId?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const qs = userId ? `?userId=${encodeURIComponent(userId)}` : "";
      const res = await fetch(`/api/admin/tournaments${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `خطا در دریافت مسابقات (کد ${res.status})`);
        return;
      }
      setItems(Array.isArray(data.tournaments) ? data.tournaments : []);
    } catch {
      setError("خطا در ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی فرمایید.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminTournamentsModalOpen && isAdmin) {
      setSearchQuery("");
      setActiveUserId(adminTournamentsFilterUserId);
      fetchTournaments(adminTournamentsFilterUserId);
    }
  }, [isAdminTournamentsModalOpen, isAdmin, adminTournamentsFilterUserId]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.trim().toLowerCase();
    return items.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.owner.name.toLowerCase().includes(q) ||
        t.owner.email.toLowerCase().includes(q) ||
        t.owner.mobile.toLowerCase().includes(q) ||
        (t.sport || "").toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  const ownerLabel = activeUserId
    ? items[0]?.owner?.name || "این کاربر"
    : null;

  if (!isAdminTournamentsModalOpen || !isAdmin) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-ink/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[90vh] rounded-2xl bg-white shadow-2xl border border-line flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-line/70 bg-chalk/70 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <NexSportIcon size={26} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-pitch">مسابقات ایجادشده توسط کاربران</h2>
                <span className="rounded-full bg-pitch/10 text-pitch px-2 py-0.5 text-[10px] font-black border border-pitch/20">
                  فقط کاربران ثبت‌نام‌شده
                </span>
              </div>
              <p className="text-[11px] text-ink/60 mt-0.5">
                مسابقات مهمان نمایش داده نمی‌شود. مدیر می‌تواند همه مسابقات ذخیره‌شده را بدون لینک اختصاصی هم مشاهده کند (بدون ثبت نتیجه).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeAdminTournamentsModal}
            className="rounded-lg p-1.5 text-ink/40 hover:bg-chalk hover:text-ink transition-colors cursor-pointer"
            title="بستن پنجره"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-line bg-chalk/30 px-5 py-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-line/80 bg-white px-3 py-2 shadow-2xs">
              <p className="text-[10px] text-ink/50 font-semibold">تعداد مسابقات</p>
              <p className="text-lg font-black text-pitch leading-tight">
                {toPersianDigits(items.length)}
              </p>
            </div>
            {ownerLabel && (
              <div className="rounded-xl border border-pitch/20 bg-pitch/5 px-3 py-2 flex items-center gap-2">
                <span className="text-[11px] font-bold text-pitch">فیلتر: {ownerLabel}</span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveUserId(null);
                    fetchTournaments(null);
                  }}
                  className="text-[10px] font-bold text-pitch underline cursor-pointer"
                >
                  نمایش همه
                </button>
              </div>
            )}
            <div className="relative flex-1 min-w-[180px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی عنوان، نام، ایمیل یا موبایل برگزارکننده..."
                className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs text-ink focus:border-pitch focus:outline-none placeholder:text-ink/40"
              />
            </div>
            <button
              type="button"
              onClick={() => fetchTournaments(activeUserId)}
              disabled={loading}
              className="rounded-xl border border-line bg-white hover:bg-chalk px-3 py-2.5 text-xs font-bold text-ink cursor-pointer"
            >
              <span className={loading ? "animate-spin" : ""}>🔄</span>
            </button>
            <button
              type="button"
              onClick={() => {
                closeAdminTournamentsModal();
                openUsersModal();
              }}
              className="rounded-xl border border-pitch/20 bg-pitch/10 px-3 py-2.5 text-xs font-bold text-pitch cursor-pointer"
            >
              کاربران
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
              {error}
            </div>
          )}

          {loading && items.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="inline-block animate-spin text-3xl">⏳</div>
              <p className="text-xs text-ink/60">در حال دریافت مسابقات کاربران...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <div className="text-3xl opacity-40">🏆</div>
              <p className="text-sm font-bold text-ink/70">مسابقه‌ای یافت نشد</p>
              <p className="text-xs text-ink/50">
                {searchQuery
                  ? "نتیجه‌ای مطابق جستجو پیدا نشد."
                  : "هنوز مسابقه‌ای توسط کاربران ثبت‌نام‌شده ذخیره نشده است."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-right text-xs">
                <thead className="bg-chalk/80 text-ink/70 font-bold border-b border-line text-[11px]">
                  <tr>
                    <th className="py-3 px-3 text-center w-12">ردیف</th>
                    <th className="py-3 px-3">مسابقه</th>
                    <th className="py-3 px-3">برگزارکننده</th>
                    <th className="py-3 px-3">فرمت</th>
                    <th className="py-3 px-3 text-center">تیم‌ها</th>
                    <th className="py-3 px-3">آخرین ویرایش</th>
                    <th className="py-3 px-3 text-center">لینک</th>
                    <th className="py-3 px-3 text-center">مشاهده</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {filtered.map((t, index) => (
                    <tr key={t.id} className="hover:bg-chalk/40 transition-colors">
                      <td className="py-3 px-3 text-center font-mono text-ink/50 font-bold">
                        {toPersianDigits(index + 1)}
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-ink">{t.title}</p>
                        {t.sport && <p className="text-[10px] text-ink/50 mt-0.5">{t.sport}</p>}
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-ink">{t.owner.name}</p>
                        <p className="text-[10px] text-ink/50 dir-ltr text-right">{t.owner.email}</p>
                      </td>
                      <td className="py-3 px-3 text-ink/80">
                        {FORMAT_LABELS[t.format] || t.format}
                      </td>
                      <td className="py-3 px-3 text-center font-bold">
                        {toPersianDigits(t.team_count)}
                      </td>
                      <td className="py-3 px-3 text-[11px] text-ink/70">
                        {formatPersianDate(t.updated_at)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {t.linkActive ? (
                          <span className="inline-flex rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            فعال
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            ذخیره‌شده
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <a
                          href={`/t/${t.id}`}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="inline-flex items-center gap-1 rounded-lg bg-pitch text-white px-2.5 py-1 text-[11px] font-bold hover:bg-pitch-light"
                          title="مشاهده برنامه، نتایج و جدول (بدون امکان ثبت نتیجه)"
                        >
                          <span>👁</span>
                          <span>مشاهده</span>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border-t border-line/70 bg-chalk/50 px-5 py-3 flex items-center justify-between text-xs text-ink/60 shrink-0">
          <span>
            نمایش <strong>{toPersianDigits(filtered.length)}</strong> مسابقه کاربران ثبت‌نام‌شده
          </span>
          <button
            type="button"
            onClick={closeAdminTournamentsModal}
            className="rounded-lg bg-pitch px-4 py-1.5 font-bold text-white shadow-2xs hover:bg-pitch-light transition-colors cursor-pointer text-xs"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
}
