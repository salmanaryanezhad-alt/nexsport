"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { TeamsChrome } from "@/components/teams/TeamsChrome";
import { PlayerFields, TeamFields } from "@/components/teams/TeamFields";
import { emptyPlayerForm, emptyTeamForm, PlayerItem, TeamItem } from "@/components/teams/teamTypes";
import { playerStatusLabel } from "@/lib/teams/catalog";
import { toPersianDigits } from "@/lib/digits";
import { formatDateJalali, parseGregorianYmd } from "@/lib/jalali";

type LinkedTournament = { id: string; title: string; format: string; updated_at: string };

function birthLabel(ymd?: string) {
  if (!ymd) return "—";
  const d = parseGregorianYmd(ymd);
  return d ? formatDateJalali(d) : ymd;
}

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");
  const { user, loading, openAuthModal } = useAuth();
  const [team, setTeam] = useState<TeamItem | null>(null);
  const [players, setPlayers] = useState<PlayerItem[]>([]);
  const [tournaments, setTournaments] = useState<LinkedTournament[]>([]);
  const [form, setForm] = useState(emptyTeamForm);
  const [playerForm, setPlayerForm] = useState(emptyPlayerForm);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [showPlayerForm, setShowPlayerForm] = useState(false);

  async function load() {
    if (!id) return;
    setError(null);
    const res = await fetch(`/api/teams/${id}/`, { credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "تیم یافت نشد.");
      setTeam(null);
      return;
    }
    setTeam(data.team);
    setPlayers(Array.isArray(data.players) ? data.players : []);
    setTournaments(Array.isArray(data.tournaments) ? data.tournaments : []);
    const t = data.team;
    setForm({
      name: t.name || "",
      short_name: t.short_name || "",
      sport: t.sport || "فوتبال",
      city: t.city || "",
      founded_year: t.founded_year || "",
      kit_home: t.kit_home || "",
      kit_away: t.kit_away || "",
      coach: t.coach || "",
      description: t.description || "",
    });
  }

  useEffect(() => {
    if (user && id) {
      load().catch(() => setError("خطا در دریافت تیم."));
    }
  }, [user, id]);

  async function saveTeam() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/teams/${id}/`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "ذخیره مشخصات ناموفق بود.");
        return;
      }
      setMessage("مشخصات تیم ذخیره شد.");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function deleteTeam() {
    if (!confirm("حذف این تیم و تمام بازیکنان آن قطعی است. ادامه می‌دهید؟")) return;
    const res = await fetch(`/api/teams/${id}/`, { method: "DELETE", credentials: "same-origin" });
    if (res.ok) router.push("/teams/");
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "حذف تیم ناموفق بود.");
    }
  }

  function startEditPlayer(p: PlayerItem) {
    setEditingPlayerId(p.id);
    setPlayerForm({
      name: p.name,
      jersey_number: p.jersey_number,
      position: p.position,
      birth_date: p.birth_date,
      mobile: p.mobile,
      national_id: p.national_id,
      status: p.status || "active",
    });
    setShowPlayerForm(true);
  }

  function startNewPlayer() {
    setEditingPlayerId(null);
    setPlayerForm(emptyPlayerForm);
    setShowPlayerForm(true);
  }

  async function savePlayer() {
    setSavingPlayer(true);
    setError(null);
    setMessage(null);
    try {
      const url = editingPlayerId ? `/api/teams/${id}/players/${editingPlayerId}/` : `/api/teams/${id}/players/`;
      const res = await fetch(url, {
        method: editingPlayerId ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(playerForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "ثبت بازیکن ناموفق بود.");
        return;
      }
      setShowPlayerForm(false);
      setEditingPlayerId(null);
      setPlayerForm(emptyPlayerForm);
      setMessage(editingPlayerId ? "بازیکن ویرایش شد." : "بازیکن به فهرست اضافه شد.");
      await load();
    } finally {
      setSavingPlayer(false);
    }
  }

  async function deletePlayer(playerId: string) {
    if (!confirm("این بازیکن از فهرست تیم حذف شود؟")) return;
    const res = await fetch(`/api/teams/${id}/players/${playerId}/`, { method: "DELETE", credentials: "same-origin" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "حذف بازیکن ناموفق بود.");
      return;
    }
    await load();
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
          <h1 className="text-xl font-black">ورود لازم است</h1>
          <p className="text-sm text-slate-600">برای مشاهده و ویرایش تیم ابتدا وارد شوید.</p>
          <button type="button" onClick={() => openAuthModal("login")} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white">
            ورود
          </button>
        </div>
      </TeamsChrome>
    );
  }

  return (
    <TeamsChrome>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/teams/" className="text-xs font-bold text-emerald-700 hover:underline">
            ← بازگشت به تیم‌های من
          </Link>
          <h1 className="text-2xl font-black text-slate-900 mt-1">{team?.name || "تیم"}</h1>
        </div>
        <button type="button" onClick={deleteTeam} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100">
          حذف تیم
        </button>
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-800">{error}</div>}
      {message && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800">{message}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card space-y-4 mb-6">
        <h2 className="font-black text-slate-900">مشخصات تیم</h2>
        <TeamFields value={form} onChange={setForm} />
        <div className="flex justify-end">
          <button type="button" disabled={saving} onClick={saveTeam} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-40">
            {saving ? "در حال ذخیره…" : "ذخیره مشخصات"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card space-y-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-black text-slate-900">فهرست بازیکنان ({toPersianDigits(players.length)})</h2>
          <button type="button" onClick={startNewPlayer} className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-3.5 py-1.5 text-xs font-black text-white">
            ＋ بازیکن جدید
          </button>
        </div>

        {showPlayerForm && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
            <h3 className="text-sm font-black text-emerald-950">{editingPlayerId ? "ویرایش بازیکن" : "ثبت بازیکن"}</h3>
            <PlayerFields value={playerForm} onChange={setPlayerForm} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowPlayerForm(false)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold">
                انصراف
              </button>
              <button type="button" disabled={savingPlayer} onClick={savePlayer} className="rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-black text-white disabled:opacity-40">
                {savingPlayer ? "…" : "ذخیره بازیکن"}
              </button>
            </div>
          </div>
        )}

        {players.length === 0 ? (
          <p className="text-sm text-slate-500">هنوز بازیکنی ثبت نشده است.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-xs text-slate-500 border-b border-slate-100">
                  <th className="py-2 font-bold">#</th>
                  <th className="py-2 font-bold">نام</th>
                  <th className="py-2 font-bold">پست</th>
                  <th className="py-2 font-bold">تولد</th>
                  <th className="py-2 font-bold">موبایل</th>
                  <th className="py-2 font-bold">کد ملی</th>
                  <th className="py-2 font-bold">وضعیت</th>
                  <th className="py-2 font-bold"></th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50">
                    <td className="py-2 font-black text-slate-700">{p.jersey_number ? toPersianDigits(p.jersey_number) : "—"}</td>
                    <td className="py-2 font-bold">{p.name}</td>
                    <td className="py-2 text-slate-600">{p.position || "—"}</td>
                    <td className="py-2 text-slate-600">{birthLabel(p.birth_date)}</td>
                    <td className="py-2 dir-ltr text-right text-slate-600">{p.mobile || "—"}</td>
                    <td className="py-2 dir-ltr text-right text-slate-600">{p.national_id ? toPersianDigits(p.national_id) : "—"}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${p.status === "injured" ? "bg-amber-50 text-amber-800" : p.status === "inactive" ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-800"}`}>
                        {playerStatusLabel(p.status)}
                      </span>
                    </td>
                    <td className="py-2 text-left whitespace-nowrap">
                      <button type="button" onClick={() => startEditPlayer(p)} className="text-xs font-bold text-emerald-700 hover:underline ml-2">
                        ویرایش
                      </button>
                      <button type="button" onClick={() => deletePlayer(p.id)} className="text-xs font-bold text-rose-600 hover:underline">
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card space-y-3">
        <h2 className="font-black text-slate-900">مسابقات مرتبط</h2>
        {tournaments.length === 0 ? (
          <p className="text-sm text-slate-500">این تیم هنوز در مسابقه ذخیره‌شده‌ای استفاده نشده است.</p>
        ) : (
          <ul className="space-y-2">
            {tournaments.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                <span className="font-bold text-slate-800">{t.title}</span>
                <span className="text-xs text-slate-500">{formatDateJalali(new Date(t.updated_at))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </TeamsChrome>
  );
}
