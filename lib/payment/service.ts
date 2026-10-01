import { db } from "@/lib/db";
import { hasUnlimitedPlanning, isSuperAdminEmail } from "@/lib/auth/utils";
import {
  PaymentGatewayDriver,
  PaymentGatewayType,
  PaymentOrder,
  calculateCreditPrice,
  buildVipPlans,
  applyCouponOnFinal,
  DEFAULT_PRICING_SETTINGS,
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
   * - Admin account: always FREE, never hits a payment gateway (even after ZarinPal).
   * - VIP Users: 100% FREE!
   * - Registered Normal Users (1st link): 100% FREE gift!
   * - Subsequent Links: Standard 150,000 Tomans (or discounted if coupon applied).
   */
  async initiateTournamentPayment(params: {
    tournamentId: string;
    userId: string;
    userEmail?: string;
    userMobile?: string;
    origin?: string;
    useFreeGift?: boolean;
    discountCode?: string;
    adminBypass?: boolean;
    discountCatalog?: any[];
  }) {
    const { tournamentId, userId, userEmail, userMobile, origin, useFreeGift, discountCode, adminBypass, discountCatalog } = params;

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
    const dbUser = await db.findUserById(userId);
    const adminFree =
      Boolean(adminBypass) ||
      hasUnlimitedPlanning(dbUser) ||
      isSuperAdminEmail(userEmail);

    // 0. Admin account: unlimited dedicated links, never redirect to a gateway.
    if (adminFree) {
      const paymentInfo = {
        isPaid: true,
        amount: 0,
        currency: "TOMAN",
        gateway: "admin_free",
        orderId: `admin_${Date.now()}`,
        refId: `TRX-ADMIN-${Math.floor(10000000 + Math.random() * 90000000)}`,
        paidAt: new Date().toISOString(),
        note: "لینک اختصاصی رایگان حساب مدیر — بدون درگاه پرداخت",
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
        isAdminFree: true,
        orderId: paymentInfo.orderId,
        refId: paymentInfo.refId,
        paymentInfo,
        tournamentId,
      };
    }

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

    // 3. Otherwise: standard link price (with discount code if provided — applied on the current final amount)
    const pricing = await db.getPricingSettings();
    let finalAmount = pricing.linkPriceTomans;
    let appliedCode: string | undefined = undefined;
    let discountPercentApplied = 0;

    if (discountCode) {
      const val = await db.validateDiscountCode(discountCode, "link", discountCatalog || []);
      if (!val.valid) {
        return {
          success: false,
          error: val.error || "کد تخفیف وارد شده معتبر نمی‌باشد.",
        };
      }
      appliedCode = val.discount?.code;
      discountPercentApplied = val.discountPercent || 0;
      const stacked = applyCouponOnFinal(finalAmount, discountPercentApplied);
      finalAmount = stacked.finalAmount;
    }

    if (finalAmount === 0) {
      const paymentInfo = {
        isPaid: true,
        amount: 0,
        currency: "TOMAN",
        gateway: "discount_100",
        orderId: `dsc_${Date.now()}`,
        refId: `TRX-DSC-${Math.floor(10000000 + Math.random() * 90000000)}`,
        paidAt: new Date().toISOString(),
        note: `فعال‌سازی با کد تخفیف ۱۰۰٪ (${appliedCode})`,
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
        orderId: paymentInfo.orderId,
        refId: paymentInfo.refId,
        paymentInfo,
        tournamentId,
      };
    }

    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const baseUrl = origin || (process.env.NEXT_PUBLIC_BASE_URL || "https://nexsport.ir");
    const callbackUrl = `${baseUrl}/api/payment/callback?orderId=${orderId}`;
    const desc = appliedCode
      ? `فعال‌سازی لینک اختصاصی مسابقه «${tournament.title}» در NexSport (کد تخفیف: ${appliedCode} - ${discountPercentApplied}٪)`
      : `فعال‌سازی لینک اختصاصی مسابقه «${tournament.title}» در NexSport`;

    await db.savePaymentOrder({
      id: orderId,
      itemType: "tournament_link",
      userId,
      tournamentId,
      amountTomans: finalAmount,
      gateway: this.activeDriver.gatewayName,
      status: "pending",
      description: desc,
    });

    const initResult = await this.activeDriver.initiatePayment({
      orderId,
      amountTomans: finalAmount,
      description: desc,
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
        amount: finalAmount,
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
        amountTomans: finalAmount,
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
    discountCode?: string;
    discountCatalog?: any[];
  }) {
    const { userId, creditCount, userEmail, userMobile, origin, discountCode, discountCatalog } = params;
    const pricing = await db.getPricingSettings();
    const { count, finalPrice } = calculateCreditPrice(creditCount, pricing);

    let finalPayPrice = finalPrice;
    let appliedCode: string | undefined = undefined;
    let codeDiscountPercent = 0;

    if (discountCode) {
      const val = await db.validateDiscountCode(discountCode, "credits", discountCatalog || []);
      if (!val.valid) {
        return { success: false, error: val.error || "کد تخفیف وارد شده معتبر نمی‌باشد." };
      }
      appliedCode = val.discount?.code;
      codeDiscountPercent = val.discountPercent || 0;
      const stacked = applyCouponOnFinal(finalPayPrice, codeDiscountPercent);
      finalPayPrice = stacked.finalAmount;
    }

    if (finalPayPrice === 0) {
      const newCredits = await db.addPlanningCredits(userId, count);
      const refId = `TRX-DSC-${Math.floor(10000000 + Math.random() * 90000000)}`;
      const orderId = `ord_c_dsc_${Date.now()}`;
      await db.savePaymentOrder({
        id: orderId,
        itemType: "planning_credits",
        userId,
        itemQuantity: count,
        amountTomans: 0,
        gateway: "discount_100",
        status: "paid",
        refId,
        paidAt: new Date().toISOString(),
        description: `بسته ${count} برنامه‌ریزی با کد تخفیف ۱۰۰٪ (${appliedCode})`,
      });

      return {
        success: true,
        isDirectSuccess: true,
        orderId,
        refId,
        itemType: "planning_credits",
        addedCredits: count,
        newTotalCredits: newCredits,
        amountTomans: 0,
      };
    }

    const orderId = `ord_c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const baseUrl = origin || (process.env.NEXT_PUBLIC_BASE_URL || "https://nexsport.ir");
    const callbackUrl = `${baseUrl}/api/payment/callback?orderId=${orderId}`;
    const desc = appliedCode
      ? `خرید بسته ${count} برنامه‌ریزی مسابقه NexSport (کد تخفیف: ${appliedCode} - ${codeDiscountPercent}٪)`
      : `خرید بسته ${count} برنامه‌ریزی مسابقه NexSport`;

    await db.savePaymentOrder({
      id: orderId,
      itemType: "planning_credits",
      userId,
      itemQuantity: count,
      amountTomans: finalPayPrice,
      gateway: this.activeDriver.gatewayName,
      status: "pending",
      description: desc,
    });

    const initResult = await this.activeDriver.initiatePayment({
      orderId,
      amountTomans: finalPayPrice,
      description: desc,
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
        amountTomans: finalPayPrice,
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
        amountTomans: finalPayPrice,
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
    discountCode?: string;
    discountCatalog?: any[];
  }) {
    const { userId, vipPlanId, userEmail, userMobile, origin, discountCode, discountCatalog } = params;
    const pricing = await db.getPricingSettings();
    const vipPlans = buildVipPlans(pricing);
    const plan = vipPlans.find((p) => p.id === vipPlanId) || vipPlans[0];

    let finalVipPrice = plan.finalPriceTomans;
    let appliedCode: string | undefined = undefined;
    let codeDiscountPercent = 0;

    if (discountCode) {
      const val = await db.validateDiscountCode(discountCode, "vip", discountCatalog || []);
      if (!val.valid) {
        return { success: false, error: val.error || "کد تخفیف وارد شده معتبر نمی‌باشد." };
      }
      appliedCode = val.discount?.code;
      codeDiscountPercent = val.discountPercent || 0;
      const stacked = applyCouponOnFinal(finalVipPrice, codeDiscountPercent);
      finalVipPrice = stacked.finalAmount;
    }

    if (finalVipPrice === 0) {
      const expiresAt = await db.activateVipSubscription(userId, plan.months);
      const refId = `TRX-DSC-${Math.floor(10000000 + Math.random() * 90000000)}`;
      const orderId = `ord_vip_dsc_${Date.now()}`;
      await db.savePaymentOrder({
        id: orderId,
        itemType: "vip_subscription",
        userId,
        itemDurationMonths: plan.months,
        amountTomans: 0,
        gateway: "discount_100",
        status: "paid",
        refId,
        paidAt: new Date().toISOString(),
        description: `اشتراک ${plan.title} با کد تخفیف ۱۰۰٪ (${appliedCode})`,
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
        amountTomans: 0,
      };
    }

    const orderId = `ord_v_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const baseUrl = origin || (process.env.NEXT_PUBLIC_BASE_URL || "https://nexsport.ir");
    const callbackUrl = `${baseUrl}/api/payment/callback?orderId=${orderId}`;
    const desc = appliedCode
      ? `خرید اشتراک ${plan.title} NexSport (کد تخفیف: ${appliedCode} - ${codeDiscountPercent}٪)`
      : `خرید اشتراک ${plan.title} NexSport`;

    await db.savePaymentOrder({
      id: orderId,
      itemType: "vip_subscription",
      userId,
      itemDurationMonths: plan.months,
      amountTomans: finalVipPrice,
      gateway: this.activeDriver.gatewayName,
      status: "pending",
      description: desc,
    });

    const initResult = await this.activeDriver.initiatePayment({
      orderId,
      amountTomans: finalVipPrice,
      description: desc,
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
        amountTomans: finalVipPrice,
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
        amountTomans: finalVipPrice,
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
          amount: order.amount_tomans || DEFAULT_PRICING_SETTINGS.linkPriceTomans,
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
