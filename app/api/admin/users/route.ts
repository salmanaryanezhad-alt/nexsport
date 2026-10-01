import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasUnlimitedPlanning, isSuperAdminEmail } from "@/lib/auth/utils";
import { clearSessionCookies, getRequestToken } from "@/lib/auth/sessionToken";

export const dynamic = "force-dynamic";

async function verifyAdmin(req: NextRequest) {
  const token =
    getRequestToken(req) ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return { error: "ابتدا وارد حساب کاربری شوید.", status: 401, expired: true };
  }

  const session = await db.findSession(token);
  if (!session) {
    return { error: "نشست شما منقضی شده است. لطفاً مجدداً وارد شوید.", status: 401, expired: true };
  }

  const user = await db.findUserById(session.user_id);
  if (!user) {
    return { error: "کاربر یافت نشد.", status: 401, expired: true };
  }

  const isAdmin = isSuperAdminEmail(user.email) || user.role === "admin";

  if (!isAdmin) {
    return { error: "دسترسی غیرمجاز. این بخش منحصراً در اختیار مدیر سامانه می‌باشد.", status: 403 };
  }

  return { user };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdmin(req);
    if ("error" in auth) {
      const response = NextResponse.json(
        { error: auth.error, expired: auth.expired },
        { status: auth.status }
      );
      if (auth.expired) {
        clearSessionCookies(response);
      }
      return response;
    }

    const users = await db.listAllUsers();
    const tournaments = await db.listAdminUserTournaments();
    const tournamentCountByUser: Record<string, number> = {};
    for (const t of tournaments) {
      tournamentCountByUser[t.user_id] = (tournamentCountByUser[t.user_id] || 0) + 1;
    }

    const enriched = users.map((u) => {
      const isVip = Boolean(u.vip_expires_at && new Date(u.vip_expires_at).getTime() > Date.now());
      const unlimitedPlanning = isVip || hasUnlimitedPlanning(u);
      const planningCredits = unlimitedPlanning
        ? 999999
        : u.planning_credits !== undefined && u.planning_credits !== null
        ? Number(u.planning_credits)
        : 5;
      return {
        ...u,
        isVip,
        unlimitedPlanning,
        planningCredits,
        freeLinkAvailable: !u.free_link_used,
        vipExpiresAt: u.vip_expires_at ? new Date(u.vip_expires_at).toISOString() : null,
        tournamentCount: tournamentCountByUser[u.id] || 0,
      };
    });

    return NextResponse.json({
      success: true,
      count: enriched.length,
      users: enriched,
    });
  } catch (err: any) {
    console.error("[Admin Users GET Error]", err);
    return NextResponse.json(
      { error: "خطا در دریافت فهرست کاربران." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await verifyAdmin(req);
    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error, expired: auth.expired },
        { status: auth.status }
      );
    }

    const body = await req.json();
    const { userId, action } = body || {};

    if (!userId) {
      return NextResponse.json({ error: "شناسه کاربر الزامی است." }, { status: 400 });
    }

    const targetUser = await db.findUserById(userId);
    if (!targetUser) {
      return NextResponse.json({ error: "کاربر مورد نظر یافت نشد." }, { status: 404 });
    }

    if (action === "approve") {
      await db.markUserVerified(userId);
      return NextResponse.json({
        success: true,
        message: `حساب کاربری «${targetUser.name}» با موفقیت تایید و فعال شد.`,
      });
    }

    return NextResponse.json({ error: "عملیات نامعتبر است." }, { status: 400 });
  } catch (err: any) {
    console.error("[Admin Users PATCH Error]", err);
    return NextResponse.json({ error: "خطا در به‌روزرسانی وضعیت کاربر." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await verifyAdmin(req);
    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error, expired: auth.expired },
        { status: auth.status }
      );
    }

    let userId: string | null = null;
    const url = new URL(req.url);
    userId = url.searchParams.get("userId");
    if (!userId) {
      try {
        const body = await req.json();
        userId = body?.userId;
      } catch {
        // query param fallback
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "شناسه کاربر الزامی است." }, { status: 400 });
    }

    const targetUser = await db.findUserById(userId);
    if (!targetUser) {
      return NextResponse.json({ error: "کاربر مورد نظر یافت نشد." }, { status: 404 });
    }

    if (targetUser.is_verified) {
      return NextResponse.json(
        { error: "تنها کاربران در حال انتظار تایید ایمیل قابل حذف هستند." },
        { status: 400 }
      );
    }

    await db.deleteUnverifiedUser(userId);
    return NextResponse.json({
      success: true,
      message: `کاربر «${targetUser.name}» از سامانه حذف شد.`,
    });
  } catch (err: any) {
    console.error("[Admin Users DELETE Error]", err);
    return NextResponse.json({ error: "خطا در حذف کاربر." }, { status: 500 });
  }
}
