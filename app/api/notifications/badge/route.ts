import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySessionRequest } from "@/lib/auth/sessionGuard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifySessionRequest(req);
    if ("error" in auth) return NextResponse.json({ unreadCount: 0 });
    const unreadCount = await db.countUnreadNotifications(auth.user.id);
    return NextResponse.json({ success: true, unreadCount });
  } catch {
    return NextResponse.json({ unreadCount: 0 });
  }
}
