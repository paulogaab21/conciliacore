"use client";

import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  FlaskConical,
  GitMerge,
  LoaderCircle,
  Play,
  ShieldCheck,
  Webhook,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { CasesTable } from "@/components/dashboard/cases-table";
import { formatMoney, humanize, PageHeading } from "@/components/dashboard/shared";
import type { DashboardData, ReconciliationCase } from "@/components/dashboard/types";

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = "mint",
}: {
  label: string;
  value: string;
  detail: ReactNode;
  icon: ReactNode;
  tone?: "mint" | "blue" | "amber" | "violet";
}) {
  return (
    <article className="metric-card">
      <div className={`metric-card__icon metric-card__icon--${tone}`}>{icon}</div>
      <div className="metric-card__copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

export function Overview({
  data,
  actionLoading,
  onRun,
  onSimulate,
  onCaseSelect,
  onViewAll,
}: {
  data: DashboardData;
  actionLoading: string | null;
  onRun: () => void;
  onSimulate: (scenario: "amount_mismatch" | "unmatched_payment" | "duplicate_payment") => void;
  onCaseSelect: (item: ReconciliationCase) => void;
  onViewAll: () => void;
}) {
  const { locale, t } = useLocale();
  const [section, setSection] = useState<"summary" | "exceptions" | "reliability">("summary");
  const maxVolume = Math.max(...data.dailyVolume.map((item) => item.amountCents), 1);
  const totalProviderVolume = data.providerBreakdown.reduce((sum, item) => sum + item.amountCents, 0);
  const openCases = data.cases.filter((item) => item.status === "OPEN" || item.status === "IN_REVIEW");
  const criticalLabel = t("overview.criticalQueue", {
    count: data.metrics.criticalCases,
    label: t(
      data.metrics.criticalCases === 1
        ? "overview.criticalSingular"
        : "overview.criticalPlural",
    ),
  });
  const duplicateLabel = t(
    data.metrics.duplicateDeliveries === 1
      ? "overview.duplicateDiscardedSingular"
      : "overview.duplicateDiscardedPlural",
    { count: data.metrics.duplicateDeliveries },
  );

  return (
    <div className="view-stack overview-view">
      <PageHeading
        eyebrow={t("overview.eyebrow")}
        title={t("overview.title")}
        description={t("overview.description", {
          count: data.latestRun?.paymentsScanned ?? data.payments.length,
          organization: data.organization.name,
        })}
        actions={
          <>
            <details className="action-menu">
              <summary className="button button--secondary"><FlaskConical size={16} />{t("overview.simulateIncident")}<ChevronDown size={15} /></summary>
              <div className="action-menu__popover">
                <span>{t("overview.scenarioPrompt")}</span>
                <button onClick={() => onSimulate("amount_mismatch")} disabled={!!actionLoading}><CircleDollarSign size={16} /><span><strong>{t("overview.amountMismatch")}</strong><small>{t("overview.amountMismatchDetail")}</small></span></button>
                <button onClick={() => onSimulate("unmatched_payment")} disabled={!!actionLoading}><GitMerge size={16} /><span><strong>{t("overview.unmatchedPayment")}</strong><small>{t("overview.unmatchedPaymentDetail")}</small></span></button>
                <button onClick={() => onSimulate("duplicate_payment")} disabled={!!actionLoading}><CreditCard size={16} /><span><strong>{t("overview.duplicatePayment")}</strong><small>{t("overview.duplicatePaymentDetail")}</small></span></button>
              </div>
            </details>
            <button className="button button--primary" onClick={onRun} disabled={actionLoading === "reconcile"}>
              {actionLoading === "reconcile" ? <LoaderCircle className="spin" size={16} /> : <Play size={16} fill="currentColor" />}
              {t("overview.run")}
            </button>
          </>
        }
      />

      <section className="overview-hero" aria-label={t("overview.currentResult")}>
        <div className="overview-hero__primary">
          <span className="overview-hero__label"><i /> {t("overview.latestRun")}</span>
          <div className="overview-hero__value"><strong>{data.metrics.reconciliationRate.toFixed(1)}</strong><span>%</span></div>
          <h2>{t("overview.reconciledPayments")}</h2>
          <p>{t("overview.ruleExplanation")}</p>
          <div className="overview-hero__meta">
            <span><strong>{data.latestRun?.durationMs ?? 0} ms</strong> {t("overview.execution")}</span>
            <span><strong>{data.latestRun?.matchedCount ?? 0}</strong> {t("overview.exactMatches")}</span>
          </div>
        </div>

        <div className="metrics-grid metrics-grid--compact" aria-label={t("overview.mainMetrics")}>
          <MetricCard
            label={t("overview.processedVolume")}
            value={formatMoney(data.metrics.totalProcessedCents, locale)}
            detail={<>{t("overview.recentTransactions", { count: data.payments.length })}</>}
            icon={<CircleDollarSign size={19} />}
            tone="mint"
          />
          <MetricCard
            label={t("overview.openExceptions")}
            value={String(data.metrics.openCases).padStart(2, "0")}
            detail={<span className="detail-critical">{criticalLabel}</span>}
            icon={<AlertTriangle size={19} />}
            tone="amber"
          />
          <MetricCard
            label={t("overview.webhookDelivery")}
            value={`${data.metrics.webhookSuccessRate.toFixed(1)}%`}
            detail={<>{duplicateLabel}</>}
            icon={<Webhook size={19} />}
            tone="blue"
          />
        </div>
      </section>

      <nav className="overview-tabs" aria-label={t("overview.tabsLabel")}>
        <button className={section === "summary" ? "is-active" : ""} onClick={() => setSection("summary")}>{t("overview.volume")}</button>
        <button className={section === "exceptions" ? "is-active" : ""} onClick={() => setSection("exceptions")}>{t("overview.exceptions")} <span>{data.metrics.openCases}</span></button>
        <button className={section === "reliability" ? "is-active" : ""} onClick={() => setSection("reliability")}>{t("overview.reliability")}</button>
      </nav>

      {section === "summary" && (
        <section className="overview-detail" data-overview-section="summary">
          <article className="panel panel--chart">
            <div className="panel__header">
              <div><span className="panel__eyebrow">{t("overview.lastSevenDays")}</span><h2>{t("overview.paymentsReceived")}</h2></div>
              <div className="legend"><i className="legend__dot legend__dot--mint" />{t("overview.processedVolume")}</div>
            </div>
            <div className="bar-chart" aria-label={t("overview.paymentVolumeLabel")}>
              <div className="bar-chart__scale"><span>{formatMoney(maxVolume, locale)}</span><span>{formatMoney(maxVolume / 2, locale)}</span><span>{formatMoney(0, locale)}</span></div>
              <div className="bar-chart__plot">
                {data.dailyVolume.map((item, index) => (
                  <div className="bar-chart__column" key={item.date}>
                    <div className="bar-chart__value" style={{ height: `${Math.max(6, (item.amountCents / maxVolume) * 154)}px` }}>
                      {item.amountCents > 0 && <span>{formatMoney(item.amountCents, locale)}</span>}
                    </div>
                    <small className={index === data.dailyVolume.length - 1 ? "is-today" : ""}>
                      {new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(item.date)).replace(".", "")}
                    </small>
                  </div>
                ))}
              </div>
            </div>
            <div className="chart-summary">
              <span><strong>{data.latestRun?.paymentsScanned ?? data.payments.length}</strong> {t("overview.paymentsAnalyzed")}</span>
              <span><strong>{data.latestRun?.durationMs ?? 0}ms</strong> {t("overview.latestRunDuration")}</span>
              <span><strong>{data.latestRun?.matchedCount ?? 0}</strong> {t("overview.exactMatches")}</span>
            </div>
          </article>
        </section>
      )}

      {section === "exceptions" && (
        <section className="panel cases-panel overview-detail" data-overview-section="exceptions">
          <div className="panel__header">
            <div><span className="panel__eyebrow">{t("overview.exceptions")}</span><h2>{t("overview.openAndReview")}</h2></div>
            <button className="text-button" onClick={onViewAll}>{t("overview.openFullQueue")} <ArrowRight size={15} /></button>
          </div>
          <CasesTable cases={openCases.slice(0, 4)} onSelect={onCaseSelect} />
        </section>
      )}

      {section === "reliability" && (
        <section className="reliability-grid overview-detail" data-overview-section="reliability">
          <article className="panel health-panel">
            <div className="panel__header"><div><span className="panel__eyebrow">{t("overview.byProvider")}</span><h2>{t("overview.processedDistribution")}</h2></div></div>
            <div className="provider-list">
              {data.providerBreakdown.map((item, index) => {
                const share = totalProviderVolume ? (item.amountCents / totalProviderVolume) * 100 : 0;
                return (
                  <div className="provider-row" key={item.provider}>
                    <span className={`provider-logo provider-logo--${index + 1}`}>{item.provider.slice(0, 2).toUpperCase()}</span>
                    <div><span><strong>{humanize(item.provider, t)}</strong><small>{t("overview.paymentCount", { count: item.count })}</small></span><div className="progress"><i style={{ width: `${share}%` }} /></div></div>
                    <b>{share.toFixed(0)}%</b>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="panel reliability-panel">
            <div className="reliability-panel__icon"><ShieldCheck size={22} /></div>
            <span className="panel__eyebrow">{t("overview.idempotencyControl")}</span>
            <h2>{t("overview.duplicateBeforeReconciliation")}</h2>
            <p>{t("overview.idempotencyExplanation")}</p>
            <div className="reliability-panel__stats">
              <span><strong>{data.metrics.duplicateDeliveries}</strong> {t(data.metrics.duplicateDeliveries === 1 ? "overview.discardedEventSingular" : "overview.discardedEventPlural")}</span>
              <span><strong>5</strong> {t("overview.maxOutboxAttempts")}</span>
            </div>
          </article>
        </section>
      )}
    </div>
  );
}
