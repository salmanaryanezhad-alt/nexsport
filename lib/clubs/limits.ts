import { db, UserRecord } from "@/lib/db";
import { hasUnlimitedPlanning } from "@/lib/auth/utils";
import {
  FREE_CLUB_COACHES,
  FREE_CLUB_LIMIT,
  FREE_CLUB_PLAYERS,
  FREE_CLUB_TEAMS,
} from "@/lib/payment/pricing";

export type ClubCapFail = { ok: false; error: string };
export type ClubCapOk = { ok: true };

function unlimitedClubs(user: Pick<UserRecord, "email" | "role"> | null | undefined, isAdmin = false) {
  return Boolean(isAdmin || hasUnlimitedPlanning(user));
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
  if (owned >= FREE_CLUB_LIMIT) {
    return {
      ok: false,
      error:
        "در طرح رایگان فقط ۱ باشگاه می‌توانید بسازید. ایجاد باشگاه رایگان است؛ برای باشگاه بیشتر اشتراک Club Pro را فعال کنید.",
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

  const teamIds = await db.listClubTeamIds(clubId);
  if (teamIds.includes(teamId)) return { ok: true };
  if (teamIds.length >= FREE_CLUB_TEAMS) {
    return {
      ok: false,
      error: "در طرح رایگان هر باشگاه حداکثر ۲ تیم می‌تواند داشته باشد. برای تیم بیشتر Club Pro لازم است.",
    };
  }

  const newRoster = await db.listPlayers(teamId);
  const currentPlayers = await db.countClubPlayers(clubId);
  if (currentPlayers + newRoster.length > FREE_CLUB_PLAYERS) {
    return {
      ok: false,
      error: `در طرح رایگان مجموع بازیکنان باشگاه حداکثر ۱۵ نفر است. اتصال این تیم سقف را رد می‌کند (${currentPlayers + newRoster.length} نفر).`,
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
  const coaches = await db.listClubCoaches(clubId);
  if (coaches.length >= FREE_CLUB_COACHES) {
    return {
      ok: false,
      error: "در طرح رایگان هر باشگاه حداکثر ۲ مربی می‌تواند داشته باشد. برای مربی بیشتر Club Pro لازم است.",
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
  for (const clubId of clubIds) {
    const club = await db.getClub(clubId);
    if (!club) continue;
    if (await ownerHasClubPro(club.owner_id, user, isAdmin)) continue;
    const current = await db.countClubPlayers(clubId);
    if (current >= FREE_CLUB_PLAYERS) {
      return {
        ok: false,
        error: "در طرح رایگان مجموع بازیکنان باشگاه حداکثر ۱۵ نفر است. برای بازیکن بیشتر Club Pro لازم است.",
      };
    }
  }
  return { ok: true };
}

export function clubPageIsPublic(club: { page_paid?: boolean } | null | undefined) {
  return Boolean(club?.page_paid);
}
