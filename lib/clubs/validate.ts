import { cleanMobileNumber, toEnglishDigits } from "@/lib/auth/utils";
import { TEAM_SPORTS } from "@/lib/teams/catalog";
import { CLUB_COACH_TITLES, CLUB_MEMBER_ROLES, ClubMemberRole } from "./roles";

export type ClubInput = {
  name: string;
  short_name?: string;
  sport?: string;
  city?: string;
  founded_year?: string;
  venue?: string;
  description?: string;
  contact_name?: string;
  mobile?: string;
};

export function sanitizeClubInput(
  raw: ClubInput
): { ok: true; data: Required<ClubInput> } | { ok: false; error: string } {
  const name = String(raw.name || "").trim();
  if (!name) return { ok: false, error: "نام باشگاه را وارد نمایید." };
  if (name.length > 80) return { ok: false, error: "نام باشگاه نباید بیش از ۸۰ نویسه باشد." };
  const short_name = String(raw.short_name || "").trim().slice(0, 16);
  const sportRaw = String(raw.sport || "").trim();
  const sport = (TEAM_SPORTS as readonly string[]).includes(sportRaw) ? sportRaw : sportRaw || "فوتبال";
  const city = String(raw.city || "").trim().slice(0, 60);
  const yearDigits = toEnglishDigits(String(raw.founded_year || "")).replace(/\D/g, "");
  if (yearDigits && (yearDigits.length !== 4 || Number(yearDigits) < 1300 || Number(yearDigits) > 1415)) {
    return { ok: false, error: "سال تأسیس را به‌صورت سال شمسی چهار رقمی وارد کنید." };
  }
  const venue = String(raw.venue || "").trim().slice(0, 80);
  const description = String(raw.description || "").trim().slice(0, 500);
  const contact_name = String(raw.contact_name || "").trim().slice(0, 80);
  const mobile = raw.mobile ? cleanMobileNumber(String(raw.mobile)) : "";
  if (mobile && mobile.length < 10) return { ok: false, error: "شماره موبایل باشگاه معتبر نیست." };
  return {
    ok: true,
    data: { name, short_name, sport, city, founded_year: yearDigits, venue, description, contact_name, mobile },
  };
}

export function sanitizeCoachInput(raw: {
  name?: string;
  title?: string;
  mobile?: string;
  notes?: string;
}): { ok: true; data: { name: string; title: string; mobile: string; notes: string } } | { ok: false; error: string } {
  const name = String(raw.name || "").trim();
  if (!name) return { ok: false, error: "نام مربی را وارد نمایید." };
  if (name.length > 80) return { ok: false, error: "نام مربی نباید بیش از ۸۰ نویسه باشد." };
  const titleRaw = String(raw.title || "").trim();
  const title = (CLUB_COACH_TITLES as readonly string[]).includes(titleRaw) ? titleRaw : titleRaw.slice(0, 40) || "مربی";
  const mobile = raw.mobile ? cleanMobileNumber(String(raw.mobile)) : "";
  if (mobile && mobile.length < 10) return { ok: false, error: "شماره موبایل مربی معتبر نیست." };
  return { ok: true, data: { name, title, mobile, notes: String(raw.notes || "").trim().slice(0, 300) } };
}

export function sanitizeMemberRole(raw: string | undefined, allowOwner = false): ClubMemberRole | null {
  const role = String(raw || "member") as ClubMemberRole;
  if (!CLUB_MEMBER_ROLES.includes(role)) return null;
  if (role === "owner" && !allowOwner) return null;
  return role;
}
