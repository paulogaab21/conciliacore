import { randomUUID } from "node:crypto";
import {
  CaseResolutionSource,
  CaseStatus,
  OrderStatus,
  PaymentStatus,
} from "@prisma/client";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { runReconciliation } from "@/lib/reconciliation-service";

const organizationsToDelete: string[] = [];

afterEach(async () => {
  await prisma.organization.deleteMany({
    where: { id: { in: organizationsToDelete.splice(0) } },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("reconciliation case lifecycle", () => {
  it("auto-resolves a stale finding, reopens recurrence and preserves manual resolution", async () => {
    const suffix = randomUUID();
    const organization = await prisma.organization.create({
      data: {
        slug: `integration-${suffix}`,
        name: "Integration Test",
        webhookSecretEncrypted: "not-used-by-this-test",
      },
    });
    organizationsToDelete.push(organization.id);

    const order = await prisma.order.create({
      data: {
        organizationId: organization.id,
        externalId: `ORD-${suffix}`,
        customerName: "Test customer",
        amountCents: 10_000,
        status: OrderStatus.PENDING,
      },
    });
    const payment = await prisma.payment.create({
      data: {
        organizationId: organization.id,
        provider: "integration",
        transactionId: `TX-${suffix}`,
        orderExternalId: order.externalId,
        amountCents: 10_000,
        status: PaymentStatus.CONFIRMED,
        paidAt: new Date(),
      },
    });
    const fingerprint = `status:${order.id}:${payment.id}`;

    await runReconciliation(organization.id, "INTEGRATION_TEST");
    await expect(
      prisma.reconciliationCase.findUniqueOrThrow({
        where: {
          organizationId_fingerprint: {
            organizationId: organization.id,
            fingerprint,
          },
        },
      }),
    ).resolves.toMatchObject({ status: CaseStatus.OPEN });

    await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.PAID },
    });
    await runReconciliation(organization.id, "INTEGRATION_TEST");
    await expect(
      prisma.reconciliationCase.findUniqueOrThrow({
        where: {
          organizationId_fingerprint: {
            organizationId: organization.id,
            fingerprint,
          },
        },
      }),
    ).resolves.toMatchObject({
      status: CaseStatus.RESOLVED,
      resolutionSource: CaseResolutionSource.AUTOMATIC,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.PENDING },
    });
    await runReconciliation(organization.id, "INTEGRATION_TEST");
    const reopened = await prisma.reconciliationCase.findUniqueOrThrow({
      where: {
        organizationId_fingerprint: {
          organizationId: organization.id,
          fingerprint,
        },
      },
    });
    expect(reopened).toMatchObject({
      status: CaseStatus.OPEN,
      resolution: null,
      resolutionSource: null,
      resolvedAt: null,
    });

    await prisma.reconciliationCase.update({
      where: { id: reopened.id },
      data: {
        status: CaseStatus.RESOLVED,
        resolution: "Reviewed and closed by an authorized operator.",
        resolutionSource: CaseResolutionSource.MANUAL,
        resolvedAt: new Date(),
      },
    });
    await runReconciliation(organization.id, "INTEGRATION_TEST");
    await expect(
      prisma.reconciliationCase.findUniqueOrThrow({
        where: { id: reopened.id },
      }),
    ).resolves.toMatchObject({
      status: CaseStatus.RESOLVED,
      resolutionSource: CaseResolutionSource.MANUAL,
    });

    const lifecycleAudits = await prisma.auditLog.findMany({
      where: {
        organizationId: organization.id,
        action: { in: ["CASE_AUTO_RESOLVED", "CASE_REOPENED"] },
      },
      orderBy: { createdAt: "asc" },
    });
    expect(lifecycleAudits.map((item) => item.action)).toEqual([
      "CASE_AUTO_RESOLVED",
      "CASE_REOPENED",
    ]);
  });
});
