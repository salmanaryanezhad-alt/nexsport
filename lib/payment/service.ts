import { db } from "@/lib/db";
import {
  PaymentGatewayDriver,
  PaymentGatewayType,
  PaymentOrder,
  DEDICATED_LINK_PRICE_TOMANS,
  calculateCreditPrice,
  VIP_PLANS,
} from "./types";
import { MockGateway } from "./gateways/mockGateway";
import { ZarinpalGateway } from "./gateways/zarinpalGateway";
import { IdpayGateway } from "./gateways/idpayGateway";

/**
 * Payment Service orchestrating transactions, orders, tournament link unlocking,
 * planning credit packages, and VIP subscriptions.
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
   * - VIP Users: 100% FREE!
   * - Registered Normal Users (1st link): 100% FREE gift!
   * - Subsequent Links: Standard 200,000 Tomans.
   */
  async initiateTournamentPayment(params: {
    tournamentId: string;
    userId: string;
    userEmail?: string;
    userMobile?: string;
    origin?: string;
    useFreeGift?: boolean;
  }) {
    const { tournamentId, userId, userEmail, userMobile, origin, useFreeGift } = params;

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

    const userQuota = await db.getUserQuota(userId);

    // 1. VIP members: All dedicated links are 100% FREE!
    if (userQuota.isVip) {
      const paymentInfo = {
        isPaid: true,
        amount: 0,
        currency: "TOMAN",
        gateway: "vip_free",
        orderId: `vip_${Date.now()}`,
        refId: `TRX-VIP-${Math.floor(10000000 + Math.random() * 90000000)}`,
        paidAt: new Date().toISOString(),
        note: "لینک اختصاصی رایگان عضو ویژه VIP",
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
        isDirectSuccess: true,
        isPaid: true,
        isVipFree: true,
        orderId: paymentInfo.orderId,
        refId: paymentInfo.refId,
        paymentInfo,
        tournamentId,
      };
    }

    // 2. Normal registered users with free link gift:
    if (useFreeGift && userQuota.freeLinkAvailable) {
      await db.useFreeLink(userId);

      const paymentInfo = {
        isPaid: true,
        amount: 0,
        currency: "TOMAN",
        gateway: "free_gift",
        orderId: `gift_${Date.now()}`,
        refId: `TRX-GIFT-${Math.floor(10000000 + Math.random() * 90000000)}`,
        paidAt: new Date().toISOString(),
        note: "هدیه اولین ایجاد لینک رایگان ثبت‌نام",
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
        isDirectSuccess: true,
        isPaid: true,
        isFreeGift: true,
        orderId: paymentInfo.orderId,
        refId: paymentInfo.refId,
        paymentInfo,
        tournamentId,
      };
    }

    // 3. Otherwise: standard 200,000 Tomans
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const baseUrl = origin || (process.env.NEXT_PUBLIC_BASE_URL || "https://nexsport.ir");
    const callbackUrl = `${baseUrl}/api/payment/callback?orderId=${orderId}`;

    await db.savePaymentOrder({
      id: orderId,
      itemType: "tournament_link",
      userId,
      tournamentId,
      amountTomans: DEDICATED_LINK_PRICE_TOMANS,
      gateway: this.activeDriver.gatewayName,
      status: "pending",
      description: `فعال‌سازی لینک اختصاصی مسابقه «${tournament.title}» در NexSport`,
    });

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

      await db.savePaymentOrder({
        id: orderId,
        itemType: "tournament_link",
        userId,
        tournamentId,
        amountTomans: DEDICATED_LINK_PRICE_TOMANS,
        gateway: this.activeDriver.gatewayName,
        status: "paid",
        refId: paymentInfo.refId,
        paidAt: new Date().toISOString(),
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
   * Purchase Planning Credits (5, 10, 50, 100 or custom quantity)
   */
  async initiateCreditPackagePayment(params: {
    userId: string;
    creditCount: number;
    userEmail?: string;
    userMobile?: string;
    origin?: string;
  }) {
    const { userId, creditCount, userEmail, userMobile, origin } = params;
    const { count, baseTotal, discountPercent, discountTomans, finalPrice } =
      calculateCreditPrice(creditCount);

    const orderId = `ord_c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const baseUrl = origin || (process.env.NEXT_PUBLIC_BASE_URL || "https://nexsport.ir");
    const callbackUrl = `${baseUrl}/api/payment/callback?orderId=${orderId}`;

    await db.savePaymentOrder({
      id: orderId,
      itemType: "planning_credits",
      userId,
      itemQuantity: count,
      amountTomans: finalPrice,
      gateway: this.activeDriver.gatewayName,
      status: "pending",
      description: `خرید بسته ${count} برنامه‌ریزی مسابقه NexSport`,
    });

    const initResult = await this.activeDriver.initiatePayment({
      orderId,
      amountTomans: finalPrice,
      description: `خرید بسته ${count} برنامه‌ریزی مسابقه NexSport`,
      callbackUrl,
      email: userEmail,
      mobile: userMobile,
    });

    if (!initResult.success) {
      return { success: false, error: initResult.error || "خطا در اتصال به درگاه پرداخت." };
    }

    if (initResult.isDirectSuccess) {
      const newCredits = await db.addPlanningCredits(userId, count);
      const refId = initResult.refId || `TRX-${Math.floor(10000000 + Math.random() * 90000000)}`;

      await db.savePaymentOrder({
        id: orderId,
        itemType: "planning_credits",
        userId,
        itemQuantity: count,
        amountTomans: finalPrice,
        gateway: this.activeDriver.gatewayName,
        status: "paid",
        refId,
        paidAt: new Date().toISOString(),
      });

      return {
        success: true,
        isDirectSuccess: true,
        orderId,
        refId,
        itemType: "planning_credits",
        addedCredits: count,
        newTotalCredits: newCredits,
        amountTomans: finalPrice,
      };
    }

    return {
      success: true,
      isDirectSuccess: false,
      paymentUrl: initResult.paymentUrl,
      authority: initResult.authority,
      orderId,
    };
  }

  /**
   * Purchase VIP Membership Subscription (1, 3, 6, 12 months)
   */
  async initiateVipPayment(params: {
    userId: string;
    vipPlanId: string;
    userEmail?: string;
    userMobile?: string;
    origin?: string;
  }) {
    const { userId, vipPlanId, userEmail, userMobile, origin } = params;
    const plan = VIP_PLANS.find((p) => p.id === vipPlanId) || VIP_PLANS[0];

    const orderId = `ord_v_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const baseUrl = origin || (process.env.NEXT_PUBLIC_BASE_URL || "https://nexsport.ir");
    const callbackUrl = `${baseUrl}/api/payment/callback?orderId=${orderId}`;

    await db.savePaymentOrder({
      id: orderId,
      itemType: "vip_subscription",
      userId,
      itemDurationMonths: plan.months,
      amountTomans: plan.finalPriceTomans,
      gateway: this.activeDriver.gatewayName,
      status: "pending",
      description: `خرید اشتراک ${plan.title} NexSport`,
    });

    const initResult = await this.activeDriver.initiatePayment({
      orderId,
      amountTomans: plan.finalPriceTomans,
      description: `خرید اشتراک ${plan.title} NexSport`,
      callbackUrl,
      email: userEmail,
      mobile: userMobile,
    });

    if (!initResult.success) {
      return { success: false, error: initResult.error || "خطا در اتصال به درگاه پرداخت." };
    }

    if (initResult.isDirectSuccess) {
      const expiresAt = await db.activateVipSubscription(userId, plan.months);
      const refId = initResult.refId || `TRX-${Math.floor(10000000 + Math.random() * 90000000)}`;

      await db.savePaymentOrder({
        id: orderId,
        itemType: "vip_subscription",
        userId,
        itemDurationMonths: plan.months,
        amountTomans: plan.finalPriceTomans,
        gateway: this.activeDriver.gatewayName,
        status: "paid",
        refId,
        paidAt: new Date().toISOString(),
      });

      return {
        success: true,
        isDirectSuccess: true,
        orderId,
        refId,
        itemType: "vip_subscription",
        planTitle: plan.title,
        months: plan.months,
        expiresAt: expiresAt.toISOString(),
        amountTomans: plan.finalPriceTomans,
      };
    }

    return {
      success: true,
      isDirectSuccess: false,
      paymentUrl: initResult.paymentUrl,
      authority: initResult.authority,
      orderId,
    };
  }

  /**
   * Verify callback from external gateway (when real gateway like ZarinPal is connected)
   */
  async verifyPaymentCallback(params: {
    orderId: string;
    authority: string;
    tournamentId?: string;
    userId: string;
  }) {
    const order = await db.getPaymentOrder(params.orderId);
    if (!order) {
      return { success: false, error: "سفارش پرداخت یافت نشد." };
    }

    const verifyRes = await this.activeDriver.verifyPayment({
      orderId: params.orderId,
      authority: params.authority,
      amountTomans: order.amount_tomans || order.amountTomans,
    });

    if (!verifyRes.success) {
      return {
        success: false,
        error: verifyRes.error || "تراکنش بانکی تایید نشد.",
      };
    }

    const paidAt = new Date().toISOString();

    if (order.item_type === "tournament_link" && order.tournament_id) {
      const tournament = await db.getTournament(order.tournament_id, params.userId);
      if (tournament) {
        const paymentInfo = {
          isPaid: true,
          amount: order.amount_tomans || DEDICATED_LINK_PRICE_TOMANS,
          currency: "TOMAN",
          gateway: this.activeDriver.gatewayName,
          orderId: params.orderId,
          refId: verifyRes.refId,
          cardPan: verifyRes.cardPan,
          paidAt,
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
      }
    } else if (order.item_type === "planning_credits") {
      await db.addPlanningCredits(params.userId, order.item_quantity || 1);
    } else if (order.item_type === "vip_subscription") {
      await db.activateVipSubscription(params.userId, order.item_duration_months || 1);
    }

    await db.savePaymentOrder({
      id: params.orderId,
      status: "paid",
      refId: verifyRes.refId,
      paidAt,
    });

    return {
      success: true,
      refId: verifyRes.refId,
      cardPan: verifyRes.cardPan,
      order,
    };
  }
}

export const paymentService = new PaymentService();
