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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdmin(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = params;
    const body = await req.json();
    const { isActive } = body;

    const updated = await db.toggleDiscountCode(id, isActive);
    if (!updated) {
      return NextResponse.json(
        { error: "کد تخفیف مورد نظر یافت نشد." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      discount: updated,
    });
  } catch (err: any) {
    console.error("[Admin Discounts PATCH Error]", err);
    return NextResponse.json(
      { error: "خطا در تغییر وضعیت کد تخفیف." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdmin(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = params;
    const deleted = await db.deleteDiscountCode(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "کد تخفیف مورد نظر یافت نشد یا قبلاً حذف شده است." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "کد تخفیف با موفقیت حذف گردید.",
    });
  } catch (err: any) {
    console.error("[Admin Discounts DELETE Error]", err);
    return NextResponse.json(
      { error: "خطا در حذف کد تخفیف." },
      { status: 500 }
    );
  }
}
