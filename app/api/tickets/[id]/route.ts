import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySessionRequest } from "@/lib/auth/sessionGuard";

export const dynamic = "force-dynamic";

export async function GET(
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
    if (ticket.user_id !== auth.user.id && !auth.isAdmin) {
      return NextResponse.json({ error: "دسترسی غیرمجاز." }, { status: 403 });
    }

    if (ticket.user_id === auth.user.id && ticket.user_has_unread) {
      await db.markTicketReadByUser(ticket.id, auth.user.id);
      ticket.user_has_unread = false;
    }

    const messages = await db.listTicketMessages(ticket.id);
    return NextResponse.json({ success: true, ticket, messages });
  } catch (err: any) {
    console.error("[Ticket GET Error]", err);
    return NextResponse.json({ error: "خطا در دریافت تیکت." }, { status: 500 });
  }
}
