"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Database,
  GitMerge,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Webhook,
} from "lucide-react";
import { CasesTable } from "@/components/dashboard/cases-table";
import { useLocale } from "@/i18n/locale-provider";
import {
  formatDate,
  formatMoney,
  humanize,
  localizedAuditSummary,
  PageHeading,
  relativeTime,
  StatusPill,
} from "@/components/dashboard/shared";
import type {
  AuditLog,
  CaseStatus,
  DashboardData,
  ReconciliationCase,
} from "@/components/dashboard/types";

export function ExceptionsView({
  cases,
  search,
  filter,
  onSearch,
  onFilter,
  onSelect,
}: {
  cases: ReconciliationCase[];
  search: string;
  filter: "ALL" | CaseStatus;
  onSearch: (value: string) => void;
  onFilter: (value: "ALL" | CaseStatus) => void;
  onSelect: (item: ReconciliationCase) => void;
}) {
  const { t } = useLocale();

  return (
    <div className="view-stack">
      <PageHeading eyebrow={t("cases.eyebrow")} title={t("cases.title")} description={t("cases.description")} />
      <section className="panel">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={16} />
            <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={t("cases.search")} />
          </div>
          <div className="filter-tabs">
            {(["ALL", "OPEN", "IN_REVIEW", "RESOLVED"] as const).map((value) => (
              <button key={value} className={filter === value ? "is-active" : ""} onClick={() => onFilter(value)}>
                {humanize(value, t)}
              </button>
            ))}
          </div>
          <button className="button button--quiet"><SlidersHorizontal size={15} />{t("cases.filters")}</button>
        </div>
        <CasesTable cases={cases} onSelect={onSelect} />
      </section>
    </div>
  );
}

export function TransactionsView({ data }: { data: DashboardData }) {
  const { locale, t } = useLocale();

  return (
    <div className="view-stack">
      <PageHeading eyebrow={t("transactions.eyebrow")} title={t("transactions.title")} description={t("transactions.description")} />
      <section className="transaction-grid">
        <article className="panel">
          <div className="panel__header">
            <div><span className="panel__eyebrow">{t("transactions.provider")}</span><h2>{t("transactions.recentPayments")}</h2></div>
            <span className="count-badge">{data.payments.length}</span>
          </div>
          <div className="record-list">
            {data.payments.map((payment) => (
              <div className="record-row" key={payment.id}>
                <span className="record-row__icon"><CreditCard size={17} /></span>
                <div><strong>{payment.transactionId}</strong><small>{humanize(payment.provider, t)} · {payment.orderExternalId ?? t("transactions.withoutOrder")}</small></div>
                <div className="record-row__amount"><strong>{formatMoney(payment.amountCents, locale)}</strong><StatusPill status={payment.status} /></div>
              </div>
            ))}
          </div>
        </article>
        <article className="panel">
          <div className="panel__header">
            <div><span className="panel__eyebrow">{t("transactions.orderSystem")}</span><h2>{t("transactions.recentOrders")}</h2></div>
            <span className="count-badge">{data.orders.length}</span>
          </div>
          <div className="record-list">
            {data.orders.map((order) => (
              <div className="record-row" key={order.id}>
                <span className="record-row__icon record-row__icon--order"><ShoppingBag size={17} /></span>
                <div><strong>{order.externalId}</strong><small>{order.customerName} · {formatDate(order.createdAt, locale)}</small></div>
                <div className="record-row__amount"><strong>{formatMoney(order.amountCents, locale)}</strong><StatusPill status={order.status} /></div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

export function AuditView({
  logs,
  retentionDays,
}: {
  logs: AuditLog[];
  retentionDays: number;
}) {
  const { t } = useLocale();

  return (
    <div className="view-stack">
      <PageHeading eyebrow={t("audit.eyebrow")} title={t("audit.title")} description={t("audit.description")} />
      <section className="audit-layout">
        <article className="panel audit-stream">
          <div className="panel__header"><div><span className="panel__eyebrow">{t("audit.recentEvents")}</span><h2>{t("audit.recordedEvents")}</h2></div></div>
          <div className="audit-timeline">{logs.map((log) => <ActivityItem key={log.id} log={log} expanded />)}</div>
        </article>
        <aside className="panel audit-policy">
          <div className="audit-policy__icon"><Database size={21} /></div>
          <h2>{t("audit.retention")}</h2>
          <p>{t("audit.retentionDescription", { days: retentionDays })}</p>
          <ul>
            <li><CheckCircle2 size={15} />{t("audit.actorTime")}</li>
            <li><CheckCircle2 size={15} />{t("audit.stateChange")}</li>
            <li><CheckCircle2 size={15} />{t("audit.tenantAccess")}</li>
          </ul>
        </aside>
      </section>
    </div>
  );
}

function ActivityItem({ log, expanded = false }: { log: AuditLog; expanded?: boolean }) {
  const { locale, t } = useLocale();
  const icon = log.action.includes("RECONCILIATION")
    ? <GitMerge size={15} />
    : log.action.includes("WEBHOOK")
      ? <Webhook size={15} />
      : log.action.includes("CASE")
        ? <AlertTriangle size={15} />
        : <Activity size={15} />;

  return (
    <div className={`activity-item ${expanded ? "activity-item--expanded" : ""}`}>
      <span className="activity-item__icon">{icon}</span>
      <div>
        <strong>{localizedAuditSummary(log, t)}</strong>
        <p>{log.actor?.name ?? t("audit.systemActor")} · {humanize(log.action, t)}</p>
        {expanded && log.metadata && <code>{JSON.stringify(log.metadata)}</code>}
      </div>
      <time dateTime={log.createdAt}>{relativeTime(log.createdAt, locale)}</time>
    </div>
  );
}
