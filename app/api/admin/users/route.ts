import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cleanEmailAddress } from "@/lib/auth/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token =
      req.cookies.get("nexsport_token")?.value ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return NextResponse.json(
        { error: "ابتدا وارد حساب کاربری شوید.", expired: true },
        { status: 401 }
      );
    }

    const session = await db.findSession(token);
    if (!session) {
      const response = NextResponse.json(
        { error: "نشست شما منقضی شده است. لطفاً مجدداً وارد شوید.", expired: true },
        { status: 401 }
      );
      response.cookies.set("nexsport_token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return response;
    }

    const user = await db.findUserById(session.user_id);
    if (!user) {
      return NextResponse.json(
        { error: "کاربر یافت نشد.", expired: true },
        { status: 401 }
      );
    }

    const isSalman = cleanEmailAddress(user.email) === "salman.aryanezhad@gmail.com";
    const isAdmin = isSalman || user.role === "admin";

    if (!isAdmin) {
      return NextResponse.json(
        { error: "دسترسی غیرمجاز. این بخش منحصراً در اختیار مدیر سامانه می‌باشد." },
        { status: 403 }
      );
    }

    const users = await db.listAllUsers();
    return NextResponse.json({
      success: true,
      count: users.length,
      users,
    });
  } catch (err: any) {
    console.error("[Admin Users Error]", err);
    return NextResponse.json(
      { error: "خطا در دریافت فهرست کاربران." },
      { status: 500 }
    );
  }
}
