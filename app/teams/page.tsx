"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";
import { TeamsChrome } from "@/components/teams/TeamsChrome";
import { TeamFields } from "@/components/teams/TeamFields";
import { emptyTeamForm, TeamItem } from "@/components/teams/teamTypes";
import { toPersianDigits } from "@/lib/digits";
import { formatDateJalali } from "@/lib/jalali";

export default function TeamsPage() {
  const { user, loading, openAuthModal, isAdmin, openAdminTeamsModal } = useAuth();
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyTeamForm);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  async function load() {
    setFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/teams/", { credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "خطا در دریافت تیم‌ها.");
        return;
      }
      setTeams(Array.isArray(data.teams) ? data.teams : []);
    } catch {
      setError("خطا در برقراری ارتباط با سرور.");
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return teams;
    return teams.filter((t) => `${t.name} ${t.city} ${t.sport} ${t.coach}`.includes(q));
  }, [teams, query]);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/teams/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "ثبت تیم ناموفق بود.");
        return;
      }
      setForm(emptyTeamForm);
      setShowCreate(false);
      await load();
    } catch {
      setError("خطا در ثبت تیم.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <TeamsChrome>
        <p className="text-sm text-slate-500">در حال بررسی حساب کاربری…</p>
      </TeamsChrome>
    );
  }

  if (!user) {
    return (
      <TeamsChrome>
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card space-y-4">
          <div className="text-4xl">🛡️</div>
          <h1 className="text-xl font-black text-slate-900">تیم‌های من</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            برای ساخت تیم، ثبت فهرست بازیکنان و استفاده از آن‌ها در برنامه‌ریز، ابتدا وارد حساب شوید.
            مهمان‌ها می‌توانند فقط نام تیم را در مرحله برنامه‌ریزی تایپ کنند.
          </p>
          <button
            type="button"
            onClick={() => openAuthModal("login")}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-2.5 text-sm font-black text-white shadow-md hover:brightness-110"
          >
            ورود / ثبت‌نام
          </button>
        </div>
      </TeamsChrome>
    );
  }

  return (
    <TeamsChrome>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">تیم‌های من</h1>
          <p className="text-sm text-slate-600 mt-1">
            تیم بسازید، بازیکن اضافه کنید و بعداً در برنامه‌ریز مسابقات از فهرست ذخیره‌شده انتخاب کنید.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => openAdminTeamsModal()}
              className="rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-black text-indigo-900 hover:bg-indigo-100"
            >
              تیم‌های کاربران
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-xs font-black text-white shadow-md hover:brightness-110"
          >
            {showCreate ? "بستن فرم" : "＋ تیم جدید"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-800">
          {error}
        </div>
      )}

      {showCreate && (
        <div className="mb-6 rounded-2xl border border-emerald-200/80 bg-white p-5 sm:p-6 shadow-card space-y-4">
          <h2 className="font-black text-slate-900">ثبت تیم جدید</h2>
          <TeamFields value={form} onChange={setForm} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">
              انصراف
            </button>
            <button
              type="button"
              disabled={saving || !form.name.trim()}
              onClick={handleCreate}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-40"
            >
              {saving ? "در حال ذخیره…" : "ثبت تیم"}
            </button>
          </div>
        </div>
      )}

      <div className="mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جستجو بر اساس نام، شهر یا رشته…"
          className="w-full sm:w-80 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      {fetching ? (
        <p className="text-sm text-slate-500">در حال بارگذاری…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          هنوز تیمی ثبت نشده است. با دکمه «تیم جدید» شروع کنید.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((team) => (
            <Link
              key={team.id}
              href={`/teams/${team.id}/`}
              className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs hover:border-emerald-400 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-black text-slate-900">{team.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {team.sport}
                    {team.city ? ` • ${team.city}` : ""}
                    {team.founded_year ? ` • ${toPersianDigits(team.founded_year)}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-black text-emerald-800">
                  {toPersianDigits(team.player_count || 0)} بازیکن
                </span>
              </div>
              {team.coach && <p className="mt-3 text-xs text-slate-600">مربی: {team.coach}</p>}
              <p className="mt-3 text-[11px] text-slate-400">
                به‌روزرسانی: {formatDateJalali(new Date(team.updated_at))}
              </p>
            </Link>
          ))}
        </div>
      )}
    </TeamsChrome>
  );
}
