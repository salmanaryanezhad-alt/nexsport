import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySessionRequest } from "@/lib/auth/sessionGuard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifySessionRequest(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const unreadCount = await db.countUserUnreadTickets(auth.user.id);
    const unansweredCount = auth.isAdmin ? await db.countUnansweredTickets() : 0;

    return NextResponse.json({
      success: true,
      unreadCount,
      unansweredCount,
    });
  } catch (err: any) {
    console.error("[Tickets Badge Error]", err);
    return NextResponse.json({ unreadCount: 0, unansweredCount: 0 });
  }
}
