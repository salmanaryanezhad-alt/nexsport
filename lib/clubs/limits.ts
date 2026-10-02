import { db, UserRecord } from "@/lib/db";
import { hasUnlimitedPlanning } from "@/lib/auth/utils";
import { toPersianDigits } from "@/lib/digits";

export type ClubCapFail = { ok: false; error: string };
export type ClubCapOk = { ok: true };

function unlimitedClubs(user: Pick<UserRecord, "email" | "role"> | null | undefined, isAdmin = false) {
  return Boolean(isAdmin || hasUnlimitedPlanning(user));
}

async function freeCaps() {
  const s = await db.getPricingSettings();
  return {
    clubs: s.freeClubLimit,
    teams: s.freeClubTeams,
    players: s.freeClubPlayers,
    coaches: s.freeClubCoaches,
  };
}

export async function ownerHasClubPro(userId: string, user?: Pick<UserRecord, "email" | "role"> | null, isAdmin = false) {
  if (unlimitedClubs(user, isAdmin)) return true;
  const quota = await db.getUserQuota(userId);
  return Boolean(quota.isClubPro);
}

export async function assertCanCreateClub(
  user: UserRecord,
  isAdmin = false
): Promise<ClubCapOk | ClubCapFail> {
  if (await ownerHasClubPro(user.id, user, isAdmin)) return { ok: true };
  const owned = await db.countOwnedClubs(user.id);
  const caps = await freeCaps();
  if (owned >= caps.clubs) {
    return {
      ok: false,
      error: `در طرح رایگان فقط ${toPersianDigits(caps.clubs)} باشگاه می‌توانید بسازید. ایجاد باشگاه رایگان است؛ برای باشگاه بیشتر اشتراک Club Pro را فعال کنید.`,
    };
  }
  return { ok: true };
}

export async function assertCanAttachClubTeam(
  clubId: string,
  teamId: string,
  user: UserRecord,
  isAdmin = false
): Promise<ClubCapOk | ClubCapFail> {
  const club = await db.getClub(clubId);
  if (!club) return { ok: false, error: "باشگاه یافت نشد." };
  if (await ownerHasClubPro(club.owner_id, user, isAdmin)) return { ok: true };

  const caps = await freeCaps();
  const teamIds = await db.listClubTeamIds(clubId);
  if (teamIds.includes(teamId)) return { ok: true };
  if (teamIds.length >= caps.teams) {
    return {
      ok: false,
      error: `در طرح رایگان هر باشگاه حداکثر ${toPersianDigits(caps.teams)} تیم می‌تواند داشته باشد. برای تیم بیشتر Club Pro لازم است.`,
    };
  }

  const newRoster = await db.listPlayers(teamId);
  const currentPlayers = await db.countClubPlayers(clubId);
  if (currentPlayers + newRoster.length > caps.players) {
    return {
      ok: false,
      error: `در طرح رایگان مجموع بازیکنان باشگاه حداکثر ${toPersianDigits(caps.players)} نفر است. اتصال این تیم سقف را رد می‌کند (${toPersianDigits(currentPlayers + newRoster.length)} نفر).`,
    };
  }
  return { ok: true };
}

export async function assertCanAddClubCoach(
  clubId: string,
  user: UserRecord,
  isAdmin = false
): Promise<ClubCapOk | ClubCapFail> {
  const club = await db.getClub(clubId);
  if (!club) return { ok: false, error: "باشگاه یافت نشد." };
  if (await ownerHasClubPro(club.owner_id, user, isAdmin)) return { ok: true };
  const caps = await freeCaps();
  const coaches = await db.listClubCoaches(clubId);
  if (coaches.length >= caps.coaches) {
    return {
      ok: false,
      error: `در طرح رایگان هر باشگاه حداکثر ${toPersianDigits(caps.coaches)} مربی می‌تواند داشته باشد. برای مربی بیشتر Club Pro لازم است.`,
    };
  }
  return { ok: true };
}

export async function assertCanAddClubPlayer(
  teamId: string,
  user: UserRecord,
  isAdmin = false
): Promise<ClubCapOk | ClubCapFail> {
  const clubIds = await db.listClubIdsForTeam(teamId);
  if (clubIds.length === 0) return { ok: true };
  const caps = await freeCaps();
  for (const clubId of clubIds) {
    const club = await db.getClub(clubId);
    if (!club) continue;
    if (await ownerHasClubPro(club.owner_id, user, isAdmin)) continue;
    const current = await db.countClubPlayers(clubId);
    if (current >= caps.players) {
      return {
        ok: false,
        error: `در طرح رایگان مجموع بازیکنان باشگاه حداکثر ${toPersianDigits(caps.players)} نفر است. برای بازیکن بیشتر Club Pro لازم است.`,
      };
    }
  }
  return { ok: true };
}

export function clubPageIsPublic(club: { page_paid?: boolean } | null | undefined) {
  return Boolean(club?.page_paid);
}
