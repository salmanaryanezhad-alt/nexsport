/**
 * Payment System Types & Interface Definitions
 * NexSport - Tournament Management Platform
 * 
 * Designed with a Driver/Adapter pattern to allow seamless swapping between
 * Mock (simulation), ZarinPal (زرین‌پال), IDPay (آیدی‌پی), etc. without
 * touching frontend or business logic.
 */

export * from "./pricing";

export type PaymentGatewayType = "mock" | "zarinpal" | "idpay";

export type PaymentStatus = "pending" | "paid" | "failed" | "canceled";

export type PaymentItemType =
  | "tournament_link"
  | "registration_link"
  | "planning_credits"
  | "vip_subscription"
  | "club_page"
  | "club_pro"
  | "team_pin"
  | "extra_listing"
  | "listing_pin"
  | "tournament_boost";

export interface PaymentOrder {
  id: string; // Order reference, e.g. "ord_..."
  itemType: PaymentItemType;
  tournamentId?: string;
  clubId?: string;
  userId: string;
  itemQuantity?: number; // for credits
  itemDurationMonths?: number; // for VIP subscription (1, 3, 6, 12)
  amountTomans: number;
  amountRials: number;
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
