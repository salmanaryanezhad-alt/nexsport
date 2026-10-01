import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { cleanEmailAddress } from "@/lib/auth/utils";

export async function verifySessionRequest(req: NextRequest) {
  const token =
    req.cookies.get("nexsport_token")?.value ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return { error: "ابتدا وارد حساب کاربری شوید.", status: 401, expired: true as const };
  }

  const session = await db.findSession(token);
  if (!session) {
    return { error: "نشست شما منقضی شده است. لطفاً مجدداً وارد شوید.", status: 401, expired: true as const };
  }

  const user = await db.findUserById(session.user_id);
  if (!user) {
    return { error: "کاربر یافت نشد.", status: 401, expired: true as const };
  }

  const isSalman = cleanEmailAddress(user.email) === "salman.aryanezhad@gmail.com";
  const isAdmin = isSalman || user.role === "admin";

  return { user, isAdmin };
}
