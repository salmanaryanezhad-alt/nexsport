import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { paymentService } from "@/lib/payment";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const orderId = searchParams.get("orderId");
    const authority = searchParams.get("Authority") || searchParams.get("authority") || searchParams.get("id");
    const status = searchParams.get("Status") || searchParams.get("status");

    const baseUrl = req.nextUrl.origin;

    // If user canceled at bank gateway
    if (status && status !== "OK" && status !== "100" && status !== "10") {
      return NextResponse.redirect(
        `${baseUrl}/planner?payment_status=canceled&error=${encodeURIComponent("پرداخت توسط کاربر لغو گردید.")}`
      );
    }

    if (!authority || !orderId) {
      return NextResponse.redirect(
        `${baseUrl}/planner?payment_status=error&error=${encodeURIComponent("اطلاعات بازگشت از درگاه پرداخت ناقص است.")}`
      );
    }

    // Authenticate user session
    const token = req.cookies.get("nexsport_token")?.value;
    if (!token) {
      return NextResponse.redirect(`${baseUrl}/planner?payment_status=login_required`);
    }

    const session = await db.findSession(token);
    if (!session) {
      return NextResponse.redirect(`${baseUrl}/planner?payment_status=session_expired`);
    }

    // Extract tournamentId from order if stored or query
    const tournamentId = searchParams.get("tournamentId") || "";

    const verifyResult = await paymentService.verifyPaymentCallback({
      orderId,
      authority,
      tournamentId,
      userId: session.user_id,
    });

    if (verifyResult.success) {
      return NextResponse.redirect(
        `${baseUrl}/planner?payment_status=success&refId=${verifyResult.refId}&tournamentId=${tournamentId}`
      );
    } else {
      return NextResponse.redirect(
        `${baseUrl}/planner?payment_status=failed&error=${encodeURIComponent(verifyResult.error || "تراکنش ناموفق بود.")}`
      );
    }
  } catch (err) {
    console.error("[Payment Callback Error]", err);
    return NextResponse.redirect(
      `${req.nextUrl.origin}/planner?payment_status=error`
    );
  }
}
