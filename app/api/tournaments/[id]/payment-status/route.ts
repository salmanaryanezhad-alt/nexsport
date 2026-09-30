import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { paymentService } from "@/lib/payment";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const tournamentId = resolvedParams.id;
    if (!tournamentId) {
      return NextResponse.json({ error: "شناسه مسابقه نامعتبر است." }, { status: 400 });
    }

    let isPaid = await paymentService.isTournamentPaid(tournamentId);
    let paymentInfo = await paymentService.getTournamentPaymentInfo(tournamentId);

    if (!isPaid) {
      const cookieVal = req.cookies.get(`nexsport_t_${tournamentId}`)?.value;
      if (cookieVal) {
        const { decodeTournamentPayload } = await import("@/lib/tournamentCodec");
        const decoded = decodeTournamentPayload(cookieVal);
        if (decoded?.state?.payment?.isPaid) {
          isPaid = true;
          paymentInfo = decoded.state.payment;
        }
      }
    }

    return NextResponse.json({
      tournamentId,
      isPaid,
      paymentInfo,
    });
  } catch (err: any) {
    console.error("[Get Payment Status Error]", err);
    return NextResponse.json(
      { error: "خطا در استعلام وضعیت پرداخت." },
      { status: 500 }
    );
  }
}
