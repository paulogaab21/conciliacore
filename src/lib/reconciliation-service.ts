import {
  CaseResolutionSource,
  CaseSeverity,
  CaseStatus,
  CaseType,
  Prisma,
  ReconciliationRunStatus,
} from "@prisma/client";
import { shouldReopenRecurringCase } from "@/domain/case-lifecycle";
import {
  analyzeReconciliation,
  type ReconciliationResult,
} from "@/domain/reconciliation";
import { prisma } from "@/lib/prisma";

const AUTOMATIC_RESOLUTION =
  "Closed automatically after a reconciliation run found no mismatch.";
const MAX_TRANSACTION_ATTEMPTS = 3;

type PublishReconciliationInput = {
  organizationId: string;
  trigger: string;
  actorId?: string;
  runId: string;
  startedAt: number;
  ordersScanned: number;
  paymentsScanned: number;
  result: ReconciliationResult;
};

function isRetryableTransactionConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

async function waitBeforeRetry(attempt: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, attempt * 50));
}

async function publishReconciliation(input: PublishReconciliationInput) {
  const activeFingerprints = input.result.findings.map(
    (finding) => finding.fingerprint,
  );

  for (let transactionAttempt = 1; ; transactionAttempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const existingCases = activeFingerprints.length
            ? await tx.reconciliationCase.findMany({
                where: {
                  organizationId: input.organizationId,
                  fingerprint: { in: activeFingerprints },
                },
                select: {
                  id: true,
                  fingerprint: true,
                  status: true,
                  resolutionSource: true,
                },
              })
            : [];
          const existingByFingerprint = new Map(
            existingCases.map((item) => [item.fingerprint, item]),
          );
          const reopenedCases: Array<{ id: string; title: string }> = [];

          for (const finding of input.result.findings) {
            const existing = existingByFingerprint.get(finding.fingerprint);
            const reopen = existing
              ? shouldReopenRecurringCase(existing)
              : false;
            const item = await tx.reconciliationCase.upsert({
              where: {
                organizationId_fingerprint: {
                  organizationId: input.organizationId,
                  fingerprint: finding.fingerprint,
                },
              },
              create: {
                organizationId: input.organizationId,
                fingerprint: finding.fingerprint,
                type: finding.type as CaseType,
                severity: finding.severity as CaseSeverity,
                title: finding.title,
                description: finding.description,
                differenceCents: finding.differenceCents,
                evidence: finding.evidence as Prisma.InputJsonValue,
                orderId: finding.orderId,
                paymentId: finding.paymentId,
              },
              update: {
                severity: finding.severity as CaseSeverity,
                title: finding.title,
                description: finding.description,
                differenceCents: finding.differenceCents,
                evidence: finding.evidence as Prisma.InputJsonValue,
                orderId: finding.orderId,
                paymentId: finding.paymentId,
                ...(reopen
                  ? {
                      status: CaseStatus.OPEN,
                      resolution: null,
                      resolutionSource: null,
                      resolvedAt: null,
                    }
                  : {}),
              },
            });

            if (reopen) {
              reopenedCases.push({ id: item.id, title: item.title });
            }
          }

          const staleCases = await tx.reconciliationCase.findMany({
            where: {
              organizationId: input.organizationId,
              status: { in: [CaseStatus.OPEN, CaseStatus.IN_REVIEW] },
              ...(activeFingerprints.length
                ? { fingerprint: { notIn: activeFingerprints } }
                : {}),
            },
            select: { id: true, title: true },
          });

          if (staleCases.length) {
            await tx.reconciliationCase.updateMany({
              where: { id: { in: staleCases.map((item) => item.id) } },
              data: {
                status: CaseStatus.RESOLVED,
                resolution: AUTOMATIC_RESOLUTION,
                resolutionSource: CaseResolutionSource.AUTOMATIC,
                resolvedAt: new Date(),
              },
            });
          }

          const lifecycleAuditEntries: Prisma.AuditLogCreateManyInput[] = [
            ...reopenedCases.map((item) => ({
              organizationId: input.organizationId,
              actorId: input.actorId ?? null,
              action: "CASE_REOPENED",
              entityType: "ReconciliationCase",
              entityId: item.id,
              summary: `The mismatch “${item.title}” recurred and was reopened.`,
              metadata: { trigger: input.trigger } as Prisma.InputJsonValue,
            })),
            ...staleCases.map((item) => ({
              organizationId: input.organizationId,
              actorId: input.actorId ?? null,
              action: "CASE_AUTO_RESOLVED",
              entityType: "ReconciliationCase",
              entityId: item.id,
              summary: `The mismatch “${item.title}” no longer occurs and was closed automatically.`,
              metadata: { trigger: input.trigger } as Prisma.InputJsonValue,
            })),
          ];

          if (lifecycleAuditEntries.length) {
            await tx.auditLog.createMany({ data: lifecycleAuditEntries });
          }

          const durationMs = Date.now() - input.startedAt;
          const completedRun = await tx.reconciliationRun.update({
            where: { id: input.runId },
            data: {
              status: ReconciliationRunStatus.COMPLETED,
              ordersScanned: input.ordersScanned,
              paymentsScanned: input.paymentsScanned,
              matchedCount: input.result.matchedCount,
              caseCount: input.result.findings.length,
              durationMs,
              completedAt: new Date(),
            },
          });

          await tx.auditLog.create({
            data: {
              organizationId: input.organizationId,
              actorId: input.actorId ?? null,
              action: "RECONCILIATION_COMPLETED",
              entityType: "ReconciliationRun",
              entityId: input.runId,
              summary: `Reconciliation completed with ${input.result.findings.length} finding(s).`,
              metadata: {
                ordersScanned: input.ordersScanned,
                paymentsScanned: input.paymentsScanned,
                matchedCount: input.result.matchedCount,
                durationMs,
                trigger: input.trigger,
                autoResolvedCount: staleCases.length,
                reopenedCount: reopenedCases.length,
              },
            },
          });

          return completedRun;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 20_000,
        },
      );
    } catch (error) {
      if (
        transactionAttempt >= MAX_TRANSACTION_ATTEMPTS ||
        !isRetryableTransactionConflict(error)
      ) {
        throw error;
      }

      await waitBeforeRetry(transactionAttempt);
    }
  }
}

export async function runReconciliation(
  organizationId: string,
  trigger: string,
  actorId?: string,
) {
  const startedAt = Date.now();
  const run = await prisma.reconciliationRun.create({
    data: { organizationId, trigger },
  });

  try {
    const [orders, payments] = await Promise.all([
      prisma.order.findMany({ where: { organizationId } }),
      prisma.payment.findMany({ where: { organizationId } }),
    ]);
    const result = analyzeReconciliation(orders, payments);

    return await publishReconciliation({
      organizationId,
      trigger,
      actorId,
      runId: run.id,
      startedAt,
      ordersScanned: orders.length,
      paymentsScanned: payments.length,
      result,
    });
  } catch (error) {
    try {
      await prisma.reconciliationRun.update({
        where: { id: run.id },
        data: {
          status: ReconciliationRunStatus.FAILED,
          failureReason:
            error instanceof Error
              ? error.message.slice(0, 1_000)
              : "Unknown error",
          durationMs: Date.now() - startedAt,
          completedAt: new Date(),
        },
      });
    } catch {
      console.error("Unable to mark reconciliation as failed", {
        organizationId,
        runId: run.id,
      });
    }
    throw error;
  }
}
