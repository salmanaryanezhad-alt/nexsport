/**
 * Payment System Types & Interface Definitions
 * NexSport - Tournament Management Platform
 * 
 * Designed with a Driver/Adapter pattern to allow seamless swapping between
 * Mock (simulation), ZarinPal (زرین‌پال), IDPay (آیدی‌پی), etc. without
 * touching frontend or business logic.
 */

export type PaymentGatewayType = "mock" | "zarinpal" | "idpay";

export type PaymentStatus = "pending" | "paid" | "failed" | "canceled";

export interface PaymentOrder {
  id: string; // Order reference, e.g. "ord_..."
  tournamentId: string;
  userId: string;
  amountTomans: number; // 200,000 Tomans
  amountRials: number; // 2,000,000 Rials
  gateway: PaymentGatewayType;
  status: PaymentStatus;
  authority?: string;
  refId?: string;
  cardPan?: string;
  description: string;
  createdAt: string;
  paidAt?: string;
}

export interface InitiatePaymentParams {
  orderId: string;
  amountTomans: number;
  description: string;
  callbackUrl: string;
  mobile?: string;
  email?: string;
}

export interface InitiatePaymentResult {
  success: boolean;
  /**
   * If true, payment was completed instantly in-place without redirecting to bank
   * (used by mock mode or direct wallet debit)
   */
  isDirectSuccess?: boolean;
  paymentUrl?: string;
  authority?: string;
  refId?: string;
  error?: string;
}

export interface VerifyPaymentParams {
  orderId: string;
  authority: string;
  amountTomans: number;
}

export interface VerifyPaymentResult {
  success: boolean;
  refId?: string;
  cardPan?: string;
  error?: string;
}

export interface PaymentGatewayDriver {
  readonly gatewayName: PaymentGatewayType;
  initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult>;
  verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult>;
}

/**
 * Standard Dedicated Link Activation Fee in Tomans (۲۰۰,۰۰۰ تومان)
 */
export const DEDICATED_LINK_PRICE_TOMANS = 200000;
