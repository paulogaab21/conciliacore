"use client";

import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import {
  formatMoney,
  humanize,
  initials,
  localizedCaseTitle,
  SeverityPill,
  StatusPill,
} from "@/components/dashboard/shared";
import type { ReconciliationCase } from "@/components/dashboard/types";

export function CasesTable({
  cases,
  onSelect,
}: {
  cases: ReconciliationCase[];
  onSelect: (item: ReconciliationCase) => void;
}) {
  const { locale, t } = useLocale();
  if (!cases.length) {
    return (
      <div className="table-empty">
        <CheckCircle2 size={24} />
        <strong>{t("cases.emptyTitle")}</strong>
        <span>{t("cases.emptyDescription")}</span>
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>{t("cases.column.exception")}</th>
            <th>{t("cases.column.reference")}</th>
            <th>{t("cases.column.difference")}</th>
            <th>{t("cases.column.severity")}</th>
            <th>{t("cases.column.status")}</th>
            <th>{t("cases.column.owner")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {cases.map((item) => (
            <tr key={item.id} onClick={() => onSelect(item)}>
              <td>
                <div className="case-title">
                  <span className={`case-title__icon case-title__icon--${item.severity.toLowerCase()}`}>
                    <AlertTriangle size={16} />
                  </span>
                  <span>
                    <strong>{localizedCaseTitle(item, t)}</strong>
                    <small>{humanize(item.type, t)}</small>
                  </span>
                </div>
              </td>
              <td>
                <strong className="mono-ref">{item.order?.externalId ?? item.payment?.transactionId ?? "—"}</strong>
                <small className="table-subtext">{item.payment?.provider ? humanize(item.payment.provider, t) : t("cases.order")}</small>
              </td>
              <td className={item.differenceCents ? "amount-negative" : ""}>
                {item.differenceCents ? formatMoney(item.differenceCents, locale) : "—"}
              </td>
              <td><SeverityPill severity={item.severity} /></td>
              <td><StatusPill status={item.status} /></td>
              <td>
                {item.assignedTo ? (
                  <span className="assignee"><i>{initials(item.assignedTo.name)}</i>{item.assignedTo.name.split(" ")[0]}</span>
                ) : (
                  <span className="unassigned">{t("cases.unassigned")}</span>
                )}
              </td>
              <td>
                <button className="icon-button icon-button--ghost" aria-label={t("cases.open", { title: localizedCaseTitle(item, t) })}>
                  <ArrowRight size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
