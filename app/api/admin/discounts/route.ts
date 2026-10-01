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
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const discounts = await db.listDiscountCodes();
    return NextResponse.json({
      success: true,
      count: discounts.length,
      discounts,
    });
  } catch (err: any) {
    console.error("[Admin Discounts GET Error]", err);
    return NextResponse.json(
      { error: "خطا در دریافت لیست کدهای تخفیف." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdmin(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const { code, discountPercent, appliesTo = "all", expiresAt = null, isActive = true } = body || {};

    if (!code || !String(code).trim()) {
      return NextResponse.json(
        { error: "کد تخفیف نمی‌تواند خالی باشد." },
        { status: 400 }
      );
    }

    const percent = Number(discountPercent);
    if (isNaN(percent) || percent < 1 || percent > 100) {
      return NextResponse.json(
        { error: "درصد تخفیف باید عددی بین ۱ تا ۱۰۰ باشد." },
        { status: 400 }
      );
    }

    if (!["credits", "vip", "link", "planning", "all"].includes(appliesTo)) {
      return NextResponse.json(
        { error: "نوع اعمال نامعتبر است." },
        { status: 400 }
      );
    }

    const created = await db.createDiscountCode({
      code: String(code).trim().toUpperCase(),
      discountPercent: percent,
      appliesTo,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: Boolean(isActive),
      createdBy: auth.user.email,
    });

    return NextResponse.json({
      success: true,
      discount: created,
    });
  } catch (err: any) {
    console.error("[Admin Discounts POST Error]", err);
    return NextResponse.json(
      { error: err?.message || "خطا در ایجاد کد تخفیف جدید." },
      { status: 500 }
    );
  }
}
