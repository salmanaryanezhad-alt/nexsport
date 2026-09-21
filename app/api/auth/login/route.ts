import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { generateVerificationCode, sendVerificationEmail } from "@/lib/auth/email";
import { cleanEmailAddress, cleanMobileNumber, toEnglishDigits } from "@/lib/auth/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier, password } = body || {};

    if (!identifier || typeof identifier !== "string" || identifier.trim().length === 0) {
      return NextResponse.json(
        { error: "لطفاً ایمیل یا شماره موبایل خود را وارد نمایید." },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "لطفاً رمز عبور را وارد نمایید." },
        { status: 400 }
      );
    }

    const raw = identifier.trim();
    let user = null;
    if (raw.includes("@")) {
      user = await db.findUserByEmail(cleanEmailAddress(raw));
    } else {
      user = await db.findUserByMobile(cleanMobileNumber(raw));
      if (!user) {
        user = await db.findUserByEmail(cleanEmailAddress(raw));
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: "اطلاعات کاربری (ایمیل/موبایل یا رمز عبور) صحیح نمی‌باشد." },
        { status: 401 }
      );
    }

    const passwordMatches = verifyPassword(password, user.password_hash);
    if (!passwordMatches) {
      return NextResponse.json(
        { error: "اطلاعات کاربری (ایمیل/موبایل یا رمز عبور) صحیح نمی‌باشد." },
        { status: 401 }
      );
    }

    // If user has not verified email, prompt verification and send fresh code
    if (!user.is_verified) {
      const code = generateVerificationCode();
      await db.saveVerificationCode(user.id, user.email, code, 15);
      const emailResult = await sendVerificationEmail(user.email, user.name, code);

      return NextResponse.json({
        success: false,
        requiresVerification: true,
        email: user.email,
        demoCode: emailResult.demoCode,
        isRealDelivery: emailResult.isRealDelivery,
        message: "حساب کاربری شما هنوز تایید نشده است. کد تایید به ایمیل شما ارسال شد.",
      });
    }

    // Create session token
    const token = await db.createSession(user.id, 30);

    const response = NextResponse.json({
      success: true,
      message: "با موفقیت وارد شدید.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        is_verified: user.is_verified,
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
    console.error("[Login Error]", err);
    return NextResponse.json(
      { error: "خطایی در ورود به حساب رخ داد." },
      { status: 500 }
    );
  }
}
