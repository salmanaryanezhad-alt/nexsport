import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, code } = body || {};

    if (!email || !code) {
      return NextResponse.json(
        { error: "ایمیل و کد تایید الزامی است." },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanCode = String(code).trim();

    const verification = await db.verifyCode(cleanEmail, cleanCode);
    if (!verification) {
      return NextResponse.json(
        { error: "کد تایید وارد شده نامعتبر یا منقضی شده است. لطفاً کد جدید درخواست کنید." },
        { status: 400 }
      );
    }

    const user = await db.findUserByEmail(cleanEmail);
    if (!user) {
      return NextResponse.json(
        { error: "کاربر مورد نظر یافت نشد." },
        { status: 404 }
      );
    }

    // Mark user verified
    await db.markUserVerified(user.id);
    await db.deleteVerificationCodesForUser(user.id);

    // Create session token
    const token = await db.createSession(user.id, 30);

    const response = NextResponse.json({
      success: true,
      message: "ایمیل شما با موفقیت تایید شد و وارد شدید.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        is_verified: true,
        role: user.role,
      },
    });

    response.cookies.set("nexsport_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (err: any) {
    console.error("[Verify Email Error]", err);
    return NextResponse.json(
      { error: "خطایی در تایید کد رخ داد." },
      { status: 500 }
    );
  }
}
