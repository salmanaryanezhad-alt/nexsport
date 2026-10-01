import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdminRequest } from "@/lib/auth/adminGuard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error, expired: auth.expired },
        { status: auth.status }
      );
    }

    const userId = req.nextUrl.searchParams.get("userId") || undefined;
    const tournaments = await db.listAdminUserTournaments(userId || undefined);

    return NextResponse.json({
      success: true,
      count: tournaments.length,
      tournaments,
    });
  } catch (err: any) {
    console.error("[Admin Tournaments GET Error]", err);
    return NextResponse.json({ error: "خطا در دریافت فهرست مسابقات کاربران." }, { status: 500 });
  }
}
