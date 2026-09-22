import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(value: string, encryptionKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, deriveKey(encryptionKey), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(value: string, encryptionKey: string): string {
  const [ivEncoded, tagEncoded, encryptedEncoded] = value.split(".");
  if (!ivEncoded || !tagEncoded || !encryptedEncoded) {
    throw new Error("Invalid encrypted secret format");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    deriveKey(encryptionKey),
    Buffer.from(ivEncoded, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export type WebhookSignatureContext = {
  provider: string;
  timestamp: string;
};

function webhookSignatureInput(
  rawBody: string,
  context: WebhookSignatureContext,
): string {
  return `${context.timestamp}.${context.provider}.${rawBody}`;
}

export function signWebhook(
  rawBody: string,
  secret: string,
  context: WebhookSignatureContext,
): string {
  return createHmac("sha256", secret)
    .update(webhookSignatureInput(rawBody, context))
    .digest("hex");
}

export function verifyWebhookSignature(
  rawBody: string,
  providedSignature: string,
  secret: string,
  context: WebhookSignatureContext,
): boolean {
  const prefix = "sha256=";
  const normalized = providedSignature.startsWith(prefix)
    ? providedSignature.slice(prefix.length)
    : providedSignature;
  const expected = signWebhook(rawBody, secret, context);

  if (normalized.length !== expected.length) {
    return false;
  }

  try {
    return timingSafeEqual(Buffer.from(normalized, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
