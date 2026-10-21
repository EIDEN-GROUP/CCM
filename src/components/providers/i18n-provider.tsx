"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  createTranslator,
  directionFor,
  intlLocale,
  type Locale,
  type MessagePathRoot,
  type Translator,
} from "@/lib/i18n";

interface I18nContextValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  intlLocale: string;
  t: Translator;
  /**
   * Translate and interpolate placeholders in one call.
   * `t("launcher.results", { count: 3 })`
   */
  tp: (
    path: MessagePathRoot,
    values?: Record<string, string | number>,
  ) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value = useMemo<I18nContextValue>(() => {
    const t = createTranslator(locale);
    return {
      locale,
      dir: directionFor(locale),
      intlLocale: intlLocale(locale),
      t,
      tp: (path, values) => {
        const template = t(path);
        if (!values) return template;
        return template.replace(/\{(\w+)\}/g, (match, key: string) => {
          const replacement = values[key];
          return replacement === undefined ? match : String(replacement);
        });
      },
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside <I18nProvider>");
  }
  return context;
}

/**
 * Convenience hook for components that only need the translator.
 */
export function useTranslate(): Translator {
  return useI18n().t;
}
