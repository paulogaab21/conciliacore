import { PaymentEventType, ProcessingStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageCases } from "@/domain/permissions";
import { ApiError, handleApiError, requireApiSession } from "@/lib/api";
import { processNextOutboxEvent } from "@/lib/outbox";
import { prisma } from "@/lib/prisma";

const scenarioSchema = z.object({
  scenario: z.enum(["amount_mismatch", "unmatched_payment", "duplicate_payment"]),
});

export async function POST(request: Request) {
  try {
    const session = await requireApiSession();
    if (!canManageCases(session.role)) {
      throw new ApiError(403, "Your role cannot simulate events", "FORBIDDEN");
    }
    if (session.organizationSlug !== "acme-commerce") {
      throw new ApiError(403, "Simulation is available only in the demo environment", "FORBIDDEN");
    }

    const { scenario } = scenarioSchema.parse(await request.json());
    const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
    let orderExternalId: string | null = null;
    let amountCents = 37_900;

    if (scenario === "amount_mismatch") {
      const order = await prisma.order.findFirst({
        where: { organizationId: session.organizationId, externalId: "ORD-1039" },
      });
      orderExternalId = order?.externalId ?? "ORD-1039";
      amountCents = 8_990;
    } else if (scenario === "duplicate_payment") {
      orderExternalId = "ORD-1048";
      amountCents = 18_990;
    }

    await prisma.$transaction(async (tx) => {
      const event = await tx.paymentEvent.create({
        data: {
          organizationId: session.organizationId,
          provider: "demo-pay",
          providerEventId: `evt-${suffix}`,
          transactionId: `DEMO-${suffix}`,
          orderExternalId,
          type: PaymentEventType.PAYMENT_CONFIRMED,
          amountCents,
          currency: "BRL",
          status: ProcessingStatus.PENDING,
          occurredAt: new Date(),
          rawPayload: {
            demo: true,
            scenario,
            orderExternalId,
            amountCents,
          },
        },
      });

      await tx.outboxEvent.create({
        data: {
          organizationId: session.organizationId,
          aggregateType: "PaymentEvent",
          aggregateId: event.id,
          eventType: "PAYMENT_EVENT_RECEIVED",
          payload: { paymentEventId: event.id },
        },
      });
    });

    await processNextOutboxEvent();
    return NextResponse.json({ ok: true, scenario });
  } catch (error) {
    return handleApiError(error);
  }
}
