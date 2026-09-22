import {
  PaymentEventType,
  Prisma,
  ProcessingStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  decryptSecret,
  sha256,
  verifyWebhookSignature,
} from "@/lib/crypto";
import { getServerEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const webhookSchema = z.object({
  event_id: z.string().min(3).max(200),
  type: z.enum(["payment.confirmed", "payment.refunded"]),
  transaction_id: z.string().min(3).max(200),
  order_id: z.string().min(1).max(200).nullable().optional(),
  amount_cents: z.number().int().positive().max(2_147_483_647),
  currency: z.string().length(3).default("BRL"),
  occurred_at: z.iso.datetime(),
});

const MAX_WEBHOOK_BYTES = 256 * 1024;
const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1_000;

function getProvider(request: Request): string {
  const provider = request.headers.get("x-payment-provider") ?? "custom";
  return /^[a-z0-9_-]{2,32}$/i.test(provider) ? provider.toLowerCase() : "custom";
}

function hasFreshTimestamp(timestamp: string): boolean {
  if (!/^\d{10,12}$/.test(timestamp)) return false;
  const timestampMs = Number(timestamp) * 1_000;
  return (
    Number.isSafeInteger(timestampMs) &&
    Math.abs(Date.now() - timestampMs) <= MAX_SIGNATURE_AGE_MS
  );
}

async function readBodyWithinLimit(request: Request): Promise<string | null> {
  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let rawBody = "";
  let bytesRead = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bytesRead += value.byteLength;
      if (bytesRead > MAX_WEBHOOK_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }

      rawBody += decoder.decode(value, { stream: true });
    }

    return rawBody + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

async function recordDeliveryFailure(input: {
  organizationId: string;
  provider: string;
  deliveryId: string;
  eventType: string;
  payloadHash: string;
  signatureValid: boolean;
  responseStatus: number;
  failureCode: string;
  startedAt: number;
}) {
  try {
    await prisma.webhookDelivery.create({
      data: {
        organizationId: input.organizationId,
        provider: input.provider,
        deliveryId: input.deliveryId,
        eventType: input.eventType,
        payloadHash: input.payloadHash,
        signatureValid: input.signatureValid,
        responseStatus: input.responseStatus,
        failureCode: input.failureCode,
        processingTimeMs: Date.now() - input.startedAt,
      },
    });
  } catch {
    console.error("Unable to record the webhook delivery failure", {
      organizationId: input.organizationId,
      provider: input.provider,
      deliveryId: input.deliveryId,
      failureCode: input.failureCode,
    });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationSlug: string }> },
) {
  const startedAt = Date.now();
  const { organizationSlug } = await context.params;
  const provider = getProvider(request);
  const deliveryId =
    request.headers.get("x-delivery-id") ?? `missing-${crypto.randomUUID()}`;

  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredSize) && declaredSize > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const rawBody = await readBodyWithinLimit(request);
  if (rawBody === null) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const payloadHash = sha256(rawBody);
  const organization = await prisma.organization.findUnique({
    where: { slug: organizationSlug },
  });

  if (!organization) {
    return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
  }

  const signature = request.headers.get("x-conciliacore-signature") ?? "";
  const timestamp = request.headers.get("x-conciliacore-timestamp") ?? "";
  if (!hasFreshTimestamp(timestamp)) {
    await recordDeliveryFailure({
      organizationId: organization.id,
      provider,
      deliveryId,
      eventType: request.headers.get("x-event-type") ?? "unknown",
      payloadHash,
      signatureValid: false,
      responseStatus: 401,
      failureCode: "INVALID_TIMESTAMP",
      startedAt,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let signatureValid: boolean;
  try {
    const secret = decryptSecret(
      organization.webhookSecretEncrypted,
      getServerEnv().ENCRYPTION_KEY,
    );
    signatureValid = verifyWebhookSignature(rawBody, signature, secret, {
      provider,
      timestamp,
    });
  } catch {
    await recordDeliveryFailure({
      organizationId: organization.id,
      provider,
      deliveryId,
      eventType: request.headers.get("x-event-type") ?? "unknown",
      payloadHash,
      signatureValid: false,
      responseStatus: 500,
      failureCode: "AUTH_CONFIGURATION_UNAVAILABLE",
      startedAt,
    });
    return NextResponse.json(
      { error: "Unable to accept the event" },
      { status: 500 },
    );
  }

  if (!signatureValid) {
    await recordDeliveryFailure({
      organizationId: organization.id,
      provider,
      deliveryId,
      eventType: request.headers.get("x-event-type") ?? "unknown",
      payloadHash,
      signatureValid: false,
      responseStatus: 401,
      failureCode: "INVALID_SIGNATURE",
      startedAt,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let decodedPayload: unknown;
  try {
    decodedPayload = JSON.parse(rawBody);
  } catch {
    await recordDeliveryFailure({
      organizationId: organization.id,
      provider,
      deliveryId,
      eventType: "invalid-json",
      payloadHash,
      signatureValid: true,
      responseStatus: 400,
      failureCode: "INVALID_JSON",
      startedAt,
    });
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = webhookSchema.safeParse(decodedPayload);
  if (!parsed.success) {
    await recordDeliveryFailure({
      organizationId: organization.id,
      provider,
      deliveryId,
      eventType: "invalid",
      payloadHash,
      signatureValid: true,
      responseStatus: 400,
      failureCode: "INVALID_PAYLOAD",
      startedAt,
    });
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  try {
    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.paymentEvent.create({
        data: {
          organizationId: organization.id,
          provider,
          providerEventId: payload.event_id,
          transactionId: payload.transaction_id,
          orderExternalId: payload.order_id,
          type:
            payload.type === "payment.refunded"
              ? PaymentEventType.PAYMENT_REFUNDED
              : PaymentEventType.PAYMENT_CONFIRMED,
          amountCents: payload.amount_cents,
          currency: payload.currency.toUpperCase(),
          status: ProcessingStatus.PENDING,
          occurredAt: new Date(payload.occurred_at),
          rawPayload: payload,
        },
      });

      await tx.outboxEvent.create({
        data: {
          organizationId: organization.id,
          aggregateType: "PaymentEvent",
          aggregateId: created.id,
          eventType: "PAYMENT_EVENT_RECEIVED",
          payload: { paymentEventId: created.id },
        },
      });

      await tx.webhookDelivery.create({
        data: {
          organizationId: organization.id,
          provider,
          deliveryId,
          eventType: payload.type,
          payloadHash,
          signatureValid: true,
          responseStatus: 202,
          processingTimeMs: Date.now() - startedAt,
        },
      });

      return created;
    });

    return NextResponse.json(
      { accepted: true, eventId: event.id },
      { status: 202 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      await prisma.webhookDelivery.create({
        data: {
          organizationId: organization.id,
          provider,
          deliveryId,
          eventType: payload.type,
          payloadHash,
          signatureValid: true,
          duplicate: true,
          responseStatus: 200,
          processingTimeMs: Date.now() - startedAt,
        },
      });
      return NextResponse.json({ accepted: true, duplicate: true });
    }

    console.error("Webhook ingestion failed", {
      organizationId: organization.id,
      provider,
      deliveryId,
      error: error instanceof Error ? error.message : "unknown",
    });
    await recordDeliveryFailure({
      organizationId: organization.id,
      provider,
      deliveryId,
      eventType: payload.type,
      payloadHash,
      signatureValid: true,
      responseStatus: 500,
      failureCode: "INGESTION_FAILED",
      startedAt,
    });
    return NextResponse.json({ error: "Unable to accept the event" }, { status: 500 });
  }
}
