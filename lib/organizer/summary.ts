import { registrationPaymentPaid, readRegistrationSettings } from "@/lib/registrations/settings";

export const FORMAT_LABELS: Record<string, string> = {
  league: "لیگ دوره‌ای",
  "double-league": "لیگ رفت و برگشت",
  groups: "مرحله گروهی",
  "groups-knockout": "گروهی + حذفی",
  knockout: "تک‌حذفی",
  "double-knockout": "دو حذفی",
};

export function formatLabel(format: string | null | undefined): string {
  if (!format) return "—";
  return FORMAT_LABELS[format] || format;
}

function isByeMatch(m: any): boolean {
  if (!m) return true;
  if (m.isBye) return true;
  const home = String(m.home || "");
  const away = String(m.away || "");
  if (!home || !away) return true;
  if (home === "BYE" || away === "BYE" || home === "استراحت" || away === "استراحت") return true;
  return false;
}

function isPlayed(m: any, scores: Record<string, any>): boolean {
  if (m?.winner) return true;
  if (m?.homeScore != null && m?.awayScore != null) return true;
  const s = m?.id ? scores[m.id] : null;
  if (!s) return false;
  if (s.winner) return true;
  return s.home != null && s.away != null && s.home !== "" && s.away !== "";
}

function collectMatches(result: any): any[] {
  if (!result) return [];
  const out: any[] = [];
  const pushRounds = (rounds?: any[]) => {
    for (const r of rounds || []) {
      for (const m of r.matches || []) out.push(m);
    }
  };
  if (Array.isArray(result.rounds)) pushRounds(result.rounds);
  if (Array.isArray(result.groups)) {
    for (const g of result.groups) pushRounds(g.rounds);
  }
  if (result.knockout) {
    pushRounds(result.knockout.rounds);
    if (result.knockout.thirdPlaceMatch) out.push(result.knockout.thirdPlaceMatch);
  }
  const dk = result.doubleKnockout;
  if (dk) {
    pushRounds(dk.winnersBracket);
    pushRounds(dk.losersBracket);
    if (dk.grandFinal) out.push(dk.grandFinal);
    if (dk.bracketResetMatch) out.push(dk.bracketResetMatch);
  }
  return out;
}

export function summarizeMatches(state: any): { total: number; played: number } {
  const scores = (state?.scores && typeof state.scores === "object" ? state.scores : {}) as Record<string, any>;
  const real = collectMatches(state?.result).filter((m) => !isByeMatch(m));
  return {
    total: real.length,
    played: real.filter((m) => isPlayed(m, scores)).length,
  };
}

export type OrganizerTournamentCard = {
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
};

export function toTournamentCard(t: {
  id: string;
  title: string;
  format: string;
  sport?: string | null;
  team_count: number;
  state: any;
  created_at: Date | string;
  updated_at: Date | string;
}): OrganizerTournamentCard {
  const state = t.state || {};
  const matches = summarizeMatches(state);
  const settings = readRegistrationSettings(state, t.team_count);
  return {
    id: t.id,
    title: t.title,
    format: t.format,
    formatLabel: formatLabel(t.format),
    sport: t.sport || state?.pointsRule?.sport || "",
    teamCount: t.team_count,
    step: Number(state.step) || 0,
    spectatorPaid: Boolean(state?.payment?.isPaid),
    registrationPaid: registrationPaymentPaid(state),
    registrationOpen: settings.isOpen,
    registrationCapacity: settings.capacity,
    matchesTotal: matches.total,
    matchesPlayed: matches.played,
    createdAt: t.created_at instanceof Date ? t.created_at.toISOString() : String(t.created_at),
    updatedAt: t.updated_at instanceof Date ? t.updated_at.toISOString() : String(t.updated_at),
  };
}
