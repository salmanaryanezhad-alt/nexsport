import {
  PaymentGatewayDriver,
  InitiatePaymentParams,
  InitiatePaymentResult,
  VerifyPaymentParams,
  VerifyPaymentResult,
} from "../types";

/**
 * ZarinPal Payment Gateway Driver (زرین‌پال نسخه ۴ REST)
 * Ready for production activation by simply adding ZARINPAL_MERCHANT_ID
 * to environment variables without any code rewrite.
 */
export class ZarinpalGateway implements PaymentGatewayDriver {
  readonly gatewayName = "zarinpal" as const;
  private merchantId: string;
  private isSandbox: boolean;

  constructor(merchantId?: string, isSandbox = false) {
    this.merchantId =
      merchantId || process.env.ZARINPAL_MERCHANT_ID || "";
    this.isSandbox =
      isSandbox || process.env.ZARINPAL_SANDBOX === "true";
  }

  private getBaseUrl(): string {
    return this.isSandbox
      ? "https://sandbox.zarinpal.com/pg/v4/payment"
      : "https://payment.zarinpal.com/pg/v4/payment";
  }

  private getStartPayUrl(authority: string): string {
    return this.isSandbox
      ? `https://sandbox.zarinpal.com/pg/StartPay/${authority}`
      : `https://payment.zarinpal.com/pg/StartPay/${authority}`;
  }

  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    if (!this.merchantId) {
      return {
        success: false,
        error:
          "مرچنت کد زرین‌پال (ZARINPAL_MERCHANT_ID) در متغیرهای محیطی سیستم تنظیم نشده است.",
      };
    }

    try {
      const body = {
        merchant_id: this.merchantId,
        amount: params.amountTomans,
        currency: "IRT",
        description: params.description,
        callback_url: params.callbackUrl,
        metadata: {
          mobile: params.mobile || "",
          email: params.email || "",
          order_id: params.orderId,
        },
      };

      const res = await fetch(`${this.getBaseUrl()}/request.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data?.data?.code === 100 && data?.data?.authority) {
        return {
          success: true,
          isDirectSuccess: false,
          authority: data.data.authority,
          paymentUrl: this.getStartPayUrl(data.data.authority),
        };
      }

      const errorMsg =
        data?.errors?.message ||
        `خطای درگاه زرین‌پال (کد: ${data?.data?.code || "نامشخص"})`;
      return { success: false, error: errorMsg };
    } catch {
      return {
        success: false,
        error: "امکان برقراری ارتباط با درگاه پرداخت زرین‌پال وجود ندارد.",
      };
    }
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    if (!this.merchantId) {
      return {
        success: false,
        error: "مرچنت کد زرین‌پال تنظیم نشده است.",
      };
    }

    try {
      const body = {
        merchant_id: this.merchantId,
        amount: params.amountTomans,
        authority: params.authority,
      };

      const res = await fetch(`${this.getBaseUrl()}/verify.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data?.data?.code === 100 || data?.data?.code === 101) {
        return {
          success: true,
          refId: String(data.data.ref_id),
          cardPan: data.data.card_pan,
        };
      }

      return {
        success: false,
        error:
          data?.errors?.message ||
          `تراکنش توسط درگاه تایید نشد (کد: ${data?.data?.code || "نامشخص"})`,
      };
    } catch {
      return {
        success: false,
        error: "خطا در تایید تراکنش با درگاه پرداخت زرین‌پال.",
      };
    }
  }
}
