import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdminRequest } from "@/lib/auth/adminGuard";
import { buildVipPlans, sanitizePricingSettings } from "@/lib/payment/pricing";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const settings = await db.getPricingSettings();
    return NextResponse.json({
      success: true,
      settings,
      vipPlans: buildVipPlans(settings),
    });
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

    return NextResponse.json({
      success: true,
      settings,
      vipPlans: buildVipPlans(settings),
    });
  } catch (err: any) {
    console.error("[Admin Pricing PUT Error]", err);
    return NextResponse.json({ error: "خطا در ذخیره تنظیمات مالی." }, { status: 500 });
  }
}
