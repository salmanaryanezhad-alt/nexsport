import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdminRequest } from "@/lib/auth/adminGuard";

export const dynamic = "force-dynamic";

function sanitizeLink(raw: unknown): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (!s.startsWith("/") || s.startsWith("//") || s.includes("://")) return "";
  return s.slice(0, 200);
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const body = await req.json().catch(() => ({}));
    const title = String(body.title || "").trim().slice(0, 120);
    const message = String(body.body || body.message || "").trim().slice(0, 800);
    const link = sanitizeLink(body.link);
    if (title.length < 3) {
      return NextResponse.json({ error: "عنوان پیام حداقل ۳ نویسه باشد." }, { status: 400 });
    }
    if (message.length < 3) {
      return NextResponse.json({ error: "متن پیام حداقل ۳ نویسه باشد." }, { status: 400 });
    }
    const sent = await db.broadcastNotification({ title, body: message, link });
    return NextResponse.json({ success: true, sent });
  } catch (err) {
    console.error("[Admin Broadcast]", err);
    return NextResponse.json({ error: "خطا در ارسال پیام عمومی." }, { status: 500 });
  }
}
