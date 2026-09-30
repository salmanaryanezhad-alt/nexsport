import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { paymentService } from "@/lib/payment";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("nexsport_token")?.value;
    if (!token) {
      return NextResponse.json(
        { error: "برای فعال‌سازی لینک اختصاصی، لطفاً ابتدا وارد حساب کاربری خود شوید.", expired: true },
        { status: 401 }
      );
    }

    const session = await db.findSession(token);
    if (!session) {
      return NextResponse.json(
        { error: "نشست شما منقضی شده است. لطفاً مجدداً وارد حساب شوید.", expired: true },
        { status: 401 }
      );
    }

    const user = await db.findUserById(session.user_id);
    if (!user) {
      return NextResponse.json({ error: "کاربر یافت نشد." }, { status: 404 });
    }

    const body = await req.json();
    const { tournamentId } = body || {};

    if (!tournamentId) {
      return NextResponse.json(
        { error: "شناسه مسابقه جهت فعال‌سازی پرداخت ارسال نشده است." },
        { status: 400 }
      );
    }

    const origin = req.nextUrl.origin;

    const result = await paymentService.initiateTournamentPayment({
      tournamentId: String(tournamentId),
      userId: user.id,
      userEmail: user.email,
      userMobile: user.mobile || undefined,
      origin,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "خطا در پردازش پرداخت." }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[Create Payment Error]", err);
    return NextResponse.json(
      { error: "خطای سرور در ایجاد درخواست پرداخت." },
      { status: 500 }
    );
  }
}
