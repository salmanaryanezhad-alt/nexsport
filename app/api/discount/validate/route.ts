import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, itemType = "all", baseAmount = 0 } = body || {};

    if (!code || !String(code).trim()) {
      return NextResponse.json(
        { valid: false, error: "لطفاً کد تخفیف را وارد نمایید." },
        { status: 400 }
      );
    }

    const type = itemType === "link" ? "link" : "planning";
    const val = await db.validateDiscountCode(String(code), type);

    if (!val.valid) {
      return NextResponse.json(
        { valid: false, error: val.error || "کد تخفیف معتبر نیست." },
        { status: 400 }
      );
    }

    const discountPercent = val.discountPercent || 0;
    const base = Number(baseAmount) || 0;
    const discountAmount = Math.round((base * discountPercent) / 100);
    const finalAmount = Math.max(0, base - discountAmount);

    return NextResponse.json({
      valid: true,
      code: val.discount?.code,
      discountPercent,
      discountAmount,
      finalAmount,
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
