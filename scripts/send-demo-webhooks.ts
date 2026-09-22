import "dotenv/config";
import { randomUUID } from "node:crypto";
import { signWebhook } from "@/lib/crypto";
import { getServerEnv } from "@/lib/env";

async function deliver(
  url: string,
  rawBody: string,
  signature: string,
  timestamp: string,
  deliveryId: string,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-delivery-id": deliveryId,
      "x-event-type": "payment.confirmed",
      "x-payment-provider": "demo-pay",
      "x-conciliacore-timestamp": timestamp,
      "x-conciliacore-signature": `sha256=${signature}`,
    },
    body: rawBody,
  });

  return { status: response.status, body: await response.json() };
}

async function main() {
  const env = getServerEnv();
  const eventId = `evt-demo-${randomUUID()}`;
  const payload = {
    event_id: eventId,
    type: "payment.confirmed",
    transaction_id: `TX-DEMO-${Date.now()}`,
    order_id: "ORD-1039",
    amount_cents: 9_990,
    currency: "BRL",
    occurred_at: new Date().toISOString(),
  };
  const rawBody = JSON.stringify(payload);
  const provider = "demo-pay";
  const timestamp = Math.floor(Date.now() / 1_000).toString();
  const signature = signWebhook(rawBody, env.DEMO_WEBHOOK_SECRET, {
    provider,
    timestamp,
  });
  const url = `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/payments/acme-commerce`;

  const first = await deliver(
    url,
    rawBody,
    signature,
    timestamp,
    `delivery-${eventId}-1`,
  );
  const duplicate = await deliver(
    url,
    rawBody,
    signature,
    timestamp,
    `delivery-${eventId}-2`,
  );

  console.log("First delivery:", first);
  console.log("Duplicate delivery:", duplicate);
  console.log("Expected: 202 accepted, followed by 200 duplicate acknowledgement.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
