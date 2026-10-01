import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clearSessionCookies, getRequestToken } from "@/lib/auth/sessionToken";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  try {
    const token = getRequestToken(req);
    if (!token) {
      return NextResponse.json({ error: "ابتدا وارد حساب کاربری خود شوید.", expired: true }, { status: 401 });
    }

    const session = await db.findSession(token);
    if (!session) {
      const response = NextResponse.json(
        { error: "نشست شما منقضی شده است. لطفاً مجدداً وارد شوید.", expired: true },
        { status: 401 }
      );
      clearSessionCookies(response);
      return response;
    }

    const body = await req.json();
    const { name } = body || {};

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "نام و نام خانوادگی الزامی است." }, { status: 400 });
    }

    const updatedUser = await db.updateUserProfile(session.user_id, name.trim());
    if (!updatedUser) {
      return NextResponse.json({ error: "کاربر یافت نشد." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "اطلاعات با موفقیت به‌روزرسانی شد.",
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        is_verified: updatedUser.is_verified,
        role: updatedUser.role,
      },
    });
  } catch (err: any) {
    console.error("[Profile Update Error]", err);
    return NextResponse.json({ error: "خطایی در ویرایش مشخصات رخ داد." }, { status: 500 });
  }
}
