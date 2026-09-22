import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateVerificationCode, sendVerificationEmail } from "@/lib/auth/email";
import { cleanEmailAddress } from "@/lib/auth/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body || {};

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "لطفاً آدرس ایمیل خود را وارد نمایید." },
        { status: 400 }
      );
    }

    const cleanEmail = cleanEmailAddress(email);
    const user = await db.findUserByEmail(cleanEmail);

    if (!user) {
      // For security, don't reveal non-existent emails explicitly
      return NextResponse.json({
        success: true,
        message: "اگر حسابی با این ایمیل ثبت شده باشد، کد بازیابی ارسال گردید.",
      });
    }

    const code = generateVerificationCode();
    await db.savePasswordResetCode(user.id, cleanEmail, code, 15);
    const emailResult = await sendVerificationEmail(cleanEmail, user.name, code, "reset");

    return NextResponse.json({
      success: true,
      demoCode: emailResult.demoCode,
      isRealDelivery: emailResult.isRealDelivery,
      message: emailResult.isRealDelivery
        ? `کد بازیابی ۶ رقمی به ایمیل ${cleanEmail} ارسال شد.`
        : `کد بازیابی تولید شد. (حالت آزمایشی: ${code})`,
    });
  } catch (err: any) {
    console.error("[Forgot Password Error]", err);
    return NextResponse.json(
      { error: "خطایی در پردازش درخواست رخ داد." },
      { status: 500 }
    );
  }
}
