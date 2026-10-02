import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdminRequest } from "@/lib/auth/adminGuard";
import { buildVipPlans, buildClubProPlans, sanitizePricingSettings } from "@/lib/payment/pricing";
import { readPricingCookie, resolvePricingSettings, writePricingCookie } from "@/lib/auth/pricingCookie";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const stored = await db.getPricingSettings();
    const settings = resolvePricingSettings(stored, readPricingCookie(req));
    const response = NextResponse.json({
      success: true,
      settings,
      vipPlans: buildVipPlans(settings),
      clubProPlans: buildClubProPlans(settings),
    });
    writePricingCookie(response, settings);
    return response;
  } catch (err: any) {
    console.error("[Admin Pricing GET Error]", err);
    return NextResponse.json({ error: "خطا در دریافت تنظیمات مالی." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const settings = await db.savePricingSettings(sanitizePricingSettings(body));
    const response = NextResponse.json({
      success: true,
      settings,
      vipPlans: buildVipPlans(settings),
      clubProPlans: buildClubProPlans(settings),
    });
    writePricingCookie(response, settings);
    return response;
  } catch (err: any) {
    console.error("[Admin Pricing PUT Error]", err);
    return NextResponse.json({ error: "خطا در ذخیره تنظیمات مالی." }, { status: 500 });
  }
}
