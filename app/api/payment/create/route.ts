import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { paymentService } from "@/lib/payment";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("nexsport_token")?.value;
    if (!token) {
      return NextResponse.json(
        { error: "جهت انجام پرداخت، لطفاً ابتدا وارد حساب کاربری خود شوید.", expired: true },
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
    const { itemType, tournamentId, creditCount, vipPlanId } = body || {};
    const origin = req.nextUrl.origin;

    // 1. Credit Package Purchase (بسته تعداد برنامه‌ریزی)
    if (itemType === "planning_credits") {
      const count = Number(creditCount) || 5;
      const result = await paymentService.initiateCreditPackagePayment({
        userId: user.id,
        creditCount: count,
        userEmail: user.email,
        userMobile: user.mobile || undefined,
        origin,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error || "خطا در خرید بسته اعتباری." }, { status: 400 });
      }

      return NextResponse.json(result);
    }

    // 2. VIP Membership Subscription Purchase (اشتراک کاربر ویژه)
    if (itemType === "vip_subscription") {
      const planId = String(vipPlanId || "vip-1m");
      const result = await paymentService.initiateVipPayment({
        userId: user.id,
        vipPlanId: planId,
        userEmail: user.email,
        userMobile: user.mobile || undefined,
        origin,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error || "خطا در خرید اشتراک ویژه." }, { status: 400 });
      }

      return NextResponse.json(result);
    }

    // 3. Tournament Dedicated Spectator Link (فعال‌سازی لینک اختصاصی مسابقه)
    if (tournamentId || itemType === "tournament_link") {
      const tid = String(tournamentId);
      if (!tid) {
        return NextResponse.json(
          { error: "شناسه مسابقه جهت فعال‌سازی پرداخت ارسال نشده است." },
          { status: 400 }
        );
      }

      const result = await paymentService.initiateTournamentPayment({
        tournamentId: tid,
        userId: user.id,
        userEmail: user.email,
        userMobile: user.mobile || undefined,
        origin,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error || "خطا در پردازش فعال‌سازی لینک." }, { status: 400 });
      }

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "نوع درخواست پرداخت نامعتبر است." }, { status: 400 });
  } catch (err: any) {
    console.error("[Create Payment Error]", err);
    return NextResponse.json(
      { error: "خطای سرور در ایجاد درخواست پرداخت." },
      { status: 500 }
    );
  }
}
