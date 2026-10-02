import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdminRequest } from "@/lib/auth/adminGuard";
import {
  mergeDiscountRecords,
  readDiscountCatalogCookie,
  writeDiscountCatalogCookie,
} from "@/lib/auth/discountCatalog";
import { parseAppliesTo, serializeAppliesTo } from "@/lib/payment/pricing";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const stored = await db.listDiscountCodes();
    const discounts = mergeDiscountRecords(readDiscountCatalogCookie(req), stored);
    const response = NextResponse.json({
      success: true,
      count: discounts.length,
      discounts,
    });
    writeDiscountCatalogCookie(response, discounts);
    return response;
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
    const auth = await verifyAdminRequest(req);
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

    const appliesItems = parseAppliesTo(appliesTo);
    if (appliesItems.length === 0) {
      return NextResponse.json(
        { error: "حداقل یک بخش پرداخت را برای کد تخفیف انتخاب کنید." },
        { status: 400 }
      );
    }
    const appliesSerialized = serializeAppliesTo(appliesItems);

    const created = await db.createDiscountCode({
      code: String(code).trim().toUpperCase(),
      discountPercent: percent,
      appliesTo: appliesSerialized,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: Boolean(isActive),
      createdBy: auth.user.email,
    });

    const discounts = mergeDiscountRecords(
      readDiscountCatalogCookie(req),
      await db.listDiscountCodes(),
      [created]
    );
    const response = NextResponse.json({
      success: true,
      discount: created,
    });
    writeDiscountCatalogCookie(response, discounts);
    return response;
  } catch (err: any) {
    console.error("[Admin Discounts POST Error]", err);
    return NextResponse.json(
      { error: err?.message || "خطا در ایجاد کد تخفیف جدید." },
      { status: 500 }
    );
  }
}
