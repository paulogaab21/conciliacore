import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptSecret } from "@/lib/crypto";

const mocks = vi.hoisted(() => ({
  findOrganization: vi.fn(),
  createDelivery: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    ENCRYPTION_KEY: "incorrect-encryption-key-with-32-chars",
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: { findUnique: mocks.findOrganization },
    webhookDelivery: { create: mocks.createDelivery },
    $transaction: mocks.transaction,
  },
}));

import { POST } from "@/app/api/webhooks/payments/[organizationSlug]/route";

describe("payment webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findOrganization.mockResolvedValue({
      id: "org-1",
      slug: "acme-commerce",
      webhookSecretEncrypted: encryptSecret(
        "provider-secret",
        "correct-encryption-key-with-32-characters",
      ),
    });
    mocks.createDelivery.mockResolvedValue({ id: "delivery-record-1" });
  });

  it("returns a safe 500 and records the delivery when the secret cannot be decrypted", async () => {
    const body = JSON.stringify({
      event_id: "evt-123",
      type: "payment.confirmed",
      transaction_id: "tx-123",
      order_id: "ORD-123",
      amount_cents: 1_000,
      currency: "BRL",
      occurred_at: "2026-09-21T12:00:00.000Z",
    });
    const request = new Request(
      "http://localhost/api/webhooks/payments/acme-commerce",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-conciliacore-signature": "sha256=invalid",
          "x-conciliacore-timestamp": Math.floor(Date.now() / 1_000).toString(),
          "x-delivery-id": "delivery-123",
          "x-event-type": "payment.confirmed",
          "x-payment-provider": "demo-pay",
        },
        body,
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ organizationSlug: "acme-commerce" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to accept the event",
    });
    expect(mocks.createDelivery).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        deliveryId: "delivery-123",
        payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        signatureValid: false,
        responseStatus: 500,
        failureCode: "AUTH_CONFIGURATION_UNAVAILABLE",
      }),
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects a streamed body as soon as it exceeds 256 KiB", async () => {
    const oversizedBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(200 * 1024));
        controller.enqueue(new Uint8Array(57 * 1024));
        controller.close();
      },
    });
    const request = new Request(
      "http://localhost/api/webhooks/payments/acme-commerce",
      {
        method: "POST",
        body: oversizedBody,
        duplex: "half",
      } as RequestInit & { duplex: "half" },
    );

    expect(request.headers.get("content-length")).toBeNull();
    const response = await POST(request, {
      params: Promise.resolve({ organizationSlug: "acme-commerce" }),
    });

    expect(response.status).toBe(413);
    expect(mocks.findOrganization).not.toHaveBeenCalled();
  });
});
