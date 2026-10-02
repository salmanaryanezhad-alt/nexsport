"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { toPersianDigits } from "@/lib/digits";
import { formatDateJalali } from "@/lib/jalali";
import { hasPersianLetters } from "@/lib/auth/utils";
import { TeamFields } from "@/components/teams/TeamFields";
import { emptyTeamForm, TeamItem } from "@/components/teams/teamTypes";
import { TEAM_SPORTS } from "@/lib/teams/catalog";
import { clubRoleLabel } from "@/lib/clubs/roles";
import { StoreModal } from "@/components/planner/StoreModal";

type TabId = "dashboard" | "tournaments" | "teams" | "clubs" | "registrations" | "reports" | "profile";

type Overview = {
  profile: { name: string; email: string; mobile: string; role: string; createdAt?: string };
  quota: {
    planningCredits: number;
    isVip: boolean;
    isClubPro?: boolean;
    unlimitedPlanning: boolean;
    vipExpiresAt: string | null;
    clubProExpiresAt?: string | null;
    freeLinkAvailable: boolean;
  };
  stats: {
    tournamentCount: number;
    teamCount: number;
    playerCount: number;
    pendingRegistrations: number;
    approvedRegistrations: number;
    rejectedRegistrations: number;
    spectatorLinks: number;
    registrationLinks: number;
    matchesTotal: number;
    matchesPlayed: number;
  };
  tournaments: Array<{
    id: string;
    title: string;
    format: string;
    formatLabel: string;
    sport: string;
    teamCount: number;
    step: number;
    spectatorPaid: boolean;
    registrationPaid: boolean;
    registrationOpen: boolean;
    registrationCapacity: number;
    matchesTotal: number;
    matchesPlayed: number;
    createdAt: string;
    updatedAt: string;
  }>;
  registrations: Array<{
    id: string;
    tournament_id: string;
    tournament_title: string;
    team_name: string;
    city: string;
    contact_name: string;
    mobile: string;
    notes: string;
    status: "pending" | "approved" | "rejected";
    reject_reason: string;
    roster: Array<{ name: string; jersey_number: string; position: string }>;
    created_at: string;
  }>;
};

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "dashboard", label: "داشبورد", icon: "📊" },
  { id: "tournaments", label: "مسابقات", icon: "🏆" },
  { id: "teams", label: "تیم‌ها و بازیکنان", icon: "🛡️" },
  { id: "clubs", label: "باشگاه‌ها", icon: "🏟️" },
  { id: "registrations", label: "ثبت‌نام‌ها", icon: "📝" },
  { id: "reports", label: "گزارش و آمار", icon: "📈" },
  { id: "profile", label: "پروفایل برگزارکننده", icon: "👤" },
];

function jalali(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDateJalali(d);
}

function StatusPill({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${ok ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
      {ok ? yes : no}
    </span>
  );
}

export function OrganizerPanel() {
  const { user, loading, openAuthModal, updateProfile, changePassword, isAdmin } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = (searchParams.get("tab") || "dashboard") as TabId;
  const tab: TabId = TABS.some((t) => t.id === tabParam) ? tabParam : "dashboard";

  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [clubInvites, setClubInvites] = useState<any[]>([]);
  const [showCreateClub, setShowCreateClub] = useState(false);
  const [clubForm, setClubForm] = useState({ name: "", city: "", sport: "فوتبال" });
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [teamForm, setTeamForm] = useState(emptyTeamForm);
  const [expandedReg, setExpandedReg] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [storeOpen, setStoreOpen] = useState(false);
  const [payBanner, setPayBanner] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const setTab = useCallback(
    (id: TabId) => {
      router.replace(`/panel?tab=${id}`, { scroll: false });
    },
    [router]
  );

  const load = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/organizer/overview/", { credentials: "same-origin" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "خطا در دریافت پنل.");
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setError("خطا در برقراری ارتباط با سرور.");
    } finally {
      setFetching(false);
    }
  }, []);

  const loadTeams = useCallback(async () => {
    const res = await fetch("/api/teams/", { credentials: "same-origin" });
    const json = await res.json().catch(() => ({}));
    if (res.ok) setTeams(Array.isArray(json.teams) ? json.teams : []);
  }, []);

  const loadClubs = useCallback(async () => {
    const res = await fetch("/api/clubs/", { credentials: "same-origin" });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setClubs(Array.isArray(json.clubs) ? json.clubs : []);
      setClubInvites(Array.isArray(json.invites) ? json.invites : []);
    }
  }, []);

  useEffect(() => {
    if (user) {
      load();
      loadTeams();
      loadClubs();
      setName(user.name);
    }
  }, [user, load, loadTeams, loadClubs]);

  useEffect(() => {
    const status = searchParams.get("payment_status");
    const itemType = searchParams.get("itemType");
    if (status === "success") {
      setPayBanner(
        itemType === "club_pro"
          ? "اشتراک Club Pro با موفقیت فعال شد."
          : "پرداخت با موفقیت انجام شد."
      );
      if (itemType === "club_pro") setStoreOpen(true);
    }
  }, [searchParams]);

  const pendingRegs = useMemo(
    () => (data?.registrations || []).filter((r) => r.status === "pending"),
    [data]
  );

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  }

  async function deleteTournament(id: string, title: string) {
    if (!window.confirm(`مسابقه «${title}» حذف شود؟ این کار قابل بازگشت نیست.`)) return;
    const res = await fetch(`/api/tournaments/${id}/`, { method: "DELETE", credentials: "same-origin" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "حذف مسابقه ناموفق بود.");
      return;
    }
    await load();
  }

  async function setRegStatus(tournamentId: string, id: string, status: "approved" | "rejected") {
    const reason = status === "rejected" ? window.prompt("دلیل رد (اختیاری):") || "" : "";
    const res = await fetch(`/api/tournaments/${tournamentId}/registrations/${id}/`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reject_reason: reason }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "تغییر وضعیت ناموفق بود.");
      return;
    }
    await load();
  }

  async function createTeam() {
    const res = await fetch("/api/teams/", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(teamForm),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "ثبت تیم ناموفق بود.");
      return;
    }
    setTeamForm(emptyTeamForm);
    setShowCreateTeam(false);
    await Promise.all([loadTeams(), load()]);
  }

  if (loading) {
    return <p className="text-sm font-bold text-slate-500">در حال بررسی حساب کاربری…</p>;
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 space-y-3 max-w-lg">
        <h1 className="text-xl font-black text-amber-950">ورود به پنل برگزارکننده</h1>
        <p className="text-sm text-amber-900">برای مدیریت مسابقات، تیم‌ها و ثبت‌نام‌ها وارد حساب شوید.</p>
        <button
          type="button"
          onClick={() => openAuthModal("login")}
          className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-black text-white"
        >
          ورود / ثبت‌نام
        </button>
      </div>
    );
  }

  const stats = data?.stats;
  const origin = typeof window !== "undefined" ? window.location.origin : "https://nexsport.ir";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">پنل برگزارکننده</h1>
          <p className="text-sm text-slate-500 mt-1">
            سلام {user.name} — همه مسابقات، تیم‌ها و ثبت‌نام‌ها در یک جا.
          </p>
        </div>
        <Link
          href="/planner"
          className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white hover:bg-emerald-800"
        >
          ＋ مسابقه جدید
        </Link>
      </div>

      <nav className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black transition-colors ${
              tab === t.id ? "bg-emerald-700 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {t.icon} {t.label}
            {t.id === "registrations" && pendingRegs.length > 0 && (
              <span className="mr-1 rounded-full bg-amber-400 text-amber-950 px-1.5 text-[10px]">
                {toPersianDigits(pendingRegs.length)}
              </span>
            )}
          </button>
        ))}
      </nav>

      {payBanner && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800">{payBanner}</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-800">{error}</div>}
      {fetching && !data && <p className="text-sm font-bold text-slate-500">در حال بارگذاری پنل…</p>}

      {tab === "dashboard" && stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "مسابقات", value: stats.tournamentCount, href: "?tab=tournaments" },
              { label: "تیم‌های کتابخانه", value: stats.teamCount, href: "?tab=teams" },
              { label: "باشگاه‌ها", value: clubs.length, href: "?tab=clubs" },
              { label: "بازیکنان", value: stats.playerCount, href: "?tab=teams" },
              { label: "ثبت‌نام در انتظار", value: stats.pendingRegistrations, href: "?tab=registrations" },
              { label: "لینک تماشاگران", value: stats.spectatorLinks, href: "?tab=tournaments" },
              { label: "لینک ثبت‌نام", value: stats.registrationLinks, href: "?tab=tournaments" },
              { label: "بازی برگزارشده", value: stats.matchesPlayed, href: "?tab=reports" },
              { label: "کل بازی‌ها", value: stats.matchesTotal, href: "?tab=reports" },
            ].map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => router.replace(`/panel${c.href}`, { scroll: false })}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-right hover:border-emerald-300 hover:shadow-sm transition-all"
              >
                <div className="text-2xl font-black text-emerald-800">{toPersianDigits(c.value)}</div>
                <div className="text-[11px] font-bold text-slate-500 mt-1">{c.label}</div>
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap gap-3 items-center justify-between">
            <div className="text-sm">
              <span className="font-black">سهمیه برنامه‌سازی: </span>
              {data?.quota.unlimitedPlanning ? "نامحدود" : toPersianDigits(data?.quota.planningCredits ?? 0)}
              {data?.quota.isVip && <span className="mr-2 rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 text-[10px] font-black">VIP برگزارکننده</span>}
              {data?.quota.isClubPro && <span className="mr-2 rounded-full bg-indigo-100 text-indigo-900 px-2 py-0.5 text-[10px] font-black">Club Pro</span>}
              {isAdmin && <span className="mr-2 rounded-full bg-pitch text-white px-2 py-0.5 text-[10px] font-black">مدیر</span>}
            </div>
            <div className="flex gap-2">
              <Link href="/teams/" className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-black">تیم‌های من</Link>
              <Link href="/planner?open=saved" className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-black">مسابقات ذخیره‌شده</Link>
            </div>
          </div>
          {pendingRegs.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
              <h2 className="font-black text-amber-950">ثبت‌نام‌های در انتظار تأیید</h2>
              {pendingRegs.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span className="font-bold">{r.team_name} <span className="text-slate-500 font-medium">— {r.tournament_title}</span></span>
                  <button type="button" className="text-xs font-black text-violet-800" onClick={() => setTab("registrations")}>بررسی</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "tournaments" && data && (
        <div className="space-y-3">
          {data.tournaments.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-2">
              <p className="font-black">هنوز مسابقه‌ای ذخیره نکرده‌اید.</p>
              <Link href="/planner" className="inline-block rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white">شروع برنامه‌ریزی</Link>
            </div>
          )}
          {data.tournaments.map((t) => (
            <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-black text-slate-900">{t.title}</h3>
                  <p className="text-[11px] text-slate-500">
                    {t.formatLabel} • {toPersianDigits(t.teamCount)} تیم • به‌روزرسانی {jalali(t.updatedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <StatusPill ok={t.spectatorPaid} yes="لینک تماشاگر فعال" no="تماشاگر غیرفعال" />
                  <StatusPill ok={t.registrationPaid} yes="ثبت‌نام فعال" no="ثبت‌نام غیرفعال" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Link href={`/planner?load=${t.id}`} className="rounded-xl bg-emerald-700 px-3 py-1.5 font-black text-white">باز کردن در برنامه‌ریز</Link>
                {t.spectatorPaid && (
                  <button type="button" onClick={() => copy(`${origin}/t/${t.id}`, `t-${t.id}`)} className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 font-black text-sky-900">
                    {copied === `t-${t.id}` ? "کپی شد" : "کپی لینک تماشاگر"}
                  </button>
                )}
                {t.registrationPaid && (
                  <button type="button" onClick={() => copy(`${origin}/r/${t.id}`, `r-${t.id}`)} className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 font-black text-violet-900">
                    {copied === `r-${t.id}` ? "کپی شد" : "کپی لینک ثبت‌نام"}
                  </button>
                )}
                <button type="button" onClick={() => setTab("registrations")} className="rounded-xl border border-slate-200 px-3 py-1.5 font-black">ثبت‌نام‌ها</button>
                <button type="button" onClick={() => deleteTournament(t.id, t.title)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 font-black text-rose-700">حذف</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "teams" && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-black">کتابخانه تیم‌ها</h2>
            <button type="button" onClick={() => setShowCreateTeam((v) => !v)} className="rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-black text-white">
              {showCreateTeam ? "انصراف" : "＋ تیم جدید"}
            </button>
          </div>
          {showCreateTeam && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <TeamFields value={teamForm} onChange={setTeamForm} />
              <button type="button" onClick={createTeam} className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white">ثبت تیم</button>
            </div>
          )}
          {teams.length === 0 && <p className="text-sm text-slate-500">تیمی در کتابخانه نیست. از اینجا یا صفحه تیم‌ها اضافه کنید.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((t) => (
              <Link key={t.id} href={`/teams/${t.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-emerald-300 transition-colors">
                <div className="font-black">{t.name}</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {t.sport} {t.city ? `• ${t.city}` : ""} {t.player_count != null ? `• ${toPersianDigits(t.player_count)} بازیکن` : ""}
                </p>
                <p className="text-[11px] font-bold text-emerald-800 mt-2">مدیریت بازیکنان ←</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {tab === "clubs" && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-black">باشگاه‌های من</h2>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStoreOpen(true)} className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-800">
                Club Pro
              </button>
              <button type="button" onClick={() => setShowCreateClub((v) => !v)} className="rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-black text-white">
                {showCreateClub ? "انصراف" : "＋ ایجاد باشگاه"}
              </button>
            </div>
          </div>
          {showCreateClub && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 grid gap-2 sm:grid-cols-3">
              <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="نام باشگاه" value={clubForm.name} onChange={(e) => setClubForm({ ...clubForm, name: e.target.value })} />
              <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="شهر" value={clubForm.city} onChange={(e) => setClubForm({ ...clubForm, city: e.target.value })} />
              <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={clubForm.sport} onChange={(e) => setClubForm({ ...clubForm, sport: e.target.value })}>
                {TEAM_SPORTS.map((s) => <option key={s}>{s}</option>)}
              </select>
              <button
                type="button"
                className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white"
                onClick={async () => {
                  const res = await fetch("/api/clubs/", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(clubForm),
                  });
                  const json = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    setError(json.error || "ایجاد باشگاه ناموفق.");
                    if (json.needsClubPro) setStoreOpen(true);
                    return;
                  }
                  setClubForm({ name: "", city: "", sport: "فوتبال" });
                  setShowCreateClub(false);
                  await loadClubs();
                  if (json.club?.id) window.location.href = `/c/${json.club.id}/manage`;
                }}
              >
                ایجاد و ادامه
              </button>
            </div>
          )}
          {clubInvites.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
              <h3 className="font-black text-amber-950">دعوت‌های در انتظار</h3>
              {clubInvites.map((c) => (
                <div key={c.id} className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="font-bold">{c.name} — {clubRoleLabel(c.my_role)}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-lg bg-emerald-700 px-2 py-1 text-xs font-black text-white"
                      onClick={async () => {
                        await fetch(`/api/clubs/${c.id}/members/`, {
                          method: "PATCH",
                          credentials: "same-origin",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "accept" }),
                        });
                        await loadClubs();
                      }}
                    >
                      پذیرش
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-white px-2 py-1 text-xs font-black text-rose-700 border border-rose-200"
                      onClick={async () => {
                        await fetch(`/api/clubs/${c.id}/members/`, {
                          method: "PATCH",
                          credentials: "same-origin",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "decline" }),
                        });
                        await loadClubs();
                      }}
                    >
                      رد
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-slate-500">
            ایجاد باشگاه رایگان است. طرح رایگان: ۱ باشگاه، ۲ تیم، ۱۵ بازیکن، ۲ مربی. صفحه عمومی جداگانه فعال می‌شود (مثل لینک تماشاگر). VIP برگزارکننده شامل باشگاه نیست.
          </p>
          {clubs.length === 0 && <p className="text-sm text-slate-500">باشگاهی ندارید. یکی بسازید یا دعوت را بپذیرید.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {clubs.map((c) => (
              <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
                <div className="font-black flex items-center gap-2">
                  {c.name}
                  {c.page_paid ? (
                    <span className="rounded-full bg-emerald-50 text-emerald-800 px-2 py-0.5 text-[10px] font-black">صفحه عمومی فعال</span>
                  ) : (
                    <span className="rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-[10px] font-black">صفحه عمومی قفل</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">{c.sport} {c.city ? `• ${c.city}` : ""} • {clubRoleLabel(c.my_role)}</p>
                <div className="flex gap-2 text-xs">
                  <Link href={`/c/${c.id}`} className="rounded-xl border border-slate-200 px-3 py-1.5 font-black">صفحه باشگاه</Link>
                  <Link href={`/c/${c.id}/manage`} className="rounded-xl bg-emerald-700 px-3 py-1.5 font-black text-white">مدیریت</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "registrations" && data && (
        <div className="space-y-3">
          <h2 className="font-black">مدیریت ثبت‌نام‌ها ({toPersianDigits(data.registrations.length)})</h2>
          {data.registrations.length === 0 && <p className="text-sm text-slate-500">هنوز درخواستی ثبت نشده است. لینک ثبت‌نام را از برنامه‌ریز فعال کنید.</p>}
          {data.registrations.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-black">{item.team_name}</p>
                  <p className="text-[11px] text-slate-500">
                    {item.tournament_title} • {item.city || "—"} • {item.contact_name || "مسئول"} • {item.mobile} • {jalali(item.created_at)}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${item.status === "approved" ? "bg-emerald-50 text-emerald-800" : item.status === "rejected" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}>
                  {item.status === "approved" ? "تأییدشده" : item.status === "rejected" ? "رد شده" : "در انتظار"}
                </span>
              </div>
              <button type="button" className="text-[11px] font-bold text-violet-700" onClick={() => setExpandedReg(expandedReg === item.id ? null : item.id)}>
                {expandedReg === item.id ? "بستن فهرست بازیکنان" : `بازیکنان (${toPersianDigits(item.roster?.length || 0)})`}
              </button>
              {expandedReg === item.id && (
                <ul className="text-[11px] space-y-1 bg-slate-50 rounded-lg p-2">
                  {(item.roster || []).map((p, i) => (
                    <li key={i}>{p.jersey_number ? `#${toPersianDigits(p.jersey_number)} ` : ""}{p.name}{p.position ? ` — ${p.position}` : ""}</li>
                  ))}
                </ul>
              )}
              {item.reject_reason && <p className="text-[11px] text-rose-700">دلیل رد: {item.reject_reason}</p>}
              <div className="flex gap-2">
                {item.status !== "approved" && (
                  <button type="button" onClick={() => setRegStatus(item.tournament_id, item.id, "approved")} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-black text-white">تأیید</button>
                )}
                {item.status !== "rejected" && (
                  <button type="button" onClick={() => setRegStatus(item.tournament_id, item.id, "rejected")} className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-black text-rose-700">رد</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "reports" && data && (
        <div className="space-y-3">
          <h2 className="font-black">گزارش و آمار مسابقات</h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {["مسابقه", "فرمت", "تیم‌ها", "بازی‌ها", "برگزارشده", "تماشاگر", "ثبت‌نام"].map((h) => (
                    <th key={h} className="px-3 py-2 text-right font-black">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.tournaments.map((t) => (
                  <tr key={t.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-black">{t.title}</td>
                    <td className="px-3 py-2">{t.formatLabel}</td>
                    <td className="px-3 py-2">{toPersianDigits(t.teamCount)}</td>
                    <td className="px-3 py-2">{toPersianDigits(t.matchesTotal)}</td>
                    <td className="px-3 py-2">{toPersianDigits(t.matchesPlayed)}</td>
                    <td className="px-3 py-2">{t.spectatorPaid ? "فعال" : "—"}</td>
                    <td className="px-3 py-2">{t.registrationPaid ? "فعال" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.tournaments.length === 0 && <p className="p-4 text-slate-500">داده‌ای برای گزارش نیست.</p>}
          </div>
          <p className="text-[11px] text-slate-500">
            مجموع بازی‌ها: {toPersianDigits(data.stats.matchesTotal)} — برگزارشده: {toPersianDigits(data.stats.matchesPlayed)} — ثبت‌نام تأییدشده: {toPersianDigits(data.stats.approvedRegistrations)}
          </p>
        </div>
      )}

      {tab === "profile" && (
        <div className="grid gap-4 md:grid-cols-2">
          <form
            className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setProfileErr(null);
              setProfileMsg(null);
              setSavingProfile(true);
              const res = await updateProfile(name);
              setSavingProfile(false);
              if (res.success) setProfileMsg("نام برگزارکننده به‌روزرسانی شد.");
              else setProfileErr(res.error || "خطا در ذخیره.");
            }}
          >
            <h2 className="font-black">مشخصات برگزارکننده</h2>
            <label className="block text-xs font-bold">نام
              <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <p className="text-xs text-slate-500">ایمیل: <span className="dir-ltr">{user.email}</span></p>
            <p className="text-xs text-slate-500">موبایل: <span className="dir-ltr">{user.mobile}</span></p>
            {data?.profile.createdAt && <p className="text-xs text-slate-500">عضویت: {jalali(data.profile.createdAt)}</p>}
            <button disabled={savingProfile} className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50">ذخیره نام</button>
          </form>
          <form
            className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setProfileErr(null);
              setProfileMsg(null);
              if (hasPersianLetters(newPassword) || hasPersianLetters(currentPassword)) {
                setProfileErr("صفحه کلید را به انگلیسی تغییر دهید");
                return;
              }
              if (newPassword.length < 8) {
                setProfileErr("رمز عبور جدید باید حداقل ۸ کاراکتر باشد.");
                return;
              }
              setSavingProfile(true);
              const res = await changePassword(currentPassword, newPassword);
              setSavingProfile(false);
              if (res.success) {
                setProfileMsg("رمز عبور تغییر کرد.");
                setCurrentPassword("");
                setNewPassword("");
              } else setProfileErr(res.error || "خطا در تغییر رمز.");
            }}
          >
            <h2 className="font-black">تغییر رمز عبور</h2>
            <label className="block text-xs font-bold">رمز فعلی
              <input type="password" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </label>
            <label className="block text-xs font-bold">رمز جدید
              <input type="password" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </label>
            <button disabled={savingProfile} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white disabled:opacity-50">تغییر رمز</button>
          </form>
          {profileMsg && <div className="md:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">{profileMsg}</div>}
          {profileErr && <div className="md:col-span-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">{profileErr}</div>}
        </div>
      )}
      <StoreModal isOpen={storeOpen} onClose={() => setStoreOpen(false)} initialTab="clubpro" onSuccess={() => loadClubs()} />
    </div>
  );
}
