"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";
import { NexSportIcon } from "@/components/NexSportLogo";
import { toPersianDigits } from "@/lib/digits";
import { formatDateJalali } from "@/lib/jalali";
import { TeamItem } from "@/components/teams/teamTypes";

export function AdminTeamsModal() {
  const { isAdminTeamsModalOpen, closeAdminTeamsModal, isAdmin } = useAuth();
  const [items, setItems] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  async function fetchTeams() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/teams/", { credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `خطا در دریافت تیم‌ها (کد ${res.status})`);
        return;
      }
      setItems(Array.isArray(data.teams) ? data.teams : []);
    } catch {
      setError("خطا در برقراری ارتباط با سرور.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdminTeamsModalOpen && isAdmin) fetchTeams();
  }, [isAdminTeamsModalOpen, isAdmin]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return items;
    return items.filter((t) => `${t.name} ${t.city} ${t.sport} ${t.owner_name || ""} ${t.owner_email || ""}`.includes(q));
  }, [items, searchQuery]);

  if (!isAdminTeamsModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/50 p-3 sm:p-6" onClick={closeAdminTeamsModal}>
      <div
        className="relative my-6 w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <NexSportIcon className="w-7 h-7" />
            <div>
              <h2 className="font-black text-slate-900">تیم‌های کاربران</h2>
              <p className="text-[11px] text-slate-500">مشاهده تمام تیم‌های ثبت‌شده در سامانه</p>
            </div>
          </div>
          <button type="button" onClick={closeAdminTeamsModal} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700">
            ✕
          </button>
        </div>
        <div className="p-5 space-y-4">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو نام تیم، مالک یا شهر…"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800">{error}</div>}
          {loading ? (
            <p className="text-sm text-slate-500">در حال بارگذاری…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-500">تیمی یافت نشد.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-right text-xs text-slate-500 border-b">
                    <th className="py-2 font-bold">تیم</th>
                    <th className="py-2 font-bold">مالک</th>
                    <th className="py-2 font-bold">رشته</th>
                    <th className="py-2 font-bold">بازیکن</th>
                    <th className="py-2 font-bold">به‌روزرسانی</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} className="border-b border-slate-50">
                      <td className="py-2 font-bold">
                        {t.name}
                        {t.city ? <span className="block text-[11px] text-slate-500 font-medium">{t.city}</span> : null}
                      </td>
                      <td className="py-2">
                        <div className="font-bold text-slate-800">{t.owner_name || "—"}</div>
                        <div className="text-[11px] text-slate-500 dir-ltr text-right">{t.owner_email}</div>
                      </td>
                      <td className="py-2 text-slate-600">{t.sport}</td>
                      <td className="py-2 font-black">{toPersianDigits(t.player_count || 0)}</td>
                      <td className="py-2 text-xs text-slate-500">{formatDateJalali(new Date(t.updated_at))}</td>
                      <td className="py-2">
                        <Link
                          href={`/teams/${t.id}/`}
                          onClick={closeAdminTeamsModal}
                          className="text-xs font-black text-emerald-700 hover:underline"
                        >
                          مشاهده
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
