import {
  PaymentGatewayDriver,
  InitiatePaymentParams,
  InitiatePaymentResult,
  VerifyPaymentParams,
  VerifyPaymentResult,
} from "../types";

/**
 * IDPay Payment Gateway Driver (آیدی‌پی)
 * Standard IDPay REST API driver for instant activation via IDPAY_API_KEY.
 */
export class IdpayGateway implements PaymentGatewayDriver {
  readonly gatewayName = "idpay" as const;
  private apiKey: string;
  private isSandbox: boolean;

  constructor(apiKey?: string, isSandbox = false) {
    this.apiKey = apiKey || process.env.IDPAY_API_KEY || "";
    this.isSandbox = isSandbox || process.env.IDPAY_SANDBOX === "true";
  }

  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: "کلید درگاه پرداخت آیدی‌پی (IDPAY_API_KEY) در متغیرهای سیستم تنظیم نشده است.",
      };
    }

    try {
      // IDPay expects amount in Rials
      const body = {
        order_id: params.orderId,
        amount: params.amountTomans * 10, // Tomans to Rials
        name: "کاربر NexSport",
        phone: params.mobile || "",
        mail: params.email || "",
        desc: params.description,
        callback: params.callbackUrl,
      };

      const res = await fetch("https://api.idpay.ir/v1.1/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": this.apiKey,
          ...(this.isSandbox ? { "X-SANDBOX": "1" } : {}),
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data?.id && data?.link) {
        return {
          success: true,
          isDirectSuccess: false,
          authority: data.id,
          paymentUrl: data.link,
        };
      }

      return {
        success: false,
        error: data?.error_message || "خطا در ایجاد تراکنش با درگاه آیدی‌پی.",
      };
    } catch {
      return {
        success: false,
        error: "امکان برقراری ارتباط با درگاه آیدی‌پی وجود ندارد.",
      };
    }
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    if (!this.apiKey) {
      return { success: false, error: "کلید درگاه آیدی‌پی تنظیم نشده است." };
    }

    try {
      const body = {
        id: params.authority,
        order_id: params.orderId,
      };

      const res = await fetch("https://api.idpay.ir/v1.1/payment/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": this.apiKey,
          ...(this.isSandbox ? { "X-SANDBOX": "1" } : {}),
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data?.status === 100 || data?.status === 101) {
        return {
          success: true,
          refId: String(data?.track_id || data?.payment?.track_id || ""),
          cardPan: data?.payment?.card_no,
        };
      }

      return {
        success: false,
        error: data?.error_message || `تراکنش تایید نشد (کد وضعیت: ${data?.status})`,
      };
    } catch {
      return {
        success: false,
        error: "خطا در استعلام و تایید تراکنش درگاه آیدی‌پی.",
      };
    }
  }
}
