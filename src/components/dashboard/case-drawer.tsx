"use client";

import { CheckCircle2, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Session } from "@/contracts/session";
import { useLocale } from "@/i18n/locale-provider";
import {
  formatDate,
  formatMoney,
  humanize,
  initials,
  localizedCaseDescription,
  localizedCaseTitle,
  relativeTime,
  SeverityPill,
  StatusPill,
} from "@/components/dashboard/shared";
import type { ReconciliationCase } from "@/components/dashboard/types";

export function CaseDrawer({
  item,
  session,
  busy,
  onClose,
  onChanged,
  onBusy,
  onError,
}: {
  item: ReconciliationCase;
  session: Session;
  busy: boolean;
  onClose: () => void;
  onChanged: (message: string) => Promise<void>;
  onBusy: (busy: boolean) => void;
  onError: (message: string) => void;
}) {
  const { locale, t } = useLocale();
  const [resolution, setResolution] = useState("");
  const canManage = session.role === "ADMIN" || session.role === "ANALYST";

  async function updateCase(
    url: string,
    method: "PATCH" | "POST",
    body: Record<string, unknown>,
    message: string,
  ) {
    onBusy(true);
    try {
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(t("cases.updateError"));
      await onChanged(message);
    } catch (error) {
      onError(error instanceof Error ? error.message : t("cases.updateError"));
    } finally {
      onBusy(false);
    }
  }

  function handleResolve(event: FormEvent) {
    event.preventDefault();
    updateCase(`/api/cases/${item.id}/resolve`, "POST", { resolution }, t("cases.resolvedSuccess"));
  }

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={t("cases.drawerLabel")}>
      <button className="drawer-scrim" onClick={onClose} aria-label={t("cases.closeException")} />
      <aside className="case-drawer">
        <div className="case-drawer__header">
          <div><span className="eyebrow">{t("cases.drawerLabel")}</span><h2>{localizedCaseTitle(item, t)}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label={t("cases.close")}><X size={18} /></button>
        </div>
        <div className="case-drawer__body">
          <div className="case-meta">
            <SeverityPill severity={item.severity} />
            <StatusPill status={item.status} />
            <span>{t("cases.opened", { time: relativeTime(item.createdAt, locale) })}</span>
          </div>
          <p className="case-description">{localizedCaseDescription(item, t)}</p>

          <section className="drawer-section">
            <h3>{t("cases.financialContext")}</h3>
            <div className="context-grid">
              <div><span>{t("cases.order")}</span><strong>{item.order?.externalId ?? t("cases.notLinkedMasculine")}</strong></div>
              <div><span>{t("cases.transaction")}</span><strong>{item.payment?.transactionId ?? t("cases.notLinkedFeminine")}</strong></div>
              <div><span>{t("cases.orderAmount")}</span><strong>{item.order ? formatMoney(item.order.amountCents, locale) : "—"}</strong></div>
              <div><span>{t("cases.paymentAmount")}</span><strong>{item.payment ? formatMoney(item.payment.amountCents, locale) : "—"}</strong></div>
              <div className="context-grid__wide">
                <span>{t("cases.column.difference")}</span>
                <strong className={item.differenceCents ? "amount-negative" : ""}>
                  {item.differenceCents ? formatMoney(item.differenceCents, locale) : t("cases.noAmountDifference")}
                </strong>
              </div>
            </div>
          </section>

          <section className="drawer-section">
            <h3>{t("cases.ruleEvidence")}</h3>
            <div className="evidence-list">
              {Object.entries(item.evidence ?? {}).map(([key, value]) => (
                <div key={key}>
                  <span>{humanize(key, t)}</span>
                  <code>{Array.isArray(value) ? value.join(", ") : String(value ?? "—")}</code>
                </div>
              ))}
            </div>
          </section>

          <section className="drawer-section">
            <h3>{t("cases.owner")}</h3>
            <div className="owner-card">
              <span className="avatar">{item.assignedTo ? initials(item.assignedTo.name) : "—"}</span>
              <div>
                <strong>{item.assignedTo?.name ?? t("cases.unassigned")}</strong>
                <small>{item.assignedTo ? t("cases.investigating") : t("cases.noAnalyst")}</small>
              </div>
              {canManage && !item.assignedTo && (
                <button
                  disabled={busy}
                  onClick={() => updateCase(
                    `/api/cases/${item.id}`,
                    "PATCH",
                    { assignedToId: session.userId, status: "IN_REVIEW" },
                    t("cases.claimedSuccess"),
                  )}
                >
                  {t("cases.claim")}
                </button>
              )}
            </div>
          </section>

          {item.status === "RESOLVED" ? (
            <section className="resolution-card">
              <CheckCircle2 size={19} />
              <div>
                <strong>{t("cases.resolutionRecorded")}</strong>
                <p>{item.resolution}</p>
                <small>{item.resolvedAt ? formatDate(item.resolvedAt, locale) : ""}</small>
              </div>
            </section>
          ) : canManage ? (
            <form className="resolution-form" onSubmit={handleResolve}>
              <label>
                <span>{t("cases.resolutionNote")}</span>
                <textarea
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value)}
                  placeholder={t("cases.resolutionPlaceholder")}
                  minLength={10}
                  maxLength={500}
                  required
                />
              </label>
              <button className="button button--primary button--full" disabled={busy || resolution.trim().length < 10}>
                {busy ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />}
                {t("cases.resolve")}
              </button>
            </form>
          ) : (
            <div className="read-only-note"><ShieldCheck size={17} />{t("cases.auditorReadOnly")}</div>
          )}
        </div>
      </aside>
    </div>
  );
}
