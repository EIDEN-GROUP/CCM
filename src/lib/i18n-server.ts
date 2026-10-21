import { cookies } from "next/headers";
import {
  LOCALE_COOKIE,
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
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
