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

    const tickets = await db.listUserTickets(auth.user.id);
    return NextResponse.json({
      success: true,
      tickets,
      unreadCount: tickets.filter((t) => t.user_has_unread).length,
    });
  } catch (err: any) {
    console.error("[Tickets GET Error]", err);
    return NextResponse.json({ error: "خطا در دریافت تیکت‌ها." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifySessionRequest(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const subject = String(body?.subject || "").trim();
    const text = String(body?.body || "").trim();

    if (subject.length < 3 || subject.length > 120) {
      return NextResponse.json(
        { error: "موضوع تیکت باید بین ۳ تا ۱۲۰ کاراکتر باشد." },
        { status: 400 }
      );
    }
    if (text.length < 8 || text.length > 4000) {
      return NextResponse.json(
        { error: "متن پیام باید بین ۸ تا ۴۰۰۰ کاراکتر باشد." },
        { status: 400 }
      );
    }

    const created = await db.createTicket({
      userId: auth.user.id,
      subject,
      body: text,
    });

    return NextResponse.json({
      success: true,
      ticket: created.ticket,
      message: created.message,
    });
  } catch (err: any) {
    console.error("[Tickets POST Error]", err);
    return NextResponse.json({ error: "خطا در ثبت تیکت." }, { status: 500 });
  }
}
