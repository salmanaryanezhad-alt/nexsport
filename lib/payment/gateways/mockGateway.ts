import {
  PaymentGatewayDriver,
  InitiatePaymentParams,
  InitiatePaymentResult,
  VerifyPaymentParams,
  VerifyPaymentResult,
} from "../types";

/**
 * Mock Gateway Driver for Instant Testing and Offline Simulation
 * Immediately approves the transaction, creates a simulated tracking reference,
 * and activates the dedicated link without redirecting away from the app.
 */
export class MockGateway implements PaymentGatewayDriver {
  readonly gatewayName = "mock" as const;

  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const mockRefId = "TRX-" + Math.floor(10000000 + Math.random() * 90000000);
    const mockAuthority = "MOCK-" + Math.random().toString(36).substring(2, 10).toUpperCase();

    return {
      success: true,
      isDirectSuccess: true,
      authority: mockAuthority,
      refId: mockRefId,
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    return {
      success: true,
      refId: "TRX-" + Math.floor(10000000 + Math.random() * 90000000),
      cardPan: "6037-99**-****-1234",
    };
  }
}
