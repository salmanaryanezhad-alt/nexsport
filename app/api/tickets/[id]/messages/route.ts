import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySessionRequest } from "@/lib/auth/sessionGuard";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifySessionRequest(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const ticket = await db.getTicket(params.id);
    if (!ticket) {
      return NextResponse.json({ error: "تیکت یافت نشد." }, { status: 404 });
    }
    if (ticket.user_id !== auth.user.id) {
      return NextResponse.json({ error: "دسترسی غیرمجاز." }, { status: 403 });
    }

    const payload = await req.json();
    const text = String(payload?.body || "").trim();
    if (text.length < 2 || text.length > 4000) {
      return NextResponse.json(
        { error: "متن پیام باید بین ۲ تا ۴۰۰۰ کاراکتر باشد." },
        { status: 400 }
      );
    }

    const message = await db.addTicketMessage({
      ticketId: ticket.id,
      sender: "user",
      body: text,
    });

    const updated = await db.getTicket(ticket.id);
    const messages = await db.listTicketMessages(ticket.id);

    return NextResponse.json({
      success: true,
      message,
      ticket: updated,
      messages,
    });
  } catch (err: any) {
    console.error("[Ticket Reply Error]", err);
    return NextResponse.json({ error: "خطا در ارسال پیام." }, { status: 500 });
  }
}
