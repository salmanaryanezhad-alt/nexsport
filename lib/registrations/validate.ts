import { cleanMobileNumber, toEnglishDigits } from "@/lib/auth/utils";
import { PLAYER_POSITIONS } from "@/lib/teams/catalog";
import { sanitizeTeamInput } from "@/lib/teams/validate";

export type RegistrationPlayerInput = {
  name: string;
  jersey_number?: string;
  position?: string;
  birth_date?: string;
  mobile?: string;
  national_id?: string;
};

export type RegistrationInput = {
  team_name: string;
  short_name?: string;
  city?: string;
  coach?: string;
  contact_name?: string;
  mobile?: string;
  notes?: string;
  library_team_id?: string;
  players?: RegistrationPlayerInput[];
};

export type SanitizedRegistrationPlayer = {
  name: string;
  jersey_number: string;
  position: string;
  birth_date: string;
  mobile: string;
  national_id: string;
};

export type SanitizedRegistration = {
  team_name: string;
  short_name: string;
  city: string;
  coach: string;
  contact_name: string;
  mobile: string;
  notes: string;
  library_team_id: string;
  players: SanitizedRegistrationPlayer[];
};

export function sanitizeRegistrationInput(
  raw: RegistrationInput
): { ok: true; data: SanitizedRegistration } | { ok: false; error: string } {
  const team = sanitizeTeamInput({
    name: raw.team_name,
    short_name: raw.short_name,
    city: raw.city,
    coach: raw.coach,
  });
  if (!team.ok) return team;

  const contact_name = String(raw.contact_name || "").trim().slice(0, 80);
  const mobile = raw.mobile ? cleanMobileNumber(String(raw.mobile)) : "";
  if (!mobile || mobile.length < 10) {
    return { ok: false, error: "شماره موبایل مسئول تیم را وارد نمایید." };
  }
  const notes = String(raw.notes || "").trim().slice(0, 500);
  const library_team_id = String(raw.library_team_id || "").trim().slice(0, 36);

  const playersRaw = Array.isArray(raw.players) ? raw.players : [];
  if (playersRaw.length > 40) {
    return { ok: false, error: "حداکثر ۴۰ بازیکن در هر ثبت‌نام مجاز است." };
  }

  const players: SanitizedRegistrationPlayer[] = [];
  const jerseys = new Set<string>();
  for (const p of playersRaw) {
    const name = String(p?.name || "").trim();
    if (!name) continue;
    if (name.length > 80) return { ok: false, error: "نام بازیکن نباید بیش از ۸۰ نویسه باشد." };
    const jersey = toEnglishDigits(String(p?.jersey_number || "")).replace(/\D/g, "").slice(0, 3);
    if (jersey) {
      if (jerseys.has(jersey)) return { ok: false, error: "شماره پیراهن در فهرست این تیم تکراری است." };
      jerseys.add(jersey);
    }
    const positionRaw = String(p?.position || "").trim();
    const position = (PLAYER_POSITIONS as readonly string[]).includes(positionRaw)
      ? positionRaw
      : positionRaw.slice(0, 40);
    const birth_date = String(p?.birth_date || "").trim();
    if (birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(birth_date)) {
      return { ok: false, error: "تاریخ تولد بازیکن نامعتبر است." };
    }
    const pMobile = p?.mobile ? cleanMobileNumber(String(p.mobile)) : "";
    if (pMobile && pMobile.length < 10) {
      return { ok: false, error: "شماره موبایل بازیکن معتبر نیست." };
    }
    const national_id = toEnglishDigits(String(p?.national_id || "")).replace(/\D/g, "");
    if (national_id && national_id.length !== 10) {
      return { ok: false, error: "کد ملی در صورت ورود باید ۱۰ رقم باشد." };
    }
    players.push({
      name,
      jersey_number: jersey,
      position,
      birth_date,
      mobile: pMobile,
      national_id,
    });
  }

  if (players.length < 1) {
    return { ok: false, error: "حداقل یک بازیکن را در فهرست ثبت کنید." };
  }

  return {
    ok: true,
    data: {
      team_name: team.data.name,
      short_name: team.data.short_name,
      city: team.data.city,
      coach: team.data.coach,
      contact_name,
      mobile,
      notes,
      library_team_id,
      players,
    },
  };
}
