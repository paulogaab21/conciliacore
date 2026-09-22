import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  signWebhook,
  verifyWebhookSignature,
} from "@/lib/crypto";

describe("webhook security", () => {
  const payload = JSON.stringify({ event_id: "evt-1", amount_cents: 1_500 });
  const secret = "whsec_this_is_a_test_secret";
  const context = { provider: "demo-pay", timestamp: "1789966800" };

  it("accepts a valid sha256 signature", () => {
    const signature = `sha256=${signWebhook(payload, secret, context)}`;
    expect(verifyWebhookSignature(payload, signature, secret, context)).toBe(true);
  });

  it("rejects a modified payload", () => {
    const signature = signWebhook(payload, secret, context);
    expect(
      verifyWebhookSignature(`${payload} `, signature, secret, context),
    ).toBe(false);
  });

  it("binds the provider and timestamp to the signature", () => {
    const signature = signWebhook(payload, secret, context);
    expect(
      verifyWebhookSignature(payload, signature, secret, {
        ...context,
        provider: "another-provider",
      }),
    ).toBe(false);
    expect(
      verifyWebhookSignature(payload, signature, secret, {
        ...context,
        timestamp: "1789966801",
      }),
    ).toBe(false);
  });

  it("rejects malformed signatures without throwing", () => {
    expect(
      verifyWebhookSignature(payload, "not-hex", secret, context),
    ).toBe(false);
  });
});

describe("secret encryption", () => {
  it("round-trips an encrypted provider secret", () => {
    const key = "a-local-encryption-key-with-enough-entropy";
    const encrypted = encryptSecret("provider-secret", key);
    expect(encrypted).not.toContain("provider-secret");
    expect(decryptSecret(encrypted, key)).toBe("provider-secret");
  });

  it("uses a random IV for each encryption", () => {
    const key = "a-local-encryption-key-with-enough-entropy";
    expect(encryptSecret("same-value", key)).not.toBe(encryptSecret("same-value", key));
  });
});
