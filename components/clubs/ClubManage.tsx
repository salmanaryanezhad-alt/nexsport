"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { toPersianDigits } from "@/lib/digits";
import { TEAM_SPORTS } from "@/lib/teams/catalog";
import { CLUB_COACH_TITLES, clubRoleLabel } from "@/lib/clubs/roles";
import { TeamItem } from "@/components/teams/teamTypes";

type Section = "info" | "teams" | "players" | "coaches" | "tournaments" | "members";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "info", label: "مشخصات" },
  { id: "teams", label: "تیم‌ها" },
  { id: "players", label: "بازیکنان" },
  { id: "coaches", label: "مربیان" },
  { id: "tournaments", label: "مسابقات" },
  { id: "members", label: "اعضا" },
];

const input = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium focus:border-emerald-500 focus:outline-none";

export function ClubManage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");
  const { user, loading, openAuthModal } = useAuth();
  const [section, setSection] = useState<Section>("info");
  const [data, setData] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [libraryTeams, setLibraryTeams] = useState<TeamItem[]>([]);
  const [myTournaments, setMyTournaments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [coachForm, setCoachForm] = useState({ name: "", title: "سرمربی", mobile: "", notes: "" });
  const [invite, setInvite] = useState({ identifier: "", role: "member" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/clubs/${id}/`, { credentials: "same-origin" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "باشگاه یافت نشد.");
      setData(null);
      return;
    }
    setData(json);
    setForm({
      name: json.club.name || "",
      short_name: json.club.short_name || "",
      sport: json.club.sport || "فوتبال",
      city: json.club.city || "",
      founded_year: json.club.founded_year || "",
      venue: json.club.venue || "",
      description: json.club.description || "",
      contact_name: json.club.contact_name || "",
      mobile: json.club.mobile || "",
    });
    if (json.canEdit || json.myRole) {
      const mres = await fetch(`/api/clubs/${id}/members/`, { credentials: "same-origin" });
      const mjson = await mres.json().catch(() => ({}));
      if (mres.ok) setMembers(Array.isArray(mjson.members) ? mjson.members : []);
    }
  }, [id]);

  useEffect(() => {
    if (user && id) load().catch(() => setError("خطا در دریافت باشگاه."));
  }, [user, id, load]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/teams/", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { teams: [] }))
      .then((d) => setLibraryTeams(Array.isArray(d.teams) ? d.teams : []))
      .catch(() => {});
    fetch("/api/tournaments/", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { tournaments: [] }))
      .then((d) => setMyTournaments(Array.isArray(d.tournaments) ? d.tournaments : []))
      .catch(() => {});
  }, [user]);

  if (loading) return <p className="text-sm font-bold text-slate-500">در حال بررسی حساب…</p>;
  if (!user) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 space-y-2">
        <p className="font-black">برای مدیریت باشگاه وارد شوید.</p>
        <button type="button" onClick={() => openAuthModal("login")} className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white">ورود</button>
      </div>
    );
  }
  if (error && !data) return <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-800">{error}</div>;
  if (!data) return <p className="text-sm font-bold text-slate-500">در حال بارگذاری…</p>;
  if (!data.canEdit && data.myStatus !== "active") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 space-y-2">
        <p className="font-black">دسترسی مدیریت این باشگاه را ندارید.</p>
        <Link href={`/c/${id}`} className="text-xs font-black text-emerald-800">مشاهده صفحه باشگاه</Link>
      </div>
    );
  }

  const canEdit = Boolean(data.canEdit);

  async function saveInfo() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/clubs/${id}/`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(json.error || "ذخیره ناموفق."); return; }
    setMessage("مشخصات باشگاه ذخیره شد.");
    await load();
  }

  async function attachTeam(teamId: string) {
    const res = await fetch(`/api/clubs/${id}/teams/`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error || "اتصال تیم ناموفق."); return; }
    await load();
  }

  async function detachTeam(teamId: string) {
    await fetch(`/api/clubs/${id}/teams/?teamId=${encodeURIComponent(teamId)}`, { method: "DELETE", credentials: "same-origin" });
    await load();
  }

  async function attachTournament(tournamentId: string) {
    const res = await fetch(`/api/clubs/${id}/tournaments/`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error || "اتصال مسابقه ناموفق."); return; }
    await load();
  }

  async function detachTournament(tournamentId: string) {
    await fetch(`/api/clubs/${id}/tournaments/?tournamentId=${encodeURIComponent(tournamentId)}`, { method: "DELETE", credentials: "same-origin" });
    await load();
  }

  async function addCoach() {
    const res = await fetch(`/api/clubs/${id}/coaches/`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(coachForm),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error || "ثبت مربی ناموفق."); return; }
    setCoachForm({ name: "", title: "سرمربی", mobile: "", notes: "" });
    await load();
  }

  async function removeCoach(coachId: string) {
    await fetch(`/api/clubs/${id}/coaches/?id=${encodeURIComponent(coachId)}`, { method: "DELETE", credentials: "same-origin" });
    await load();
  }

  async function inviteMember() {
    const res = await fetch(`/api/clubs/${id}/members/`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invite),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error || "دعوت ناموفق."); return; }
    setMessage(json.message || "دعوت ارسال شد.");
    setInvite({ identifier: "", role: "member" });
    await load();
  }

  async function removeMember(memberId: string) {
    await fetch(`/api/clubs/${id}/members/?memberId=${encodeURIComponent(memberId)}`, { method: "DELETE", credentials: "same-origin" });
    await load();
  }

  async function changeRole(memberId: string, role: string) {
    const res = await fetch(`/api/clubs/${id}/members/`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "role", memberId, role }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error || "تغییر نقش ناموفق."); return; }
    await load();
  }

  async function deleteClub() {
    if (!window.confirm("باشگاه و تمام اتصالات آن حذف شود؟ تیم‌ها و مسابقات کتابخانه پاک نمی‌شوند.")) return;
    const res = await fetch(`/api/clubs/${id}/`, { method: "DELETE", credentials: "same-origin" });
    if (res.ok) router.push("/panel?tab=clubs");
  }

  const attachedTeamIds = new Set((data.teams || []).map((t: any) => t.id));
  const attachedTIds = new Set((data.tournaments || []).map((t: any) => t.id));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">{data.club.name}</h1>
          <p className="text-xs text-slate-500">نقش شما: {data.roleLabel || "عضو"}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/c/${id}`} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-black">صفحه اختصاصی</Link>
          {canEdit && data.club && (
            <button type="button" onClick={deleteClub} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700">حذف باشگاه</button>
          )}
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto">
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" onClick={() => setSection(s.id)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black ${section === s.id ? "bg-emerald-700 text-white" : "bg-white border border-slate-200"}`}>
            {s.label}
          </button>
        ))}
      </nav>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">{message}</div>}

      {section === "info" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold sm:col-span-2">نام باشگاه
            <input className={`${input} mt-1`} value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!canEdit} />
          </label>
          <label className="text-xs font-bold">نام کوتاه
            <input className={`${input} mt-1`} value={form.short_name || ""} onChange={(e) => setForm({ ...form, short_name: e.target.value })} disabled={!canEdit} />
          </label>
          <label className="text-xs font-bold">رشته
            <select className={`${input} mt-1`} value={form.sport || "فوتبال"} onChange={(e) => setForm({ ...form, sport: e.target.value })} disabled={!canEdit}>
              {TEAM_SPORTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold">شهر
            <input className={`${input} mt-1`} value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} disabled={!canEdit} />
          </label>
          <label className="text-xs font-bold">سال تأسیس (شمسی)
            <input className={`${input} mt-1`} value={form.founded_year || ""} onChange={(e) => setForm({ ...form, founded_year: e.target.value })} disabled={!canEdit} />
          </label>
          <label className="text-xs font-bold">محل تمرین / ورزشگاه
            <input className={`${input} mt-1`} value={form.venue || ""} onChange={(e) => setForm({ ...form, venue: e.target.value })} disabled={!canEdit} />
          </label>
          <label className="text-xs font-bold">نام رابط
            <input className={`${input} mt-1`} value={form.contact_name || ""} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} disabled={!canEdit} />
          </label>
          <label className="text-xs font-bold sm:col-span-2">درباره باشگاه
            <textarea className={`${input} mt-1`} rows={3} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={!canEdit} />
          </label>
          {canEdit && <button type="button" disabled={saving} onClick={saveInfo} className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50">ذخیره مشخصات</button>}
        </div>
      )}

      {section === "teams" && (
        <div className="space-y-3">
          {canEdit && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold mb-2">اتصال از کتابخانه تیم‌های من</p>
              <select className={input} defaultValue="" onChange={(e) => { if (e.target.value) attachTeam(e.target.value); e.target.value = ""; }}>
                <option value="">انتخاب تیم</option>
                {libraryTeams.filter((t) => !attachedTeamIds.has(t.id)).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
          {(data.teams || []).map((t: any) => (
            <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex justify-between items-center">
              <div>
                <div className="font-black">{t.name}</div>
                <p className="text-[11px] text-slate-500">{t.sport} • {toPersianDigits(t.player_count || 0)} بازیکن</p>
              </div>
              {canEdit && <button type="button" onClick={() => detachTeam(t.id)} className="text-xs font-black text-rose-700">جدا کردن</button>}
            </div>
          ))}
        </div>
      )}

      {section === "players" && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-xs">
            <thead className="bg-slate-50"><tr>{["بازیکن", "تیم", "شماره", "پست"].map((h) => <th key={h} className="px-3 py-2 text-right font-black">{h}</th>)}</tr></thead>
            <tbody>
              {(data.players || []).map((p: any) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-black">{p.name}</td>
                  <td className="px-3 py-2">{p.team_name}</td>
                  <td className="px-3 py-2">{p.jersey_number ? toPersianDigits(p.jersey_number) : "—"}</td>
                  <td className="px-3 py-2">{p.position || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data.players || []).length === 0 && <p className="p-4 text-slate-500 text-sm">بازیکنی نیست. ابتدا تیم وصل کنید و در کتابخانه تیم بازیکن اضافه کنید.</p>}
        </div>
      )}

      {section === "coaches" && (
        <div className="space-y-3">
          {canEdit && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 grid gap-2 sm:grid-cols-2">
              <input className={input} placeholder="نام مربی" value={coachForm.name} onChange={(e) => setCoachForm({ ...coachForm, name: e.target.value })} />
              <select className={input} value={coachForm.title} onChange={(e) => setCoachForm({ ...coachForm, title: e.target.value })}>
                {CLUB_COACH_TITLES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <input className={input} placeholder="موبایل (اختیاری)" value={coachForm.mobile} onChange={(e) => setCoachForm({ ...coachForm, mobile: e.target.value })} />
              <input className={input} placeholder="یادداشت" value={coachForm.notes} onChange={(e) => setCoachForm({ ...coachForm, notes: e.target.value })} />
              <button type="button" onClick={addCoach} className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white">ثبت مربی</button>
            </div>
          )}
          {(data.coaches || []).map((c: any) => (
            <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex justify-between">
              <div>
                <div className="font-black">{c.name}</div>
                <p className="text-[11px] text-slate-500">{c.title}</p>
              </div>
              {canEdit && <button type="button" onClick={() => removeCoach(c.id)} className="text-xs font-black text-rose-700">حذف</button>}
            </div>
          ))}
        </div>
      )}

      {section === "tournaments" && (
        <div className="space-y-3">
          {canEdit && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold mb-2">اتصال مسابقه ذخیره‌شده</p>
              <select className={input} defaultValue="" onChange={(e) => { if (e.target.value) attachTournament(e.target.value); e.target.value = ""; }}>
                <option value="">انتخاب مسابقه</option>
                {myTournaments.filter((t) => !attachedTIds.has(t.id)).map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
          )}
          {(data.tournaments || []).map((t: any) => (
            <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex justify-between items-center">
              <div>
                <div className="font-black">{t.title}</div>
                <p className="text-[11px] text-slate-500">{t.formatLabel}</p>
              </div>
              <div className="flex gap-2">
                {t.spectatorPaid && <Link href={`/t/${t.id}`} className="text-xs font-black text-sky-800">تماشاگر</Link>}
                {canEdit && <button type="button" onClick={() => detachTournament(t.id)} className="text-xs font-black text-rose-700">جدا کردن</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {section === "members" && (
        <div className="space-y-3">
          {canEdit && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 grid gap-2 sm:grid-cols-3">
              <input className={input} placeholder="ایمیل یا موبایل عضو" value={invite.identifier} onChange={(e) => setInvite({ ...invite, identifier: e.target.value })} />
              <select className={input} value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
                <option value="member">عضو</option>
                <option value="coach">مربی</option>
                <option value="manager">مدیر باشگاه</option>
              </select>
              <button type="button" onClick={inviteMember} className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white">ارسال دعوت</button>
            </div>
          )}
          {members.map((m) => (
            <div key={m.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap justify-between gap-2">
              <div>
                <div className="font-black">{m.name || "کاربر"} <span className="text-[10px] font-bold text-slate-500">{m.roleLabel}</span></div>
                <p className="text-[11px] text-slate-500">{m.status === "pending" ? "در انتظار پذیرش" : "فعال"} {m.email ? `• ${m.email}` : ""}</p>
              </div>
              {canEdit && m.role !== "owner" && (
                <div className="flex gap-2 items-center">
                  <select className="rounded-lg border border-slate-200 text-xs px-2 py-1" value={m.role} onChange={(e) => changeRole(m.id, e.target.value)}>
                    <option value="member">عضو</option>
                    <option value="coach">مربی</option>
                    <option value="manager">مدیر</option>
                  </select>
                  <button type="button" onClick={() => removeMember(m.id)} className="text-xs font-black text-rose-700">حذف</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
