import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateVerificationCode, sendVerificationEmail } from "@/lib/auth/email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body || {};

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "آدرس ایمیل الزامی است." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await db.findUserByEmail(cleanEmail);

    if (!user) {
      return NextResponse.json(
        { error: "کاربری با این ایمیل یافت نشد." },
        { status: 404 }
      );
    }

    const code = generateVerificationCode();
    await db.saveVerificationCode(user.id, cleanEmail, code, 15);
    const emailResult = await sendVerificationEmail(cleanEmail, user.name, code);

    return NextResponse.json({
      success: true,
      demoCode: emailResult.demoCode,
      isRealDelivery: emailResult.isRealDelivery,
      message: emailResult.isRealDelivery
        ? `کد تایید جدید به ایمیل ${cleanEmail} ارسال شد.`
        : `کد تایید جدید تولید شد. (حالت دمو: ${code})`,
    });
  } catch (err: any) {
    console.error("[Resend Code Error]", err);
    return NextResponse.json(
      { error: "خطایی در ارسال مجدد کد رخ داد." },
      { status: 500 }
    );
  }
}
