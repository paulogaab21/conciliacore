"use client";

import { LanguageSwitcher } from "@/components/language-switcher";
import { LoginForm } from "@/components/login-form";
import { Logo } from "@/components/logo";
import { useLocale } from "@/i18n/locale-provider";

export function LoginPageContent() {
  const { t } = useLocale();
  const [titleFirstLine, titleSecondLine] = t("login.heroTitle").split("\n");

  return (
    <main className="login-page">
      <header className="login-console-header">
        <Logo inverse />
        <div>
          <LanguageSwitcher compact />
          <span className="login-console-status"><i /> {t("login.technicalDemo")}</span>
          <span>{t("login.syntheticData")}</span>
        </div>
      </header>

      <div className="login-console-body">
        <section className="login-story">
          <div className="login-story__content">
            <span className="login-console-path">{t("login.category")}</span>
            <h1>{titleFirstLine}<br />{titleSecondLine}</h1>
            <p>{t("login.heroDescription")}</p>

            <ol className="flow-preview" aria-label={t("login.flowLabel")}>
              <li className="flow-preview__item">
                <span>01</span>
                <div><strong>{t("login.flow.webhook")}</strong><small>{t("login.flow.webhookDetail")}</small></div>
              </li>
              <li className="flow-preview__item">
                <span>02</span>
                <div><strong>{t("login.flow.reconciliation")}</strong><small>{t("login.flow.reconciliationDetail")}</small></div>
              </li>
              <li className="flow-preview__item">
                <span>03</span>
                <div><strong>{t("login.flow.exception")}</strong><small>{t("login.flow.exceptionDetail")}</small></div>
              </li>
            </ol>
          </div>

          <div className="login-story__proof">
            <span className="proof-card__dot" />
            <p>{t("login.proof")}</p>
          </div>
        </section>

        <section className="login-panel">
          <div className="login-panel__content">
            <span className="login-console-path">{t("login.demo")}</span>
            <h2>{t("login.title")}</h2>
            <p>{t("login.subtitle")}</p>
            <LoginForm />
          </div>
          <p className="login-panel__footer">{t("login.footer")}</p>
        </section>
      </div>
    </main>
  );
}
