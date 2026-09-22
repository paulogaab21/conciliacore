import { CaseStatus, PaymentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { handleApiError, requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export async function GET() {
  try {
    const session = await requireApiSession();
    const organizationId = session.organizationId;
    const since = startOfDay(new Date(Date.now() - 6 * 24 * 60 * 60 * 1_000));

    const [
      organization,
      payments,
      orders,
      cases,
      recentCases,
      recentPayments,
      recentOrders,
      auditLogs,
      latestRun,
      deliveries,
    ] = await Promise.all([
      prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { id: true, name: true, slug: true, dataRetentionDays: true },
      }),
      prisma.payment.findMany({
        where: { organizationId, paidAt: { gte: since } },
        orderBy: { paidAt: "asc" },
      }),
      prisma.order.findMany({ where: { organizationId } }),
      prisma.reconciliationCase.findMany({ where: { organizationId } }),
      prisma.reconciliationCase.findMany({
        where: { organizationId },
        include: {
          order: { select: { externalId: true, amountCents: true, customerName: true } },
          payment: { select: { transactionId: true, provider: true, amountCents: true } },
          assignedTo: { select: { id: true, name: true } },
        },
        orderBy: [{ status: "asc" }, { severity: "asc" }, { createdAt: "desc" }],
        take: 20,
      }),
      prisma.payment.findMany({
        where: { organizationId },
        orderBy: { paidAt: "desc" },
        take: 12,
      }),
      prisma.order.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      prisma.auditLog.findMany({
        where: { organizationId },
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      prisma.reconciliationRun.findFirst({
        where: { organizationId },
        orderBy: { startedAt: "desc" },
      }),
      prisma.webhookDelivery.findMany({
        where: { organizationId, receivedAt: { gte: since } },
        orderBy: { receivedAt: "desc" },
      }),
    ]);

    const confirmedPayments = payments.filter(
      (payment) => payment.status === PaymentStatus.CONFIRMED,
    );
    const totalProcessedCents = confirmedPayments.reduce(
      (sum, payment) => sum + payment.amountCents,
      0,
    );
    const openCases = cases.filter(
      (item) => item.status === CaseStatus.OPEN || item.status === CaseStatus.IN_REVIEW,
    );
    const criticalCases = openCases.filter((item) => item.severity === "CRITICAL");
    const resolvedCases = cases.filter((item) => item.status === CaseStatus.RESOLVED);
    const matchedPayments = payments.filter((payment) => {
      const order = orders.find((item) => item.externalId === payment.orderExternalId);
      return order && order.amountCents === payment.amountCents;
    }).length;
    const reconciliationRate = payments.length
      ? Math.round((matchedPayments / payments.length) * 1_000) / 10
      : 100;

    const dailyVolume = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(since);
      day.setDate(day.getDate() + index);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      const dayPayments = payments.filter(
        (payment) => payment.paidAt >= day && payment.paidAt < nextDay,
      );

      return {
        date: day.toISOString(),
        label: new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
          .format(day)
          .replace(".", ""),
        amountCents: dayPayments.reduce((sum, payment) => sum + payment.amountCents, 0),
        count: dayPayments.length,
      };
    });

    const providerMap = new Map<string, { amountCents: number; count: number }>();
    for (const payment of payments) {
      const current = providerMap.get(payment.provider) ?? { amountCents: 0, count: 0 };
      providerMap.set(payment.provider, {
        amountCents: current.amountCents + payment.amountCents,
        count: current.count + 1,
      });
    }

    const webhookSuccessRate = deliveries.length
      ? Math.round(
          (deliveries.filter((delivery) => delivery.signatureValid).length /
            deliveries.length) *
            1_000,
        ) / 10
      : 100;

    return NextResponse.json({
      organization,
      session,
      metrics: {
        totalProcessedCents,
        reconciliationRate,
        openCases: openCases.length,
        criticalCases: criticalCases.length,
        resolvedCases: resolvedCases.length,
        webhookSuccessRate,
        duplicateDeliveries: deliveries.filter((delivery) => delivery.duplicate).length,
      },
      dailyVolume,
      providerBreakdown: Array.from(providerMap, ([provider, values]) => ({
        provider,
        ...values,
      })).sort((a, b) => b.amountCents - a.amountCents),
      cases: recentCases,
      payments: recentPayments,
      orders: recentOrders,
      auditLogs,
      latestRun,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
