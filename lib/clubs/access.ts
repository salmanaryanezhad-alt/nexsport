import { NextRequest } from "next/server";
import { db, ClubMemberRecord, ClubRecord, UserRecord } from "@/lib/db";
import { verifySessionRequest } from "@/lib/auth/sessionGuard";
import { canEditClub, canManageMembers, ClubMemberRole } from "./roles";

export type ClubAuthFail = { ok: false; error: string; status: number; expired?: boolean };
export type ClubAuthOk = {
  ok: true;
  user: UserRecord;
  isAdmin: boolean;
  club: ClubRecord;
  membership: ClubMemberRecord | null;
};

export async function optionalClubAuth(req: NextRequest) {
  const auth = await verifySessionRequest(req);
  if ("error" in auth && auth.error) return { user: null, isAdmin: false as const };
  if (!("user" in auth) || !auth.user) return { user: null, isAdmin: false as const };
  return { user: auth.user, isAdmin: Boolean(auth.isAdmin) };
}

export async function requireClubEditor(req: NextRequest, clubId: string): Promise<ClubAuthFail | ClubAuthOk> {
  const auth = await verifySessionRequest(req);
  if (!("user" in auth) || !auth.user) {
    return { ok: false, error: (auth as any).error || "ابتدا وارد حساب کاربری شوید.", status: (auth as any).status || 401, expired: (auth as any).expired };
  }
  const club = await db.getClub(clubId);
  if (!club) return { ok: false, error: "باشگاه یافت نشد.", status: 404 };
  const membership = await db.getClubMembership(clubId, auth.user.id);
  if (!canEditClub(membership?.role, auth.isAdmin) || membership?.status === "pending") {
    return { ok: false, error: "برای این کار باید مدیر یا مالک باشگاه باشید.", status: 403 };
  }
  return { ok: true, user: auth.user, isAdmin: auth.isAdmin, club, membership };
}

export async function requireClubMember(req: NextRequest, clubId: string): Promise<ClubAuthFail | ClubAuthOk> {
  const auth = await verifySessionRequest(req);
  if (!("user" in auth) || !auth.user) {
    return { ok: false, error: (auth as any).error || "ابتدا وارد حساب کاربری شوید.", status: (auth as any).status || 401, expired: (auth as any).expired };
  }
  const club = await db.getClub(clubId);
  if (!club) return { ok: false, error: "باشگاه یافت نشد.", status: 404 };
  const membership = await db.getClubMembership(clubId, auth.user.id);
  if (auth.isAdmin) return { ok: true, user: auth.user, isAdmin: true, club, membership };
  if (!membership) return { ok: false, error: "شما عضو این باشگاه نیستید.", status: 403 };
  return { ok: true, user: auth.user, isAdmin: false, club, membership };
}

export function editorOk(role?: ClubMemberRole | null, isAdmin = false) {
  return canEditClub(role, isAdmin);
}

export function membersOk(role?: ClubMemberRole | null, isAdmin = false) {
  return canManageMembers(role, isAdmin);
}

export type { ClubRecord };
