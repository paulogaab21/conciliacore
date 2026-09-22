import type { MessageKey } from "@/i18n/messages";
import type { Session } from "@/contracts/session";

export type CaseStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";
export type CaseSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ReconciliationCase = {
  id: string;
  type: string;
  severity: CaseSeverity;
  status: CaseStatus;
  title: string;
  description: string;
  differenceCents: number | null;
  evidence: Record<string, unknown>;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  order: { externalId: string; amountCents: number; customerName: string } | null;
  payment: { transactionId: string; provider: string; amountCents: number } | null;
  assignedTo: { id: string; name: string } | null;
};

export type Payment = {
  id: string;
  provider: string;
  transactionId: string;
  orderExternalId: string | null;
  amountCents: number;
  currency: string;
  status: string;
  paidAt: string;
};

export type Order = {
  id: string;
  externalId: string;
  customerName: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { name: string } | null;
};

export type DashboardData = {
  organization: { id: string; name: string; slug: string; dataRetentionDays: number };
  session: Session;
  metrics: {
    totalProcessedCents: number;
    reconciliationRate: number;
    openCases: number;
    criticalCases: number;
    resolvedCases: number;
    webhookSuccessRate: number;
    duplicateDeliveries: number;
  };
  dailyVolume: Array<{
    date: string;
    label: string;
    amountCents: number;
    count: number;
  }>;
  providerBreakdown: Array<{ provider: string; amountCents: number; count: number }>;
  cases: ReconciliationCase[];
  payments: Payment[];
  orders: Order[];
  auditLogs: AuditLog[];
  latestRun: {
    id: string;
    status: string;
    trigger: string;
    ordersScanned: number;
    paymentsScanned: number;
    matchedCount: number;
    caseCount: number;
    durationMs: number | null;
    startedAt: string;
    completedAt: string | null;
  } | null;
};

export type View = "overview" | "guarantees" | "exceptions" | "transactions" | "audit";
export type Toast = { tone: "success" | "error"; message: string } | null;
export type Translate = (
  key: MessageKey,
  replacements?: Record<string, string | number>,
) => string;
