import { cookies } from "next/headers";
import {
  LOCALE_COOKIE,
  DEFAULT_LOCALE,
  createTranslator,
  isLocale,
  type Locale,
  type Translator,
} from "@/lib/i18n";

/**
 * Server-only locale resolution.
 *
 * Kept apart from `src/lib/i18n.ts` because that module is imported by
 * client components, and `next/headers` is server-only.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * A translator bound to the signed-in person's locale, for a server
 * component.
 *
 * The client components get theirs from `useI18n()`. A server component
 * cannot use a hook, so it reads the cookie and builds the translator here.
 * Both paths go through `createTranslator`, so they cannot disagree about
 * which key a string comes from.
 */
export async function getTranslator(): Promise<Translator> {
  return createTranslator(await getLocale());
}
