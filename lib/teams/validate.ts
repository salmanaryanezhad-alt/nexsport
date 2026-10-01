import { cleanMobileNumber, toEnglishDigits } from "@/lib/auth/utils";
import { TEAM_SPORTS, PLAYER_POSITIONS, PLAYER_STATUSES, PlayerStatus } from "./catalog";

export type TeamInput = {
  name: string;
  short_name?: string;
  sport?: string;
  city?: string;
  founded_year?: string;
  kit_home?: string;
  kit_away?: string;
  coach?: string;
  description?: string;
};

export type PlayerInput = {
  name: string;
  jersey_number?: string;
  position?: string;
  birth_date?: string;
  mobile?: string;
  national_id?: string;
  status?: string;
};

export function sanitizeTeamInput(raw: TeamInput): { ok: true; data: Required<TeamInput> } | { ok: false; error: string } {
  const name = String(raw.name || "").trim();
  if (!name) return { ok: false, error: "نام تیم را وارد نمایید." };
  if (name.length > 80) return { ok: false, error: "نام تیم نباید بیش از ۸۰ نویسه باشد." };

  const short_name = String(raw.short_name || "").trim().slice(0, 16);
  const sportRaw = String(raw.sport || "").trim();
  const sport = (TEAM_SPORTS as readonly string[]).includes(sportRaw) ? sportRaw : sportRaw || "فوتبال";
  const city = String(raw.city || "").trim().slice(0, 60);
  const yearDigits = toEnglishDigits(String(raw.founded_year || "")).replace(/\D/g, "");
  if (yearDigits && (yearDigits.length !== 4 || Number(yearDigits) < 1300 || Number(yearDigits) > 1415)) {
    return { ok: false, error: "سال تأسیس را به‌صورت سال شمسی چهار رقمی وارد کنید." };
  }
  const kit_home = String(raw.kit_home || "").trim().slice(0, 40);
  const kit_away = String(raw.kit_away || "").trim().slice(0, 40);
  const coach = String(raw.coach || "").trim().slice(0, 80);
  const description = String(raw.description || "").trim().slice(0, 500);

  return {
    ok: true,
    data: {
      name,
      short_name,
      sport,
      city,
      founded_year: yearDigits,
      kit_home,
      kit_away,
      coach,
      description,
    },
  };
}

export function sanitizePlayerInput(
  raw: PlayerInput
): { ok: true; data: Required<PlayerInput> & { status: PlayerStatus } } | { ok: false; error: string } {
  const name = String(raw.name || "").trim();
  if (!name) return { ok: false, error: "نام بازیکن را وارد نمایید." };
  if (name.length > 80) return { ok: false, error: "نام بازیکن نباید بیش از ۸۰ نویسه باشد." };

  const jersey = toEnglishDigits(String(raw.jersey_number || "")).replace(/\D/g, "").slice(0, 3);
  const positionRaw = String(raw.position || "").trim();
  const position = (PLAYER_POSITIONS as readonly string[]).includes(positionRaw) ? positionRaw : positionRaw.slice(0, 40);
  const birth_date = String(raw.birth_date || "").trim();
  if (birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(birth_date)) {
    return { ok: false, error: "تاریخ تولد نامعتبر است." };
  }
  const mobile = raw.mobile ? cleanMobileNumber(String(raw.mobile)) : "";
  if (mobile && mobile.length < 10) {
    return { ok: false, error: "شماره موبایل بازیکن معتبر نیست." };
  }
  const national_id = toEnglishDigits(String(raw.national_id || "")).replace(/\D/g, "");
  if (national_id && national_id.length !== 10) {
    return { ok: false, error: "کد ملی در صورت ورود باید ۱۰ رقم باشد." };
  }
  const statusRaw = String(raw.status || "active");
  const status = (PLAYER_STATUSES.map((s) => s.id) as string[]).includes(statusRaw)
    ? (statusRaw as PlayerStatus)
    : "active";

  return {
    ok: true,
    data: {
      name,
      jersey_number: jersey,
      position,
      birth_date,
      mobile,
      national_id,
      status,
    },
  };
}
