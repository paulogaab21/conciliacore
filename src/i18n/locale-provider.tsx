"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  dictionaries,
  localeCookieName,
  type Locale,
  type MessageKey,
} from "@/i18n/messages";

type Replacements = Record<string, string | number>;

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, replacements?: Replacements) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function interpolate(message: string, replacements?: Replacements): string {
  if (!replacements) return message;

  return message.replace(/\{(\w+)\}/g, (placeholder, key: string) => {
    const value = replacements[key];
    return value === undefined ? placeholder : String(value);
  });
}

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, updateLocale] = useState<Locale>(initialLocale);

  const setLocale = useCallback((nextLocale: Locale) => {
    updateLocale(nextLocale);
    document.documentElement.lang = nextLocale;
    document.cookie = `${localeCookieName}=${encodeURIComponent(nextLocale)}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const t = useCallback(
    (key: MessageKey, replacements?: Replacements) =>
      interpolate(dictionaries[locale][key], replacements),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used inside LocaleProvider");
  }
  return context;
}
