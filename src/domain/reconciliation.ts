export type OrderSnapshot = {
  id: string;
  externalId: string;
  amountCents: number;
  status: "PENDING" | "PAID" | "PARTIALLY_PAID" | "REFUNDED" | "CANCELLED";
  createdAt: Date;
};

export type PaymentSnapshot = {
  id: string;
  provider: string;
  transactionId: string;
  orderExternalId: string | null;
  amountCents: number;
  status: "CONFIRMED" | "REFUNDED";
  paidAt: Date;
};

export type ReconciliationFinding = {
  fingerprint: string;
  type:
    | "UNMATCHED_PAYMENT"
    | "AMOUNT_MISMATCH"
    | "DUPLICATE_PAYMENT"
    | "ORDER_STATUS_MISMATCH"
    | "REFUND_MISMATCH"
    | "MISSING_PAYMENT";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  differenceCents?: number;
  orderId?: string;
  paymentId?: string;
  evidence: Record<string, string | number | string[] | null>;
};

export type ReconciliationResult = {
  findings: ReconciliationFinding[];
  matchedCount: number;
};

export function analyzeReconciliation(
  orders: OrderSnapshot[],
  payments: PaymentSnapshot[],
): ReconciliationResult {
  const findings: ReconciliationFinding[] = [];
  const ordersByExternalId = new Map(orders.map((order) => [order.externalId, order]));
  const confirmedByOrder = new Map<string, PaymentSnapshot[]>();
  let matchedCount = 0;

  for (const payment of payments) {
    const order = payment.orderExternalId
      ? ordersByExternalId.get(payment.orderExternalId)
      : undefined;

    if (!order) {
      findings.push({
        fingerprint: `unmatched:${payment.id}`,
        type: "UNMATCHED_PAYMENT",
        severity: "HIGH",
        title: "Payment without a corresponding order",
        description: `Transaction ${payment.transactionId} could not be linked to an order.`,
        paymentId: payment.id,
        evidence: {
          transactionId: payment.transactionId,
          orderReference: payment.orderExternalId,
          provider: payment.provider,
          amountCents: payment.amountCents,
        },
      });
      continue;
    }

    if (payment.status === "CONFIRMED") {
      const group = confirmedByOrder.get(order.externalId) ?? [];
      group.push(payment);
      confirmedByOrder.set(order.externalId, group);
    }

    if (payment.amountCents !== order.amountCents) {
      const differenceCents = payment.amountCents - order.amountCents;
      findings.push({
        fingerprint: `amount:${order.id}:${payment.id}`,
        type: "AMOUNT_MISMATCH",
        severity: Math.abs(differenceCents) >= 10_000 ? "CRITICAL" : "HIGH",
        title: "Payment amount differs from the order",
        description: `Transaction ${payment.transactionId} has a different amount from order ${order.externalId}.`,
        differenceCents,
        orderId: order.id,
        paymentId: payment.id,
        evidence: {
          orderExternalId: order.externalId,
          orderAmountCents: order.amountCents,
          paymentAmountCents: payment.amountCents,
          transactionId: payment.transactionId,
        },
      });
    } else {
      matchedCount += 1;
    }

    if (payment.status === "CONFIRMED" && !["PAID", "PARTIALLY_PAID"].includes(order.status)) {
      findings.push({
        fingerprint: `status:${order.id}:${payment.id}`,
        type: "ORDER_STATUS_MISMATCH",
        severity: order.status === "CANCELLED" ? "CRITICAL" : "MEDIUM",
        title: "Confirmed payment not reflected in the order",
        description: `Order ${order.externalId} remains in status ${order.status} after payment confirmation.`,
        orderId: order.id,
        paymentId: payment.id,
        evidence: {
          orderExternalId: order.externalId,
          orderStatus: order.status,
          paymentStatus: payment.status,
          transactionId: payment.transactionId,
        },
      });
    }

    if (payment.status === "REFUNDED" && order.status !== "REFUNDED") {
      findings.push({
        fingerprint: `refund:${order.id}:${payment.id}`,
        type: "REFUND_MISMATCH",
        severity: "HIGH",
        title: "Refund not reflected in the order",
        description: `Transaction ${payment.transactionId} was refunded, but order ${order.externalId} remains in status ${order.status}.`,
        orderId: order.id,
        paymentId: payment.id,
        evidence: {
          orderExternalId: order.externalId,
          orderStatus: order.status,
          paymentStatus: payment.status,
          transactionId: payment.transactionId,
        },
      });
    }
  }

  for (const [orderExternalId, groupedPayments] of confirmedByOrder) {
    if (groupedPayments.length <= 1) continue;
    const order = ordersByExternalId.get(orderExternalId);
    if (!order) continue;

    const sortedTransactions = groupedPayments
      .map((payment) => payment.transactionId)
      .sort();
    const totalPaidCents = groupedPayments.reduce(
      (total, payment) => total + payment.amountCents,
      0,
    );

    findings.push({
      fingerprint: `duplicate:${order.id}:${sortedTransactions.join(":")}`,
      type: "DUPLICATE_PAYMENT",
      severity: totalPaidCents > order.amountCents ? "CRITICAL" : "HIGH",
      title: "Multiple confirmed payments for one order",
      description: `Order ${order.externalId} has ${groupedPayments.length} confirmed transactions.`,
      differenceCents: totalPaidCents - order.amountCents,
      orderId: order.id,
      paymentId: groupedPayments.at(-1)?.id,
      evidence: {
        orderExternalId,
        orderAmountCents: order.amountCents,
        totalPaidCents,
        transactionIds: sortedTransactions,
      },
    });
  }

  for (const order of orders) {
    if (order.status !== "PAID") continue;
    if ((confirmedByOrder.get(order.externalId) ?? []).length > 0) continue;

    findings.push({
      fingerprint: `missing:${order.id}`,
      type: "MISSING_PAYMENT",
      severity: "HIGH",
      title: "Paid order without a confirmed transaction",
      description: `Order ${order.externalId} is marked as paid, but no transaction was found.`,
      orderId: order.id,
      evidence: {
        orderExternalId: order.externalId,
        orderStatus: order.status,
        orderAmountCents: order.amountCents,
      },
    });
  }

  return { findings, matchedCount };
}
