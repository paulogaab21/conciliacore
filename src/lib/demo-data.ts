import { hash } from "bcryptjs";
import {
  CaseResolutionSource,
  CaseSeverity,
  CaseStatus,
  CaseType,
  OrderStatus,
  PaymentStatus,
  Prisma,
  UserRole,
} from "@prisma/client";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { runReconciliation } from "@/lib/reconciliation-service";

export const DEMO_ORGANIZATION_SLUG = "acme-commerce";
export const DEMO_ADMIN_EMAIL = "admin@conciliacore.dev";
export const DEMO_PASSWORD = "Demo@123";

function daysAgo(days: number, hours = 10, minutes = 0): Date {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

export async function seedDemoData(options: {
  encryptionKey: string;
  webhookSecret: string;
}) {
  const passwordHash = await hash(DEMO_PASSWORD, 12);
  const webhookSecretEncrypted = encryptSecret(
    options.webhookSecret,
    options.encryptionKey,
  );

  const organization = await prisma.organization.upsert({
    where: { slug: DEMO_ORGANIZATION_SLUG },
    create: {
      slug: DEMO_ORGANIZATION_SLUG,
      name: "Acme Commerce",
      legalName: "Acme Commerce Ltda.",
      webhookSecretEncrypted,
      dataRetentionDays: 90,
    },
    update: {
      name: "Acme Commerce",
      legalName: "Acme Commerce Ltda.",
      webhookSecretEncrypted,
    },
  });

  await prisma.$transaction([
    prisma.outboxEvent.deleteMany({ where: { organizationId: organization.id } }),
    prisma.auditLog.deleteMany({ where: { organizationId: organization.id } }),
    prisma.reconciliationCase.deleteMany({ where: { organizationId: organization.id } }),
    prisma.reconciliationRun.deleteMany({ where: { organizationId: organization.id } }),
    prisma.webhookDelivery.deleteMany({ where: { organizationId: organization.id } }),
    prisma.paymentEvent.deleteMany({ where: { organizationId: organization.id } }),
    prisma.payment.deleteMany({ where: { organizationId: organization.id } }),
    prisma.order.deleteMany({ where: { organizationId: organization.id } }),
  ]);

  const admin = await prisma.user.upsert({
    where: { email: DEMO_ADMIN_EMAIL },
    create: {
      organizationId: organization.id,
      name: "Marina Costa",
      email: DEMO_ADMIN_EMAIL,
      passwordHash,
      role: UserRole.ADMIN,
    },
    update: {
      organizationId: organization.id,
      name: "Marina Costa",
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  const analyst = await prisma.user.upsert({
    where: { email: "analyst@conciliacore.dev" },
    create: {
      organizationId: organization.id,
      name: "Rafael Lima",
      email: "analyst@conciliacore.dev",
      passwordHash,
      role: UserRole.ANALYST,
    },
    update: {
      organizationId: organization.id,
      name: "Rafael Lima",
      passwordHash,
      role: UserRole.ANALYST,
    },
  });

  await prisma.user.upsert({
    where: { email: "auditor@conciliacore.dev" },
    create: {
      organizationId: organization.id,
      name: "Ana Souza",
      email: "auditor@conciliacore.dev",
      passwordHash,
      role: UserRole.AUDITOR,
    },
    update: {
      organizationId: organization.id,
      name: "Ana Souza",
      passwordHash,
      role: UserRole.AUDITOR,
    },
  });

  const orderData: Prisma.OrderCreateManyInput[] = [
    ["ORD-1048", "Camila Ferreira", 18_990, "PAID", 0],
    ["ORD-1047", "João Martins", 42_750, "PAID", 0],
    ["ORD-1046", "Beatriz Rocha", 12_990, "PENDING", 1],
    ["ORD-1045", "Felipe Alves", 89_900, "PAID", 1],
    ["ORD-1044", "Larissa Mendes", 25_000, "PAID", 2],
    ["ORD-1043", "Gustavo Santos", 59_990, "CANCELLED", 2],
    ["ORD-1042", "Paula Ribeiro", 14_500, "PAID", 3],
    ["ORD-1041", "Lucas Nunes", 32_000, "REFUNDED", 4],
    ["ORD-1040", "Renata Oliveira", 47_890, "PAID", 5],
    ["ORD-1039", "Diego Barros", 9_990, "PENDING", 6],
    ["ORD-1038", "Sofia Carvalho", 71_500, "PAID", 7],
    ["ORD-1037", "Mateus Freitas", 16_900, "PAID", 8],
    ["ORD-1036", "Juliana Pires", 23_450, "PAID", 9],
    ["ORD-1035", "André Moreira", 55_000, "PAID", 10],
    ["ORD-1034", "Carolina Dias", 11_990, "PAID", 11],
    ["ORD-1033", "Bruno Teixeira", 64_990, "PAID", 12],
  ].map(([externalId, customerName, amountCents, status, days]) => ({
    organizationId: organization.id,
    externalId: externalId as string,
    customerName: customerName as string,
    customerDocumentMasked: "***.***.***-**",
    amountCents: amountCents as number,
    status: status as OrderStatus,
    currency: "BRL",
    createdAt: daysAgo(days as number, 9, 18),
    dueAt: daysAgo((days as number) - 2, 23, 59),
  }));

  await prisma.order.createMany({ data: orderData });

  const paymentData: Prisma.PaymentCreateManyInput[] = [
    ["pix", "PIX-8F2A91", "ORD-1048", 18_990, "CONFIRMED", 0],
    ["stripe", "PAY-934881", "ORD-1047", 42_750, "CONFIRMED", 0],
    ["pix", "PIX-7C19B2", "ORD-1046", 12_990, "CONFIRMED", 1],
    ["mercadopago", "MP-381029", "ORD-1045", 79_900, "CONFIRMED", 1],
    ["stripe", "PAY-934520", "ORD-1044", 25_000, "CONFIRMED", 2],
    ["stripe", "PAY-934521", "ORD-1044", 25_000, "CONFIRMED", 2],
    ["pix", "PIX-6A11FE", "ORD-1043", 59_990, "CONFIRMED", 2],
    ["mercadopago", "MP-379112", null, 14_500, "CONFIRMED", 3],
    ["stripe", "PAY-931440", "ORD-1041", 32_000, "REFUNDED", 4],
    ["pix", "PIX-5E92D1", "ORD-1040", 47_890, "CONFIRMED", 5],
    ["stripe", "PAY-929181", "ORD-1038", 71_500, "CONFIRMED", 7],
    ["pix", "PIX-4B728A", "ORD-1037", 16_900, "CONFIRMED", 8],
    ["mercadopago", "MP-372881", "ORD-1036", 23_450, "CONFIRMED", 9],
    ["stripe", "PAY-925120", "ORD-1035", 55_000, "CONFIRMED", 10],
    ["pix", "PIX-3A119B", "ORD-1034", 11_990, "CONFIRMED", 11],
    ["stripe", "PAY-921004", "ORD-1033", 64_990, "CONFIRMED", 12],
  ].map(([provider, transactionId, orderExternalId, amountCents, status, days]) => ({
    organizationId: organization.id,
    provider: provider as string,
    transactionId: transactionId as string,
    orderExternalId: orderExternalId as string | null,
    amountCents: amountCents as number,
    status: status as PaymentStatus,
    currency: "BRL",
    paidAt: daysAgo(days as number, 10, 24),
    refundedAt:
      status === "REFUNDED" ? daysAgo((days as number) - 1, 14, 8) : null,
    createdAt: daysAgo(days as number, 10, 24),
  }));

  await prisma.payment.createMany({ data: paymentData });

  await prisma.webhookDelivery.createMany({
    data: [
      {
        organizationId: organization.id,
        provider: "pix",
        deliveryId: "demo-delivery-1048",
        eventType: "payment.confirmed",
        payloadHash: "a6ea71b41f4c-demo",
        signatureValid: true,
        responseStatus: 202,
        processingTimeMs: 38,
        receivedAt: daysAgo(0, 10, 24),
      },
      {
        organizationId: organization.id,
        provider: "stripe",
        deliveryId: "demo-delivery-1047",
        eventType: "payment.confirmed",
        payloadHash: "c49ea21ba812-demo",
        signatureValid: true,
        responseStatus: 202,
        processingTimeMs: 42,
        receivedAt: daysAgo(0, 9, 51),
      },
      {
        organizationId: organization.id,
        provider: "stripe",
        deliveryId: "demo-delivery-1047-duplicate",
        eventType: "payment.confirmed",
        payloadHash: "c49ea21ba812-demo",
        signatureValid: true,
        duplicate: true,
        responseStatus: 200,
        processingTimeMs: 12,
        receivedAt: daysAgo(0, 9, 52),
      },
    ],
  });

  await runReconciliation(organization.id, "DEMO_SEED", admin.id);

  const firstOpenCase = await prisma.reconciliationCase.findFirst({
    where: { organizationId: organization.id, status: CaseStatus.OPEN },
    orderBy: { createdAt: "asc" },
  });

  if (firstOpenCase) {
    await prisma.reconciliationCase.update({
      where: { id: firstOpenCase.id },
      data: { status: CaseStatus.IN_REVIEW, assignedToId: analyst.id },
    });
  }

  const resolvedOrder = await prisma.order.findFirst({
    where: { organizationId: organization.id, externalId: "ORD-1033" },
  });
  const resolvedPayment = await prisma.payment.findFirst({
    where: { organizationId: organization.id, transactionId: "PAY-921004" },
  });

  if (resolvedOrder && resolvedPayment) {
    await prisma.reconciliationCase.create({
      data: {
        organizationId: organization.id,
        fingerprint: "demo:resolved:ord-1033",
        type: CaseType.ORDER_STATUS_MISMATCH,
        severity: CaseSeverity.MEDIUM,
        status: CaseStatus.RESOLVED,
        title: "Order status synchronized after webhook delay",
        description: "The payment was confirmed before the order service processed the event.",
        orderId: resolvedOrder.id,
        paymentId: resolvedPayment.id,
        assignedToId: analyst.id,
        resolution: "The status event was reprocessed and downstream consistency was confirmed.",
        resolutionSource: CaseResolutionSource.MANUAL,
        resolvedAt: daysAgo(1, 16, 42),
        evidence: {
          orderExternalId: resolvedOrder.externalId,
          transactionId: resolvedPayment.transactionId,
          previousStatus: "PENDING",
          finalStatus: "PAID",
        },
        createdAt: daysAgo(2, 11, 17),
      },
    });
  }

  await prisma.auditLog.createMany({
    data: [
      {
        organizationId: organization.id,
        actorId: analyst.id,
        action: "CASE_ASSIGNED",
        entityType: "ReconciliationCase",
        entityId: firstOpenCase?.id,
        summary: "Exception assigned to Rafael Lima for investigation.",
        createdAt: daysAgo(0, 11, 2),
      },
      {
        organizationId: organization.id,
        actorId: admin.id,
        action: "CSV_IMPORTED",
        entityType: "Statement",
        summary: "Financial statement imported: acme-statement-september.csv.",
        metadata: { rows: 16, accepted: 16, rejected: 0 },
        createdAt: daysAgo(0, 9, 35),
      },
      {
        organizationId: organization.id,
        action: "WEBHOOK_DUPLICATE_IGNORED",
        entityType: "WebhookDelivery",
        summary: "Duplicate delivery ignored without creating another payment.",
        metadata: { provider: "stripe", deliveryId: "demo-delivery-1047-duplicate" },
        createdAt: daysAgo(0, 9, 52),
      },
    ],
  });

  return { organization, admin };
}
