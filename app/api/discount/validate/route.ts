import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyCouponOnFinal, DiscountItemType, DISCOUNT_ITEM_TYPES } from "@/lib/payment/pricing";
import { readDiscountCatalogCookie } from "@/lib/auth/discountCatalog";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES: DiscountItemType[] = [...DISCOUNT_ITEM_TYPES];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, itemType = "credits", baseAmount = 0 } = body || {};

    if (!code || !String(code).trim()) {
      return NextResponse.json(
        { valid: false, error: "لطفاً کد تخفیف را وارد نمایید." },
        { status: 400 }
      );
    }

    const type: DiscountItemType = ALLOWED_TYPES.includes(itemType)
      ? itemType
      : itemType === "planning"
      ? "credits"
      : "credits";

    const catalog = readDiscountCatalogCookie(req);
    const val = await db.validateDiscountCode(String(code), type, catalog);

    if (!val.valid) {
      return NextResponse.json(
        { valid: false, error: val.error || "کد تخفیف معتبر نیست." },
        { status: 400 }
      );
    }

    const discountPercent = val.discountPercent || 0;
    const stacked = applyCouponOnFinal(Number(baseAmount) || 0, discountPercent);

    return NextResponse.json({
      valid: true,
      code: val.discount?.code,
      discountPercent,
      discountAmount: stacked.discountAmount,
      finalAmount: stacked.finalAmount,
      appliesTo: val.discount?.applies_to,
    });
  } catch (err: any) {
    console.error("[Validate Discount Error]", err);
    return NextResponse.json(
      { valid: false, error: "خطا در بررسی کد تخفیف." },
      { status: 500 }
    );
  }
}
