"use client";

import { ArrowRight, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/i18n/locale-provider";
import type { MessageKey } from "@/i18n/messages";
import { PageHeading } from "@/components/dashboard/shared";

type GuaranteeId = "ingestion" | "idempotency" | "worker" | "tenant" | "decision" | "limits";

const guaranteeItems: Array<{
  id: GuaranteeId;
  index: string;
  eyebrowKey: MessageKey;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  rules: Array<{ labelKey: MessageKey; valueKey: MessageKey }>;
  evidence: string;
}> = [
  {
    id: "ingestion",
    index: "01",
    eyebrowKey: "guarantees.ingestion.eyebrow",
    titleKey: "guarantees.ingestion.title",
    descriptionKey: "guarantees.ingestion.description",
    rules: [
      { labelKey: "guarantees.ingestion.rule1Label", valueKey: "guarantees.ingestion.rule1Value" },
      { labelKey: "guarantees.ingestion.rule2Label", valueKey: "guarantees.ingestion.rule2Value" },
      { labelKey: "guarantees.ingestion.rule3Label", valueKey: "guarantees.ingestion.rule3Value" },
    ],
    evidence: "crypto.ts · webhooks/payments/[organizationSlug]/route.ts",
  },
  {
    id: "idempotency",
    index: "02",
    eyebrowKey: "guarantees.idempotency.eyebrow",
    titleKey: "guarantees.idempotency.title",
    descriptionKey: "guarantees.idempotency.description",
    rules: [
      { labelKey: "guarantees.idempotency.rule1Label", valueKey: "guarantees.idempotency.rule1Value" },
      { labelKey: "guarantees.idempotency.rule2Label", valueKey: "guarantees.idempotency.rule2Value" },
      { labelKey: "guarantees.idempotency.rule3Label", valueKey: "guarantees.idempotency.rule3Value" },
    ],
    evidence: "schema.prisma · webhook route",
  },
  {
    id: "worker",
    index: "03",
    eyebrowKey: "guarantees.worker.eyebrow",
    titleKey: "guarantees.worker.title",
    descriptionKey: "guarantees.worker.description",
    rules: [
      { labelKey: "guarantees.worker.rule1Label", valueKey: "guarantees.worker.rule1Value" },
      { labelKey: "guarantees.worker.rule2Label", valueKey: "guarantees.worker.rule2Value" },
      { labelKey: "guarantees.worker.rule3Label", valueKey: "guarantees.worker.rule3Value" },
    ],
    evidence: "outbox.ts · worker.ts",
  },
  {
    id: "tenant",
    index: "04",
    eyebrowKey: "guarantees.tenant.eyebrow",
    titleKey: "guarantees.tenant.title",
    descriptionKey: "guarantees.tenant.description",
    rules: [
      { labelKey: "guarantees.tenant.rule1Label", valueKey: "guarantees.tenant.rule1Value" },
      { labelKey: "guarantees.tenant.rule2Label", valueKey: "guarantees.tenant.rule2Value" },
      { labelKey: "guarantees.tenant.rule3Label", valueKey: "guarantees.tenant.rule3Value" },
    ],
    evidence: "auth.ts · api.ts · permissions.ts",
  },
  {
    id: "decision",
    index: "05",
    eyebrowKey: "guarantees.decision.eyebrow",
    titleKey: "guarantees.decision.title",
    descriptionKey: "guarantees.decision.description",
    rules: [
      { labelKey: "guarantees.decision.rule1Label", valueKey: "guarantees.decision.rule1Value" },
      { labelKey: "guarantees.decision.rule2Label", valueKey: "guarantees.decision.rule2Value" },
      { labelKey: "guarantees.decision.rule3Label", valueKey: "guarantees.decision.rule3Value" },
    ],
    evidence: "reconciliation.ts · reconciliation-service.ts · cases/[id]/resolve",
  },
  {
    id: "limits",
    index: "06",
    eyebrowKey: "guarantees.limits.eyebrow",
    titleKey: "guarantees.limits.title",
    descriptionKey: "guarantees.limits.description",
    rules: [
      { labelKey: "guarantees.limits.rule1Label", valueKey: "guarantees.limits.rule1Value" },
      { labelKey: "guarantees.limits.rule2Label", valueKey: "guarantees.limits.rule2Value" },
      { labelKey: "guarantees.limits.rule3Label", valueKey: "guarantees.limits.rule3Value" },
    ],
    evidence: "webhook route · outbox.ts · schema.prisma",
  },
];

type GuaranteeNode = "api" | "database" | "outbox" | "worker" | "engine" | "case";

const guaranteeFlowNodes: Array<{
  id: GuaranteeNode;
  label?: string;
  labelKey?: MessageKey;
}> = [
  { id: "api", label: "API" },
  { id: "database", labelKey: "guarantees.node.database" },
  { id: "outbox", label: "Outbox" },
  { id: "worker", label: "Worker" },
  { id: "engine", labelKey: "guarantees.node.engine" },
  { id: "case", labelKey: "guarantees.node.case" },
];

const guaranteeFlowFocus: Record<GuaranteeId, GuaranteeNode[]> = {
  ingestion: ["api", "database"],
  idempotency: ["database", "outbox"],
  worker: ["outbox", "worker"],
  tenant: ["api", "database"],
  decision: ["engine", "case"],
  limits: ["api", "database", "outbox", "worker"],
};

export function GuaranteesView() {
  const { t } = useLocale();
  const [selected, setSelected] = useState<GuaranteeId>("idempotency");
  const active = guaranteeItems.find((item) => item.id === selected) ?? guaranteeItems[0];
  const nodeLabel = (node: (typeof guaranteeFlowNodes)[number]) =>
    node.labelKey ? t(node.labelKey) : node.label ?? node.id;

  return (
    <div className="view-stack guarantees-view">
      <PageHeading
        eyebrow={t("guarantees.eyebrow")}
        title={t("guarantees.title")}
        description={t("guarantees.description")}
      />

      <section className="guarantee-stage" aria-live="polite">
        <nav className="guarantee-index" aria-label={t("guarantees.navigation")}>
          {guaranteeItems.map((item) => (
            <button
              key={item.id}
              className={selected === item.id ? "is-active" : ""}
              onClick={() => setSelected(item.id)}
            >
              <span>{item.index}</span>
              <strong>{t(item.eyebrowKey)}</strong>
              <ArrowRight size={16} />
            </button>
          ))}
        </nav>

        <article className="guarantee-detail" key={active.id}>
          <div className="guarantee-detail__index">{active.index}</div>
          <span className="guarantee-detail__eyebrow">{t(active.eyebrowKey)}</span>
          <h2>{t(active.titleKey)}</h2>
          <p>{t(active.descriptionKey)}</p>
          <div
            className="guarantee-flow"
            aria-label={t("guarantees.relatedStages", {
              stages: guaranteeFlowNodes
                .filter((node) => guaranteeFlowFocus[active.id].includes(node.id))
                .map(nodeLabel)
                .join(", "),
            })}
          >
            <span className="guarantee-flow__label">{t("guarantees.executionPath")}</span>
            <div className="guarantee-flow__track">
              {guaranteeFlowNodes.map((node, index) => {
                const isActive = guaranteeFlowFocus[active.id].includes(node.id);
                return (
                  <div className="guarantee-flow__step" key={node.id}>
                    <span className={`guarantee-flow__node ${isActive ? "is-active" : ""}`}>
                      <i />{nodeLabel(node)}
                    </span>
                    {index < guaranteeFlowNodes.length - 1 && <b aria-hidden="true">→</b>}
                  </div>
                );
              })}
            </div>
          </div>
          <dl>
            {active.rules.map((rule) => (
              <div key={rule.labelKey}>
                <dt>{t(rule.labelKey)}</dt>
                <dd>{t(rule.valueKey)}</dd>
              </div>
            ))}
          </dl>
          <footer><span>{t("guarantees.repositoryEvidence")}</span><code>{active.evidence}</code></footer>
        </article>
      </section>

      <p className="guarantee-note">
        <ShieldCheck size={16} /> {t("guarantees.note")}
      </p>
    </div>
  );
}
