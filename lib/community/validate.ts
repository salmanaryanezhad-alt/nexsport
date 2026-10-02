import { cleanMobileNumber } from "@/lib/auth/utils";
import { TEAM_SPORTS } from "@/lib/teams/catalog";
import { SERVICE_CATEGORY_IDS, ServiceCategoryId } from "./catalog";

export type ServiceListingInput = {
  category: string;
  title: string;
  body: string;
  city?: string;
  sport?: string;
  contact_name?: string;
  mobile?: string;
};

export function sanitizeServiceListingInput(
  raw: ServiceListingInput
): { ok: true; data: Required<ServiceListingInput> & { category: ServiceCategoryId } } | { ok: false; error: string } {
  const category = String(raw.category || "").trim() as ServiceCategoryId;
  if (!SERVICE_CATEGORY_IDS.includes(category)) {
    return { ok: false, error: "دسته خدمات را انتخاب کنید." };
  }
  const title = String(raw.title || "").trim();
  if (title.length < 3) return { ok: false, error: "عنوان باید حداقل ۳ نویسه باشد." };
  if (title.length > 80) return { ok: false, error: "عنوان نباید بیش از ۸۰ نویسه باشد." };
  const body = String(raw.body || "").trim();
  if (body.length < 10) return { ok: false, error: "توضیحات باید حداقل ۱۰ نویسه باشد." };
  if (body.length > 2000) return { ok: false, error: "توضیحات نباید بیش از ۲۰۰۰ نویسه باشد." };
  const city = String(raw.city || "").trim().slice(0, 60);
  const sportRaw = String(raw.sport || "").trim();
  const sport = (TEAM_SPORTS as readonly string[]).includes(sportRaw) ? sportRaw : sportRaw.slice(0, 40);
  const contact_name = String(raw.contact_name || "").trim().slice(0, 80);
  const mobileRaw = String(raw.mobile || "").trim();
  let mobile = "";
  if (mobileRaw) {
    const cleaned = cleanMobileNumber(mobileRaw);
    if (!/^09\d{9}$/.test(cleaned)) {
      return { ok: false, error: "شماره تماس را به‌صورت ۱۱ رقمی مانند ۰۹۱۲۱۲۳۴۵۶۷ وارد کنید." };
    }
    mobile = cleaned;
  }
  return {
    ok: true,
    data: { category, title, body, city, sport, contact_name, mobile },
  };
}

export function publicPlayerView(p: {
  id: string;
  team_id: string;
  name: string;
  jersey_number?: string;
  position?: string;
  birth_date?: string;
  status?: string;
}) {
  return {
    id: p.id,
    team_id: p.team_id,
    name: p.name,
    jersey_number: p.jersey_number || "",
    position: p.position || "",
    birth_date: p.birth_date || "",
    status: p.status || "active",
  };
}

export function publicTeamView(t: {
  id: string;
  name: string;
  short_name?: string;
  sport?: string;
  city?: string;
  founded_year?: string;
  kit_home?: string;
  kit_away?: string;
  coach?: string;
  description?: string;
  player_count?: number;
  is_public?: boolean;
}) {
  return {
    id: t.id,
    name: t.name,
    short_name: t.short_name || "",
    sport: t.sport || "فوتبال",
    city: t.city || "",
    founded_year: t.founded_year || "",
    kit_home: t.kit_home || "",
    kit_away: t.kit_away || "",
    coach: t.coach || "",
    description: t.description || "",
    player_count: Number(t.player_count || 0),
    is_public: Boolean(t.is_public),
  };
}
