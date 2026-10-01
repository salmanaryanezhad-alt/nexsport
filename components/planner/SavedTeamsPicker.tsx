"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";
import { TeamItem } from "@/components/teams/teamTypes";
import { toPersianDigits } from "@/lib/digits";

export function SavedTeamsPicker({
  teamCount,
  currentNames,
  currentIds,
  onApply,
}: {
  teamCount: number;
  currentNames: string[];
  currentIds: (string | null)[];
  onApply: (names: string[], libraryIds: (string | null)[]) => void;
}) {
  const { user, openAuthModal } = useAuth();
  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/teams/", { credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "خطا در دریافت تیم‌های ذخیره‌شده.");
        return;
      }
      setTeams(Array.isArray(data.teams) ? data.teams : []);
    } catch {
      setError("خطا در ارتباط با سرور.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && user) load();
  }, [open, user]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return teams;
    return teams.filter((t) => `${t.name} ${t.city} ${t.sport}`.includes(q));
  }, [teams, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= teamCount) return prev;
      return [...prev, id];
    });
  }

  function apply() {
    const chosen = selected
      .map((id) => teams.find((t) => t.id === id))
      .filter((t): t is TeamItem => Boolean(t));
    const nextNames = Array.from({ length: teamCount }, (_, i) => currentNames[i] || "");
    const nextIds: (string | null)[] = Array.from({ length: teamCount }, (_, i) => currentIds[i] ?? null);
    const emptyIdx: number[] = [];
    nextNames.forEach((n, i) => {
      if (!n.trim()) emptyIdx.push(i);
    });
    let si = 0;
    for (const idx of emptyIdx) {
      if (si >= chosen.length) break;
      nextNames[idx] = chosen[si].name;
      nextIds[idx] = chosen[si].id;
      si++;
    }
    if (si < chosen.length) {
      const used = new Set(emptyIdx.slice(0, si));
      for (let i = 0; i < teamCount && si < chosen.length; i++) {
        if (used.has(i)) continue;
        nextNames[i] = chosen[si].name;
        nextIds[i] = chosen[si].id;
        si++;
      }
    }
    onApply(nextNames, nextIds);
    setOpen(false);
    setSelected([]);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!user) {
            openAuthModal("login");
            return;
          }
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/40 bg-sky-50 px-3.5 py-2 text-xs font-black text-sky-900 hover:bg-sky-100 transition-colors shadow-2xs cursor-pointer"
        title="انتخاب از تیم‌های ذخیره‌شده حساب کاربری"
      >
        <span>🛡️ از تیم‌های من</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-950/40 p-3 sm:p-6" onClick={() => setOpen(false)}>
          <div className="relative my-8 w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="font-black text-slate-900">انتخاب از تیم‌های ذخیره‌شده</h3>
                <p className="text-xs text-slate-500 mt-1">
                  خانه‌های خالی اول پر می‌شوند. ظرفیت این مسابقه {toPersianDigits(teamCount)} تیم است.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جستجوی نام تیم…"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
              <Link href="/teams/" className="shrink-0 text-xs font-black text-emerald-700 hover:underline">
                مدیریت تیم‌ها
              </Link>
            </div>
            {error && <div className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</div>}
            {loading ? (
              <p className="text-sm text-slate-500">در حال بارگذاری…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-slate-500">
                تیمی یافت نشد. از صفحه «تیم‌های من» تیم بسازید.
              </p>
            ) : (
              <ul className="max-h-72 overflow-y-auto space-y-1.5">
                {filtered.map((t) => {
                  const checked = selected.includes(t.id);
                  return (
                    <li key={t.id}>
                      <label className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 cursor-pointer ${checked ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-300"}`}>
                        <span className="flex items-center gap-2">
                          <input type="checkbox" checked={checked} onChange={() => toggle(t.id)} className="accent-emerald-600" />
                          <span>
                            <span className="block text-sm font-black text-slate-900">{t.name}</span>
                            <span className="text-[11px] text-slate-500">
                              {t.sport}
                              {t.city ? ` • ${t.city}` : ""} • {toPersianDigits(t.player_count || 0)} بازیکن
                            </span>
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">انتخاب‌شده: {toPersianDigits(selected.length)}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold">
                  انصراف
                </button>
                <button
                  type="button"
                  disabled={selected.length === 0}
                  onClick={apply}
                  className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-40"
                >
                  درج در فهرست
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
