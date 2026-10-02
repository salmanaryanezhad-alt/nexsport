import { NextRequest } from "next/server";
import { db, ClubMemberRecord, ClubRecord } from "@/lib/db";
import { verifySessionRequest } from "@/lib/auth/sessionGuard";
import { canEditClub, canManageMembers, ClubMemberRole } from "./roles";

export async function optionalClubAuth(req: NextRequest) {
  const auth = await verifySessionRequest(req);
  if ("error" in auth) return { user: null, isAdmin: false as const };
  return { user: auth.user, isAdmin: Boolean(auth.isAdmin) };
}

export async function requireClubEditor(req: NextRequest, clubId: string) {
  const auth = await verifySessionRequest(req);
  if ("error" in auth) return auth;
  const club = await db.getClub(clubId);
  if (!club) return { error: "باشگاه یافت نشد.", status: 404 as const };
  const membership = await db.getClubMembership(clubId, auth.user.id);
  if (!canEditClub(membership?.role, auth.isAdmin) || membership?.status === "pending") {
    return { error: "برای این کار باید مدیر یا مالک باشگاه باشید.", status: 403 as const };
  }
  return { user: auth.user, isAdmin: auth.isAdmin, club, membership: membership as ClubMemberRecord };
}

export async function requireClubMember(req: NextRequest, clubId: string) {
  const auth = await verifySessionRequest(req);
  if ("error" in auth) return auth;
  const club = await db.getClub(clubId);
  if (!club) return { error: "باشگاه یافت نشد.", status: 404 as const };
  const membership = await db.getClubMembership(clubId, auth.user.id);
  if (auth.isAdmin) return { user: auth.user, isAdmin: true, club, membership };
  if (!membership) return { error: "شما عضو این باشگاه نیستید.", status: 403 as const };
  return { user: auth.user, isAdmin: false, club, membership };
}

export function editorOk(role?: ClubMemberRole | null, isAdmin = false) {
  return canEditClub(role, isAdmin);
}

export function membersOk(role?: ClubMemberRole | null, isAdmin = false) {
  return canManageMembers(role, isAdmin);
}

export type { ClubRecord };
