import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { GUEST_MAX_TOURNAMENTS } from "@/lib/payment/pricing";
import { resolveSessionUser } from "@/lib/auth/sessionGuard";

export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("nexsport_token")?.value;
    if (token) {
      const session = await db.findSession(token);
      if (session) {
        const user = await resolveSessionUser(session);
        const quota = await db.getUserQuota(session.user_id);
        const hasDbUser = Boolean(user && quota.role !== "guest");
        return NextResponse.json({
          isGuest: false,
          planningCredits: hasDbUser ? quota.planningCredits : 5,
          freeLinkAvailable: hasDbUser ? quota.freeLinkAvailable : true,
          isVip: quota.isVip,
          vipExpiresAt: quota.vipExpiresAt ? quota.vipExpiresAt.toISOString() : null,
          role: user?.role || quota.role || "user",
        });
      }
    }

    // Guest user (unregistered)
    const ip = getClientIp(req);
    const guestUsage = await db.getGuestUsage(ip);

    return NextResponse.json({
      isGuest: true,
      guestCount: guestUsage.count,
      guestLimit: GUEST_MAX_TOURNAMENTS,
      remaining: guestUsage.remaining,
      ip: guestUsage.ip,
    });
  } catch (err: any) {
    console.error("[Get Quota Error]", err);
    return NextResponse.json(
      { error: "خطا در بررسی سهمیه کاربری." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("nexsport_token")?.value;
    if (token) {
      const session = await db.findSession(token);
      if (session) {
        const consumeResult = await db.consumePlanningCredit(session.user_id);
        if (!consumeResult.success) {
          return NextResponse.json(
            {
              success: false,
              error: consumeResult.error || "سقف برنامه‌ریزی مسابقات شما به اتمام رسیده است.",
              remaining: 0,
              needsPurchase: true,
            },
            { status: 403 }
          );
        }

        return NextResponse.json({
          success: true,
          isGuest: false,
          isVip: consumeResult.isVip,
          remaining: consumeResult.remainingCredits,
        });
      }
    }

    // Guest user
    const ip = getClientIp(req);
    const guestResult = await db.recordGuestUsage(ip);
    if (!guestResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "سقف ۲ برنامه‌ریزی مسابقه رایگان مهمان برای این دستگاه تکمیل شده است. لطفاً ثبت‌نام کنید یا وارد شوید.",
          remaining: 0,
          needsAuth: true,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      isGuest: true,
      count: guestResult.count,
      remaining: guestResult.remaining,
    });
  } catch (err: any) {
    console.error("[Consume Quota Error]", err);
    return NextResponse.json(
      { error: "خطا در ثبت استفاده از سهمیه مسابقات." },
      { status: 500 }
    );
  }
}
