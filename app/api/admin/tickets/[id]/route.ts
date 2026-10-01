import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdminRequest } from "@/lib/auth/adminGuard";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdminRequest(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const ticket = await db.getTicket(params.id);
    if (!ticket) {
      return NextResponse.json({ error: "تیکت یافت نشد." }, { status: 404 });
    }

    const messages = await db.listTicketMessages(ticket.id);
    return NextResponse.json({ success: true, ticket, messages });
  } catch (err: any) {
    console.error("[Admin Ticket GET Error]", err);
    return NextResponse.json({ error: "خطا در دریافت تیکت." }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdminRequest(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const ticket = await db.getTicket(params.id);
    if (!ticket) {
      return NextResponse.json({ error: "تیکت یافت نشد." }, { status: 404 });
    }

    const payload = await req.json();
    const text = String(payload?.body || "").trim();
    if (text.length < 2 || text.length > 4000) {
      return NextResponse.json(
        { error: "متن پاسخ باید بین ۲ تا ۴۰۰۰ کاراکتر باشد." },
        { status: 400 }
      );
    }

    const message = await db.addTicketMessage({
      ticketId: ticket.id,
      sender: "admin",
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
    console.error("[Admin Ticket Reply Error]", err);
    return NextResponse.json({ error: "خطا در ارسال پاسخ." }, { status: 500 });
  }
}
