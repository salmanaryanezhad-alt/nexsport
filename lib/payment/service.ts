import { db } from "@/lib/db";
import {
  PaymentGatewayDriver,
  PaymentGatewayType,
  PaymentOrder,
  DEDICATED_LINK_PRICE_TOMANS,
} from "./types";
import { MockGateway } from "./gateways/mockGateway";
import { ZarinpalGateway } from "./gateways/zarinpalGateway";
import { IdpayGateway } from "./gateways/idpayGateway";

/**
 * Payment Service orchestrating transactions, orders, and tournament link unlocking.
 * Switching gateways is as simple as setting PAYMENT_GATEWAY=zarinpal in .env.
 */
class PaymentService {
  private activeDriver: PaymentGatewayDriver;

  constructor() {
    this.activeDriver = this.resolveDriver();
  }

  private resolveDriver(): PaymentGatewayDriver {
    const gatewayEnv = (process.env.PAYMENT_GATEWAY || "mock").toLowerCase();
    switch (gatewayEnv) {
      case "zarinpal":
        return new ZarinpalGateway();
      case "idpay":
        return new IdpayGateway();
      case "mock":
      default:
        return new MockGateway();
    }
  }

  /**
   * For testing or dynamic reconfiguration
   */
  public setGatewayDriver(driver: PaymentGatewayDriver) {
    this.activeDriver = driver;
  }

  public getActiveGateway(): PaymentGatewayType {
    return this.activeDriver.gatewayName;
  }

  /**
   * Check if a tournament's dedicated link has been paid for and unlocked
   */
  async isTournamentPaid(tournamentId: string): Promise<boolean> {
    try {
      const tournament = await db.getPublicTournament(tournamentId);
      if (!tournament) return false;
      return Boolean(tournament.state?.payment?.isPaid);
    } catch {
      return false;
    }
  }

  /**
   * Get full payment metadata for a tournament
   */
  async getTournamentPaymentInfo(tournamentId: string) {
    const tournament = await db.getPublicTournament(tournamentId);
    if (!tournament) return null;
    return tournament.state?.payment || null;
  }

  /**
   * Start payment for dedicated tournament link
   */
  async initiateTournamentPayment(params: {
    tournamentId: string;
    userId: string;
    userEmail?: string;
    userMobile?: string;
    origin?: string;
  }) {
    const { tournamentId, userId, userEmail, userMobile, origin } = params;

    const tournament = await db.getTournament(tournamentId, userId);
    if (!tournament) {
      return {
        success: false,
        error: "مسابقه مورد نظر یافت نشد یا شما دسترسی ویرایش آن را ندارید.",
      };
    }

    // Check if already paid
    if (tournament.state?.payment?.isPaid) {
      return {
        success: true,
        alreadyPaid: true,
        isDirectSuccess: true,
        paymentInfo: tournament.state.payment,
        tournamentId,
      };
    }

    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const baseUrl = origin || (process.env.NEXT_PUBLIC_BASE_URL || "https://nexsport.ir");
    const callbackUrl = `${baseUrl}/api/payment/callback?orderId=${orderId}`;

    const initResult = await this.activeDriver.initiatePayment({
      orderId,
      amountTomans: DEDICATED_LINK_PRICE_TOMANS,
      description: `فعال‌سازی لینک اختصاصی مسابقه «${tournament.title}» در NexSport`,
      callbackUrl,
      email: userEmail,
      mobile: userMobile,
    });

    if (!initResult.success) {
      return {
        success: false,
        error: initResult.error || "خطا در اتصال به سرویس پرداخت.",
      };
    }

    // If driver operates in direct/mock simulation (instant approval):
    if (initResult.isDirectSuccess) {
      const paymentInfo = {
        isPaid: true,
        amount: DEDICATED_LINK_PRICE_TOMANS,
        currency: "TOMAN",
        gateway: this.activeDriver.gatewayName,
        orderId,
        refId: initResult.refId || `TRX-${Math.floor(10000000 + Math.random() * 90000000)}`,
        paidAt: new Date().toISOString(),
      };

      // Save payment status into tournament state
      const updatedState = {
        ...tournament.state,
        payment: paymentInfo,
      };

      await db.saveTournament({
        id: tournament.id,
        userId: tournament.user_id,
        title: tournament.title,
        format: tournament.format,
        sport: tournament.sport || undefined,
        teamCount: tournament.team_count,
        state: updatedState,
      });

      return {
        success: true,
        isDirectSuccess: true,
        isPaid: true,
        orderId,
        refId: paymentInfo.refId,
        paymentInfo,
        tournamentId,
      };
    }

    // Otherwise, driver returned a real bank payment URL to redirect user
    return {
      success: true,
      isDirectSuccess: false,
      paymentUrl: initResult.paymentUrl,
      authority: initResult.authority,
      orderId,
      tournamentId,
    };
  }

  /**
   * Verify callback from external gateway (when real gateway like ZarinPal is connected)
   */
  async verifyPaymentCallback(params: {
    orderId: string;
    authority: string;
    tournamentId: string;
    userId: string;
  }) {
    const verifyRes = await this.activeDriver.verifyPayment({
      orderId: params.orderId,
      authority: params.authority,
      amountTomans: DEDICATED_LINK_PRICE_TOMANS,
    });

    if (!verifyRes.success) {
      return {
        success: false,
        error: verifyRes.error || "تراکنش بانکی تایید نشد.",
      };
    }

    const tournament = await db.getTournament(params.tournamentId, params.userId);
    if (tournament) {
      const paymentInfo = {
        isPaid: true,
        amount: DEDICATED_LINK_PRICE_TOMANS,
        currency: "TOMAN",
        gateway: this.activeDriver.gatewayName,
        orderId: params.orderId,
        refId: verifyRes.refId,
        cardPan: verifyRes.cardPan,
        paidAt: new Date().toISOString(),
      };

      const updatedState = {
        ...tournament.state,
        payment: paymentInfo,
      };

      await db.saveTournament({
        id: tournament.id,
        userId: tournament.user_id,
        title: tournament.title,
        format: tournament.format,
        sport: tournament.sport || undefined,
        teamCount: tournament.team_count,
        state: updatedState,
      });

      return {
        success: true,
        refId: verifyRes.refId,
        paymentInfo,
      };
    }

    return {
      success: true,
      refId: verifyRes.refId,
    };
  }
}

export const paymentService = new PaymentService();
