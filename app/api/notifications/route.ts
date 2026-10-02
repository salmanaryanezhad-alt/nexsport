import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySessionRequest } from "@/lib/auth/sessionGuard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifySessionRequest(req);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const items = await db.listNotifications(auth.user.id, 40);
    const unreadCount = await db.countUnreadNotifications(auth.user.id);
    return NextResponse.json({
      success: true,
      unreadCount,
      notifications: items.map((n) => ({
        ...n,
        created_at: n.created_at.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[Notifications GET]", err);
    return NextResponse.json({ error: "خطا در دریافت اعلان‌ها." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifySessionRequest(req);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : undefined;
    await db.markNotificationsRead(auth.user.id, ids);
    return NextResponse.json({ success: true, unreadCount: 0 });
  } catch (err) {
    console.error("[Notifications POST]", err);
    return NextResponse.json({ error: "خطا در به‌روزرسانی اعلان‌ها." }, { status: 500 });
  }
}
