import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n";
const bodySchema = z.object({
  locale: z.string(),
});

/**
 * Persist the interface language in a cookie.
 *
 * The locale is a presentation preference, not a security decision, so it is
 * stored in a first-party cookie and re-read on the next request.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isLocale(parsed.data.locale)) {
    return NextResponse.json({ error: "Unsupported locale" }, { status: 400 });
  }

  const store = await cookies();
  store.set(LOCALE_COOKIE, parsed.data.locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ locale: parsed.data.locale });
}
