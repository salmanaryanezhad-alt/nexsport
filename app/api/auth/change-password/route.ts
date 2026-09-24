import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { toEnglishDigits, hasPersianLetters } from "@/lib/auth/utils";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get("nexsport_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "ابتدا وارد حساب کاربری خود شوید.", expired: true }, { status: 401 });
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
      return NextResponse.json({ error: "کاربر یافت نشد." }, { status: 404 });
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body || {};

    if (hasPersianLetters(String(newPassword || ""))) {
      return NextResponse.json({ error: "صفحه کلید را به انگلیسی تغییر دهید" }, { status: 400 });
    }

    const cleanNewPass = toEnglishDigits(String(newPassword || ""));
    if (!cleanNewPass || cleanNewPass.length < 8) {
      return NextResponse.json({ error: "رمز عبور جدید باید حداقل ۸ کاراکتر باشد." }, { status: 400 });
    }

    // Check current password if provided
    if (currentPassword) {
      const match = verifyPassword(currentPassword, user.password_hash);
      if (!match) {
        return NextResponse.json({ error: "رمز عبور فعلی نادرست است." }, { status: 400 });
      }
    }

    const newHash = hashPassword(newPassword);
    await db.updateUserPassword(user.id, newHash);

    return NextResponse.json({
      success: true,
      message: "رمز عبور شما با موفقیت تغییر یافت.",
    });
  } catch (err: any) {
    console.error("[Change Password Error]", err);
    return NextResponse.json({ error: "خطایی در تغییر رمز عبور رخ داد." }, { status: 500 });
  }
}
