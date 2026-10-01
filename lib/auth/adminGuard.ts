import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { cleanEmailAddress } from "@/lib/auth/utils";
import { resolveSessionUser } from "@/lib/auth/sessionGuard";

export async function verifyAdminRequest(req: NextRequest) {
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

  const user = await resolveSessionUser(session);
  if (!user) {
    return { error: "کاربر یافت نشد.", status: 401, expired: true as const };
  }

  const isSalman = cleanEmailAddress(user.email) === "salman.aryanezhad@gmail.com";
  const isAdmin = isSalman || user.role === "admin";

  if (!isAdmin) {
    return {
      error: "دسترسی غیرمجاز. این بخش منحصراً در اختیار مدیر سامانه می‌باشد.",
      status: 403,
    };
  }

  return { user };
}
