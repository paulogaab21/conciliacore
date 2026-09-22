import {
  OutboxStatus,
  PaymentEventType,
  PaymentStatus,
  Prisma,
  ProcessingStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { runReconciliation } from "@/lib/reconciliation-service";

const MAX_ATTEMPTS = 5;
const STALE_LOCK_MS = 5 * 60 * 1_000;

async function processPaymentEvent(paymentEventId: string): Promise<string> {
  const paymentEvent = await prisma.paymentEvent.findUniqueOrThrow({
    where: { id: paymentEventId },
  });

  if (paymentEvent.status === ProcessingStatus.PROCESSED) {
    return paymentEvent.organizationId;
  }

  await prisma.$transaction(async (tx) => {
    const status =
      paymentEvent.type === PaymentEventType.PAYMENT_REFUNDED
        ? PaymentStatus.REFUNDED
        : PaymentStatus.CONFIRMED;

    await tx.payment.upsert({
      where: {
        organizationId_provider_transactionId: {
          organizationId: paymentEvent.organizationId,
          provider: paymentEvent.provider,
          transactionId: paymentEvent.transactionId,
        },
      },
      create: {
        organizationId: paymentEvent.organizationId,
        provider: paymentEvent.provider,
        transactionId: paymentEvent.transactionId,
        orderExternalId: paymentEvent.orderExternalId,
        amountCents: paymentEvent.amountCents,
        currency: paymentEvent.currency,
        status,
        paidAt: paymentEvent.occurredAt,
        refundedAt:
          status === PaymentStatus.REFUNDED ? paymentEvent.occurredAt : null,
      },
      update: {
        orderExternalId: paymentEvent.orderExternalId,
        amountCents: paymentEvent.amountCents,
        currency: paymentEvent.currency,
        status,
        refundedAt:
          status === PaymentStatus.REFUNDED ? paymentEvent.occurredAt : undefined,
      },
    });

    await tx.paymentEvent.update({
      where: { id: paymentEvent.id },
      data: {
        status: ProcessingStatus.PROCESSED,
        processedAt: new Date(),
        failureReason: null,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: paymentEvent.organizationId,
        action: "PAYMENT_EVENT_PROCESSED",
        entityType: "PaymentEvent",
        entityId: paymentEvent.id,
        summary: `Event ${paymentEvent.type} processed for transaction ${paymentEvent.transactionId}.`,
        metadata: {
          provider: paymentEvent.provider,
          transactionId: paymentEvent.transactionId,
          orderExternalId: paymentEvent.orderExternalId,
        } as Prisma.InputJsonValue,
      },
    });
  });

  return paymentEvent.organizationId;
}

export async function processNextOutboxEvent(): Promise<boolean> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);
  const event = await prisma.outboxEvent.findFirst({
    where: {
      OR: [
        { status: OutboxStatus.PENDING, nextAttemptAt: { lte: now } },
        { status: OutboxStatus.PROCESSING, lockedAt: { lt: staleBefore } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  if (!event) return false;

  const claimed = await prisma.outboxEvent.updateMany({
    where: {
      id: event.id,
      OR: [
        { status: OutboxStatus.PENDING, nextAttemptAt: { lte: now } },
        { status: OutboxStatus.PROCESSING, lockedAt: { lt: staleBefore } },
      ],
    },
    data: { status: OutboxStatus.PROCESSING, lockedAt: new Date() },
  });

  if (claimed.count === 0) return true;

  try {
    if (event.eventType !== "PAYMENT_EVENT_RECEIVED") {
      throw new Error(`Unsupported outbox event: ${event.eventType}`);
    }

    const payload = event.payload as { paymentEventId?: string };
    if (!payload.paymentEventId) {
      throw new Error("Outbox event is missing paymentEventId");
    }

    const organizationId = await processPaymentEvent(payload.paymentEventId);
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: OutboxStatus.COMPLETED,
        attempts: { increment: 1 },
        processedAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    });
    await runReconciliation(organizationId, "WEBHOOK_WORKER");
  } catch (error) {
    const attempts = event.attempts + 1;
    const shouldRetry = attempts < MAX_ATTEMPTS;
    const jitterSeconds = Math.floor(Math.random() * 4);
    const delaySeconds = Math.min(300, 2 ** attempts * 5 + jitterSeconds);

    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: shouldRetry ? OutboxStatus.PENDING : OutboxStatus.FAILED,
        attempts,
        nextAttemptAt: new Date(Date.now() + delaySeconds * 1_000),
        lockedAt: null,
        lastError: error instanceof Error ? error.message : "Unknown worker error",
      },
    });
  }

  return true;
}
