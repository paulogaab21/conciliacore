import { describe, expect, it } from "vitest";
import {
  analyzeReconciliation,
  type OrderSnapshot,
  type PaymentSnapshot,
} from "@/domain/reconciliation";

const now = new Date("2026-09-19T12:00:00.000Z");

function order(overrides: Partial<OrderSnapshot> = {}): OrderSnapshot {
  return {
    id: "order-1",
    externalId: "ORD-1001",
    amountCents: 10_000,
    status: "PAID",
    createdAt: now,
    ...overrides,
  };
}

function payment(overrides: Partial<PaymentSnapshot> = {}): PaymentSnapshot {
  return {
    id: "payment-1",
    provider: "pix",
    transactionId: "PIX-1001",
    orderExternalId: "ORD-1001",
    amountCents: 10_000,
    status: "CONFIRMED",
    paidAt: now,
    ...overrides,
  };
}

describe("analyzeReconciliation", () => {
  it("matches an order and payment with the same reference and amount", () => {
    const result = analyzeReconciliation([order()], [payment()]);
    expect(result.matchedCount).toBe(1);
    expect(result.findings).toEqual([]);
  });

  it("reports an amount mismatch using integer cents", () => {
    const result = analyzeReconciliation([order()], [payment({ amountCents: 8_900 })]);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "AMOUNT_MISMATCH",
          differenceCents: -1_100,
          orderId: "order-1",
          paymentId: "payment-1",
        }),
      ]),
    );
  });

  it("reports a payment without an order", () => {
    const result = analyzeReconciliation([], [payment({ orderExternalId: null })]);
    expect(result.findings[0]).toMatchObject({
      type: "UNMATCHED_PAYMENT",
      severity: "HIGH",
      paymentId: "payment-1",
    });
  });

  it("reports multiple provider transactions for one order", () => {
    const result = analyzeReconciliation(
      [order()],
      [payment(), payment({ id: "payment-2", transactionId: "PIX-1002" })],
    );
    const duplicate = result.findings.find((finding) => finding.type === "DUPLICATE_PAYMENT");
    expect(duplicate).toMatchObject({
      severity: "CRITICAL",
      differenceCents: 10_000,
    });
    expect(duplicate?.evidence.transactionIds).toEqual(["PIX-1001", "PIX-1002"]);
  });

  it("reports a paid order that has no provider transaction", () => {
    const result = analyzeReconciliation([order()], []);
    expect(result.findings).toEqual([
      expect.objectContaining({ type: "MISSING_PAYMENT", orderId: "order-1" }),
    ]);
  });

  it("reports confirmed payment state that was not applied to its order", () => {
    const result = analyzeReconciliation([order({ status: "PENDING" })], [payment()]);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "ORDER_STATUS_MISMATCH", severity: "MEDIUM" }),
      ]),
    );
  });

  it("makes a confirmed payment on a cancelled order critical", () => {
    const result = analyzeReconciliation([order({ status: "CANCELLED" })], [payment()]);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "ORDER_STATUS_MISMATCH", severity: "CRITICAL" }),
      ]),
    );
  });

  it("reports a refund that is not reflected by the order", () => {
    const result = analyzeReconciliation(
      [order({ status: "PAID" })],
      [payment({ status: "REFUNDED" })],
    );
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "REFUND_MISMATCH" })]),
    );
  });
});
