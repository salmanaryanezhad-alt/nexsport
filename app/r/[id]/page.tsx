"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { NexSportIcon } from "@/components/NexSportLogo";
import { AuthHeaderNav } from "@/components/auth/AuthHeaderNav";
import { useAuth } from "@/components/auth/AuthContext";
import { PlayerFields } from "@/components/teams/TeamFields";
import { emptyPlayerForm } from "@/components/teams/teamTypes";
import { toPersianDigits } from "@/lib/digits";

type PlayerForm = typeof emptyPlayerForm;

export default function PublicRegistrationPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { user } = useAuth();
  const [info, setInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [shortName, setShortName] = useState("");
  const [city, setCity] = useState("");
  const [coach, setCoach] = useState("");
  const [contactName, setContactName] = useState("");
  const [mobile, setMobile] = useState("");
  const [notes, setNotes] = useState("");
  const [players, setPlayers] = useState<PlayerForm[]>([{ ...emptyPlayerForm }]);
  const [myTeams, setMyTeams] = useState<any[]>([]);

  async function load() {
    setError(null);
    const res = await fetch(`/api/registrations/public/${id}/`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "امکان ثبت‌نام وجود ندارد.");
      setInfo(null);
      return;
    }
    setInfo(data);
  }

  useEffect(() => {
    if (id) load().catch(() => setError("خطا در دریافت مسابقه."));
  }, [id]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/teams/", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { teams: [] }))
      .then((d) => setMyTeams(Array.isArray(d.teams) ? d.teams : []))
      .catch(() => {});
  }, [user]);

  async function fillFromSaved(teamId: string) {
    if (!teamId) return;
    const res = await fetch(`/api/teams/${teamId}/`, { credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.team) return;
    setTeamName(data.team.name || "");
    setShortName(data.team.short_name || "");
    setCity(data.team.city || "");
    setCoach(data.team.coach || "");
    const roster = Array.isArray(data.players) ? data.players : [];
    setPlayers(
      roster.length
        ? roster.map((p: any) => ({
            name: p.name || "",
            jersey_number: p.jersey_number || "",
            position: p.position || "",
            birth_date: p.birth_date || "",
            mobile: p.mobile || "",
            national_id: p.national_id || "",
            status: p.status || "active",
          }))
        : [{ ...emptyPlayerForm }]
    );
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/registrations/public/${id}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_name: teamName,
          short_name: shortName,
          city,
          coach,
          contact_name: contactName,
          mobile,
          notes,
          players,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "ارسال ثبت‌نام ناموفق بود.");
        return;
      }
      setDone(true);
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium focus:border-emerald-500 focus:outline-none";

  return (
    <div className="min-h-screen bg-chalk text-ink">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <NexSportIcon className="w-8 h-8" />
            <span className="font-black">Nex<span className="text-emerald-700">Sport</span></span>
          </Link>
          <AuthHeaderNav />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 space-y-5">
        <h1 className="text-2xl font-black">{info?.tournament?.title || "ثبت‌نام مسابقه"}</h1>
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-800">{error}</div>}
        {info && (
          <p className="text-sm text-slate-600">
            ظرفیت: {toPersianDigits(info.capacity)} تیم — باقی‌مانده: {toPersianDigits(info.remaining)}
            {info.isClosed ? " — ثبت‌نام بسته است" : info.isFull ? " — ظرفیت تکمیل است" : ""}
          </p>
        )}

        {done ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 space-y-2">
            <h2 className="font-black text-emerald-950">درخواست شما ارسال شد</h2>
            <p className="text-sm text-emerald-900">پس از بررسی و تأیید برگزارکننده، وضعیت ثبت‌نام نهایی می‌شود.</p>
          </div>
        ) : info?.isOpen ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-card">
            {user && myTeams.length > 0 && (
              <label className="block text-xs font-bold text-slate-600">
                پر کردن از تیم‌های من
                <select className={`${input} mt-1`} defaultValue="" onChange={(e) => fillFromSaved(e.target.value)}>
                  <option value="">انتخاب تیم ذخیره‌شده</option>
                  {myTeams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold sm:col-span-2">نام تیم *
                <input className={`${input} mt-1`} value={teamName} onChange={(e) => setTeamName(e.target.value)} />
              </label>
              <label className="text-xs font-bold">نام کوتاه
                <input className={`${input} mt-1`} value={shortName} onChange={(e) => setShortName(e.target.value)} />
              </label>
              <label className="text-xs font-bold">شهر
                <input className={`${input} mt-1`} value={city} onChange={(e) => setCity(e.target.value)} />
              </label>
              <label className="text-xs font-bold">مربی
                <input className={`${input} mt-1`} value={coach} onChange={(e) => setCoach(e.target.value)} />
              </label>
              <label className="text-xs font-bold">نام مسئول تیم
                <input className={`${input} mt-1`} value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </label>
              <label className="text-xs font-bold sm:col-span-2">موبایل مسئول *
                <input className={`${input} mt-1 dir-ltr text-right`} value={mobile} onChange={(e) => setMobile(e.target.value)} />
              </label>
              <label className="text-xs font-bold sm:col-span-2">یادداشت
                <textarea className={`${input} mt-1`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-black">بازیکنان</h2>
                <button type="button" onClick={() => setPlayers((p) => [...p, { ...emptyPlayerForm }])} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-black text-white">
                  ＋ بازیکن
                </button>
              </div>
              {players.map((p, i) => (
                <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>بازیکن {toPersianDigits(i + 1)}</span>
                    {players.length > 1 && (
                      <button type="button" className="text-rose-600" onClick={() => setPlayers((list) => list.filter((_, j) => j !== i))}>حذف</button>
                    )}
                  </div>
                  <PlayerFields value={p} onChange={(next) => setPlayers((list) => list.map((row, j) => (j === i ? next : row)))} />
                </div>
              ))}
            </div>

            <button type="button" disabled={saving} onClick={submit} className="w-full rounded-2xl bg-emerald-700 py-3 text-sm font-black text-white disabled:opacity-40">
              {saving ? "در حال ارسال..." : "ارسال ثبت‌نام"}
            </button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
