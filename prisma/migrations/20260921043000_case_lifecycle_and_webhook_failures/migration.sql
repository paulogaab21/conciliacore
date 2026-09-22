CREATE TYPE "CaseResolutionSource" AS ENUM ('MANUAL', 'AUTOMATIC');

ALTER TABLE "WebhookDelivery"
ADD COLUMN "failureCode" TEXT;

ALTER TABLE "ReconciliationCase"
ADD COLUMN "resolutionSource" "CaseResolutionSource";
