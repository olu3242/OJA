// Payment provider interface — Stripe subscriptions in production.
// Stub auto-approves until keys exist (IMPLEMENTATION_STRATEGY.md days 16–45).
export interface PaymentProvider {
  createSubscription(input: {
    accountId: string;
    priceCents: number;
    description: string;
  }): Promise<{ externalId: string; status: "active" }>;
  charge(input: {
    accountId: string;
    amountCents: number;
    description: string;
  }): Promise<{ externalId: string; status: "succeeded" }>;
  refund(input: {
    externalId: string;
    amountCents: number;
  }): Promise<{ status: "refunded" }>;
}

class StubPaymentProvider implements PaymentProvider {
  async createSubscription(input: { accountId: string; priceCents: number }) {
    return {
      externalId: `stub_sub_${input.accountId}_${Date.now()}`,
      status: "active" as const,
    };
  }
  async charge(input: { accountId: string; amountCents: number }) {
    return {
      externalId: `stub_ch_${input.accountId}_${Date.now()}`,
      status: "succeeded" as const,
    };
  }
  async refund() {
    return { status: "refunded" as const };
  }
}

export const payments: PaymentProvider = new StubPaymentProvider();
