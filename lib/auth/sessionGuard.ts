import { NextRequest } from "next/server";
import { db, SessionRecord, UserRecord } from "@/lib/db";
import { cleanEmailAddress } from "@/lib/auth/utils";
import { getRequestToken } from "@/lib/auth/sessionToken";

export async function resolveSessionUser(session: SessionRecord): Promise<UserRecord | null> {
  try {
    const user = await db.findUserById(session.user_id);
    if (user) return user;
  } catch {
    // Serverless / unreachable DB: fall back to the signed-cookie snapshot.
  }
  if (!session.user_snapshot) return null;
  const snap = session.user_snapshot;
  return {
    id: snap.id,
    name: snap.name,
    email: snap.email,
    mobile: snap.mobile,
    password_hash: "",
    is_verified: snap.is_verified,
    role: snap.role,
    created_at: session.created_at,
    updated_at: session.last_active_at || session.created_at,
  };
}

export async function verifySessionRequest(req: NextRequest) {
  const token = getRequestToken(req);

  if (!token) {
    return { error: "ابتدا وارد حساب کاربری شوید.", status: 401, expired: true as const };
  }

  const session = await db.findSession(token);
  if (!session) {
    return { error: "نشست شما منقضی شده است. لطفاً مجدداً وارد شوید.", status: 401, expired: true as const };
  }

  const user = await resolveSessionUser(session);
  if (!user) {
    return { error: "کاربر یافت نشد.", status: 401, expired: true as const };
  }

  const isSalman = cleanEmailAddress(user.email) === "salman.aryanezhad@gmail.com";
  const isAdmin = isSalman || user.role === "admin";

  return { user, isAdmin };
}
