import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdminRequest } from "@/lib/auth/adminGuard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const tickets = await db.listAdminTickets();
    const unansweredCount = tickets.filter((t) => t.status === "unanswered").length;

    return NextResponse.json({
      success: true,
      tickets,
      unansweredCount,
      answeredCount: tickets.length - unansweredCount,
    });
  } catch (err: any) {
    console.error("[Admin Tickets GET Error]", err);
    return NextResponse.json({ error: "خطا در دریافت تیکت‌ها." }, { status: 500 });
  }
}
