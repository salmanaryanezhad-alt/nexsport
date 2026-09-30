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

    const isPaid = await paymentService.isTournamentPaid(tournamentId);
    const paymentInfo = await paymentService.getTournamentPaymentInfo(tournamentId);

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
