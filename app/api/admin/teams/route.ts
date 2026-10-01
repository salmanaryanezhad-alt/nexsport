import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdminRequest } from "@/lib/auth/adminGuard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error, expired: auth.expired }, { status: auth.status });
    }
    const teams = await db.listAllTeams();
    return NextResponse.json({ success: true, teams });
  } catch (err) {
    console.error("[Admin Teams GET]", err);
    return NextResponse.json({ error: "خطا در دریافت تیم‌های کاربران." }, { status: 500 });
  }
}
