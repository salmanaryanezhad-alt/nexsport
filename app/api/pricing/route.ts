import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildVipPlans, CREDIT_PRESETS } from "@/lib/payment/pricing";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await db.getPricingSettings();
    return NextResponse.json({
      success: true,
      settings,
      vipPlans: buildVipPlans(settings),
      creditPresets: CREDIT_PRESETS,
    });
  } catch (err: any) {
    console.error("[Public Pricing GET Error]", err);
    return NextResponse.json({ error: "خطا در دریافت تعرفه‌ها." }, { status: 500 });
  }
}
