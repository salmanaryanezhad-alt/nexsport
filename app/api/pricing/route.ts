import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildVipPlans, buildClubProPlans, CREDIT_PRESETS } from "@/lib/payment/pricing";
import { readPricingCookie, resolvePricingSettings, writePricingCookie } from "@/lib/auth/pricingCookie";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const stored = await db.getPricingSettings();
    const settings = resolvePricingSettings(stored, readPricingCookie(req));
    const response = NextResponse.json({
      success: true,
      settings,
      vipPlans: buildVipPlans(settings),
      clubProPlans: buildClubProPlans(settings),
      creditPresets: CREDIT_PRESETS,
    });
    writePricingCookie(response, settings);
    return response;
  } catch (err: any) {
    console.error("[Public Pricing GET Error]", err);
    return NextResponse.json({ error: "خطا در دریافت تعرفه‌ها." }, { status: 500 });
  }
}
