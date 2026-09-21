import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { generateVerificationCode, sendVerificationEmail } from "@/lib/auth/email";
import { cleanEmailAddress, cleanMobileNumber } from "@/lib/auth/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, mobile, password } = body || {};

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "لطفاً نام و نام خانوادگی را وارد نمایید." },
        { status: 400 }
      );
    }

    const cleanEmail = cleanEmailAddress(String(email || ""));
    const cleanMobile = cleanMobileNumber(String(mobile || ""));

    if (!cleanEmail || !cleanEmail.includes("@")) {
      return NextResponse.json(
        { error: "لطفاً یک آدرس ایمیل معتبر وارد نمایید." },
        { status: 400 }
      );
    }

    if (!cleanMobile || cleanMobile.length < 8) {
      return NextResponse.json(
        { error: "لطفاً شماره موبایل معتبر وارد نمایید." },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length === 0) {
      return NextResponse.json(
        { error: "لطفاً رمز عبور را وارد نمایید." },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingEmail = await db.findUserByEmail(cleanEmail);
    if (existingEmail) {
      return NextResponse.json(
        { error: "این ایمیل قبلاً در سامانه ثبت شده است. اگر حساب دارید، وارد شوید." },
        { status: 409 }
      );
    }

    // Check if mobile already exists
    const existingMobile = await db.findUserByMobile(cleanMobile);
    if (existingMobile) {
      return NextResponse.json(
        { error: "این شماره موبایل قبلاً ثبت شده است." },
        { status: 409 }
      );
    }

    // Hash password & create user (is_verified = false until email confirmed)
    const passwordHash = hashPassword(password);
    const user = await db.createUser({
      name: name.trim(),
      email: cleanEmail,
      mobile: cleanMobile,
      password_hash: passwordHash,
      is_verified: false,
    });

    // Generate 6-digit email verification code
    const code = generateVerificationCode();
    await db.saveVerificationCode(user.id, cleanEmail, code, 15);

    // Send verification email
    const emailResult = await sendVerificationEmail(cleanEmail, user.name, code);

    return NextResponse.json({
      success: true,
      requiresVerification: true,
      email: cleanEmail,
      demoCode: emailResult.demoCode,
      isRealDelivery: emailResult.isRealDelivery,
      message: emailResult.isRealDelivery
        ? `کد تایید ۶ رقمی به ایمیل ${cleanEmail} ارسال شد.`
        : `کد تایید ۶ رقمی تولید شد. (حالت دمو: ${code})`,
    });
  } catch (err: any) {
    console.error("[Register Error]", err);
    return NextResponse.json(
      { error: "خطایی در ثبت‌نام رخ داد. لطفاً مجدداً تلاش نمایید." },
      { status: 500 }
    );
  }
}
