-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ANALYST', 'AUDITOR');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'PARTIALLY_PAID', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CONFIRMED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentEventType" AS ENUM ('PAYMENT_CONFIRMED', 'PAYMENT_REFUNDED');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "CaseType" AS ENUM ('UNMATCHED_PAYMENT', 'AMOUNT_MISMATCH', 'DUPLICATE_PAYMENT', 'ORDER_STATUS_MISMATCH', 'REFUND_MISMATCH', 'MISSING_PAYMENT');

-- CreateEnum
CREATE TYPE "CaseSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReconciliationRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "webhookSecretEncrypted" TEXT NOT NULL,
    "dataRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ANALYST',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerDocumentMasked" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "orderExternalId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" "PaymentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "orderExternalId" TEXT,
    "type" "PaymentEventType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "rawPayload" JSONB NOT NULL,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "duplicate" BOOLEAN NOT NULL DEFAULT false,
    "responseStatus" INTEGER NOT NULL,
    "processingTimeMs" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationCase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "type" "CaseType" NOT NULL,
    "severity" "CaseSeverity" NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "differenceCents" INTEGER,
    "evidence" JSONB NOT NULL,
    "orderId" TEXT,
    "paymentId" TEXT,
    "assignedToId" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "ReconciliationRunStatus" NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT NOT NULL,
    "ordersScanned" INTEGER NOT NULL DEFAULT 0,
    "paymentsScanned" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "caseCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "failureReason" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "Order_organizationId_status_idx" ON "Order"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Order_organizationId_createdAt_idx" ON "Order"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_organizationId_externalId_key" ON "Order"("organizationId", "externalId");

-- CreateIndex
CREATE INDEX "Payment_organizationId_orderExternalId_idx" ON "Payment"("organizationId", "orderExternalId");

-- CreateIndex
CREATE INDEX "Payment_organizationId_paidAt_idx" ON "Payment"("organizationId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_organizationId_provider_transactionId_key" ON "Payment"("organizationId", "provider", "transactionId");

-- CreateIndex
CREATE INDEX "PaymentEvent_organizationId_status_receivedAt_idx" ON "PaymentEvent"("organizationId", "status", "receivedAt");

-- CreateIndex
CREATE INDEX "PaymentEvent_organizationId_transactionId_idx" ON "PaymentEvent"("organizationId", "transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_organizationId_provider_providerEventId_key" ON "PaymentEvent"("organizationId", "provider", "providerEventId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_organizationId_receivedAt_idx" ON "WebhookDelivery"("organizationId", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_organizationId_deliveryId_idx" ON "WebhookDelivery"("organizationId", "deliveryId");

-- CreateIndex
CREATE INDEX "ReconciliationCase_organizationId_status_severity_idx" ON "ReconciliationCase"("organizationId", "status", "severity");

-- CreateIndex
CREATE INDEX "ReconciliationCase_organizationId_createdAt_idx" ON "ReconciliationCase"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationCase_organizationId_fingerprint_key" ON "ReconciliationCase"("organizationId", "fingerprint");

-- CreateIndex
CREATE INDEX "ReconciliationRun_organizationId_startedAt_idx" ON "ReconciliationRun"("organizationId", "startedAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_entityType_entityId_idx" ON "AuditLog"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_nextAttemptAt_idx" ON "OutboxEvent"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_organizationId_createdAt_idx" ON "OutboxEvent"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationCase" ADD CONSTRAINT "ReconciliationCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationCase" ADD CONSTRAINT "ReconciliationCase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationCase" ADD CONSTRAINT "ReconciliationCase_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationCase" ADD CONSTRAINT "ReconciliationCase_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationRun" ADD CONSTRAINT "ReconciliationRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
