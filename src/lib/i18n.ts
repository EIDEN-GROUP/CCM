import { en, type Messages } from "@/messages/en";
import { fr } from "@/messages/fr";
import { ar } from "@/messages/ar";

export const LOCALES = ["en", "fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "ccm_locale";

export const MESSAGES: Record<Locale, Messages> = { en, fr, ar };

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  ar: "العربية",
};

/** Locales that render right-to-left. */
export const RTL_LOCALES: readonly Locale[] = ["ar"];

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function directionFor(locale: Locale): "ltr" | "rtl" {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}

/**
 * BCP-47 tag used for `Intl` formatting.
 *
 * The public site serves `fr`, `en`, `en-US` and `ar`. The CCM interface
 * ships three locales; `en` covers the English experience and `ar` is the
 * right-to-left variant.
 */
export const INTL_LOCALES: Record<Locale, string> = {
  en: "en-GB",
  fr: "fr-MA",
  ar: "ar-MA",
};

export function intlLocale(locale: Locale): string {
  return INTL_LOCALES[locale] ?? INTL_LOCALES[DEFAULT_LOCALE];
}

/**
 * Every dotted path into the message tree.
 *
 * Typing the translator's argument with this union means a typo like
 * `t("nav.oversight")` is a compile error, not an "undefined" rendered into
 * the interface.
 */
export type MessagePath<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string
        ? `${K}`
        : `${K}.${MessagePath<T[K]>}`;
    }[keyof T & string];

export type MessagePathRoot = MessagePath<Messages>;

function lookup(messages: Messages, path: string): string | undefined {
  const segments = path.split(".");
  let current: unknown = messages;
  for (const segment of segments) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" ? current : undefined;
}

/**
 * Create a translator bound to a locale.
 *
 * A missing key returns the key itself so the gap is visible in the UI
 * rather than rendering an empty element.
 */
export function createTranslator(locale: Locale) {
  const messages = MESSAGES[locale];
  return function t(path: MessagePathRoot): string {
    return lookup(messages, path) ?? path;
  };
}

export type Translator = ReturnType<typeof createTranslator>;

/** Placeholder substitution: `t("launcher.results", { count: 3 })`. */
export function formatMessage(
  template: string,
  values?: Record<string, string | number>,
): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}
