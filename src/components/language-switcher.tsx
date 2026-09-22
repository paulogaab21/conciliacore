"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "@/i18n/locale-provider";
import type { Locale } from "@/i18n/messages";

const options: Array<{ locale: Locale; label: string }> = [
  { locale: "pt-BR", label: "PT" },
  { locale: "en", label: "EN" },
];

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { locale, setLocale, t } = useLocale();

  function selectLocale(nextLocale: Locale) {
    if (nextLocale === locale) return;
    setLocale(nextLocale);
    router.refresh();
  }

  return (
    <div
      className={`language-switcher ${compact ? "language-switcher--compact" : ""}`}
      role="group"
      aria-label={t("language.change")}
      title={t("language.label")}
    >
      {options.map((option) => (
        <button
          key={option.locale}
          type="button"
          className={locale === option.locale ? "is-active" : ""}
          onClick={() => selectLocale(option.locale)}
          aria-pressed={locale === option.locale}
          lang={option.locale}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
