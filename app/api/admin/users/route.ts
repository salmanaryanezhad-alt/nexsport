import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cleanEmailAddress } from "@/lib/auth/utils";

export const dynamic = "force-dynamic";

async function verifyAdmin(req: NextRequest) {
  const token =
    req.cookies.get("nexsport_token")?.value ||
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

  const isSalman = cleanEmailAddress(user.email) === "salman.aryanezhad@gmail.com";
  const isAdmin = isSalman || user.role === "admin";

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
        response.cookies.set("nexsport_token", "", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 0,
        });
      }
      return response;
    }

    const users = await db.listAllUsers();
    return NextResponse.json({
      success: true,
      count: users.length,
      users,
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
