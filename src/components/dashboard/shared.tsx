"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/i18n/locale-provider";
import type { Locale, MessageKey } from "@/i18n/messages";
import type {
  AuditLog,
  CaseSeverity,
  ReconciliationCase,
  Translate,
} from "@/components/dashboard/types";

const labelKeys: Record<string, MessageKey> = {
  ALL: "label.ALL",
  OPEN: "label.OPEN",
  IN_REVIEW: "label.IN_REVIEW",
  RESOLVED: "label.RESOLVED",
  DISMISSED: "label.DISMISSED",
  PENDING: "label.PENDING",
  PAID: "label.PAID",
  PARTIALLY_PAID: "label.PARTIALLY_PAID",
  REFUNDED: "label.REFUNDED",
  CANCELLED: "label.CANCELLED",
  CONFIRMED: "label.CONFIRMED",
  FAILED: "label.FAILED",
  ADMIN: "label.ADMIN",
  ANALYST: "label.ANALYST",
  AUDITOR: "label.AUDITOR",
  LOW: "label.LOW",
  MEDIUM: "label.MEDIUM",
  HIGH: "label.HIGH",
  CRITICAL: "label.CRITICAL",
  UNMATCHED_PAYMENT: "label.UNMATCHED_PAYMENT",
  AMOUNT_MISMATCH: "label.AMOUNT_MISMATCH",
  DUPLICATE_PAYMENT: "label.DUPLICATE_PAYMENT",
  ORDER_STATUS_MISMATCH: "label.ORDER_STATUS_MISMATCH",
  REFUND_MISMATCH: "label.REFUND_MISMATCH",
  MISSING_PAYMENT: "label.MISSING_PAYMENT",
  USER_LOGGED_IN: "label.USER_LOGGED_IN",
  USER_LOGGED_OUT: "label.USER_LOGGED_OUT",
  CASE_UPDATED: "label.CASE_UPDATED",
  CASE_RESOLVED: "label.CASE_RESOLVED",
  CASE_REOPENED: "label.CASE_REOPENED",
  CASE_AUTO_RESOLVED: "label.CASE_AUTO_RESOLVED",
  CASE_ASSIGNED: "label.CASE_ASSIGNED",
  CSV_IMPORTED: "label.CSV_IMPORTED",
  WEBHOOK_DUPLICATE_IGNORED: "label.WEBHOOK_DUPLICATE_IGNORED",
  RECONCILIATION_COMPLETED: "label.RECONCILIATION_COMPLETED",
  PAYMENT_EVENT_PROCESSED: "label.PAYMENT_EVENT_PROCESSED",
  provider: "label.provider",
  transactionId: "label.transactionId",
  transactionIds: "label.transactionIds",
  orderReference: "label.orderReference",
  orderExternalId: "label.orderExternalId",
  amountCents: "label.amountCents",
  orderAmountCents: "label.orderAmountCents",
  paymentAmountCents: "label.paymentAmountCents",
  totalPaidCents: "label.totalPaidCents",
  orderStatus: "label.orderStatus",
  paymentStatus: "label.paymentStatus",
  previousStatus: "label.previousStatus",
  finalStatus: "label.finalStatus",
};

export function formatMoney(cents: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function humanize(value: string, t: Translate): string {
  const key = labelKeys[value];
  if (key) return t(key);
  const normalized = value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .toLowerCase()
    .trim();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function localizedCaseTitle(item: ReconciliationCase, t: Translate): string {
  const key = `caseTitle.${item.type}` as MessageKey;
  return labelKeys[item.type] ? t(key) : item.title;
}

export function localizedCaseDescription(item: ReconciliationCase, t: Translate): string {
  const key = `caseDescription.${item.type}` as MessageKey;
  if (!labelKeys[item.type]) return item.description;

  return t(key, {
    transaction: item.payment?.transactionId ?? "—",
    order: item.order?.externalId ?? "—",
  });
}

export function localizedAuditSummary(log: AuditLog, t: Translate): string {
  const key = `audit.summary.${log.action}` as MessageKey;
  if (!labelKeys[log.action]) return log.summary;
  return t(key, { actor: log.actor?.name ?? t("audit.systemActor") });
}

export function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function relativeTime(value: string, locale: Locale): string {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1_000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of ranges) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return formatter.format(0, "second");
}

export function StatusPill({ status }: { status: string }) {
  const { t } = useLocale();
  const tone =
    status === "RESOLVED" || status === "PAID" || status === "CONFIRMED"
      ? "success"
      : status === "IN_REVIEW" || status === "PARTIALLY_PAID"
        ? "warning"
        : status === "OPEN" || status === "FAILED" || status === "CANCELLED"
          ? "danger"
          : "neutral";
  return <span className={`status-pill status-pill--${tone}`}><i />{humanize(status, t)}</span>;
}

export function SeverityPill({ severity }: { severity: CaseSeverity }) {
  const { t } = useLocale();
  return <span className={`severity severity--${severity.toLowerCase()}`}>{humanize(severity, t)}</span>;
}

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div><span className="eyebrow">{eyebrow}</span><h1 tabIndex={-1}>{title}</h1><p>{description}</p></div>
      {actions && <div className="page-heading__actions">{actions}</div>}
    </div>
  );
}
