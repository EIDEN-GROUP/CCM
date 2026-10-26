import type { ProviderKey } from "@/providers/registry";

/** Exact, fixed app entry points for accounts created with a saved browser login. */
export const CREDENTIAL_LOGIN_URLS: Partial<Record<ProviderKey, string>> = {
  google_ads: "https://ads.google.com/",
  ga4: "https://analytics.google.com/analytics/web/",
  gsc: "https://search.google.com/search-console/",
  gtm: "https://tagmanager.google.com/",
  youtube: "https://studio.youtube.com/",
  gmail: "https://mail.google.com/mail/u/0/#inbox",
  meta: "https://business.facebook.com/latest/home",
  instagram: "https://www.instagram.com/",
  tiktok: "https://www.tiktok.com/login",
  linkedin: "https://www.linkedin.com/",
  ahrefs: "https://app.ahrefs.com/",
  clarity: "https://clarity.microsoft.com/",
};

/** Exact login origins where the bridge may fill saved account credentials. */
export const CREDENTIAL_LOGIN_HOSTS: Partial<Record<ProviderKey, readonly string[]>> = {
  google_ads: ["accounts.google.com"],
  ga4: ["accounts.google.com"],
  gsc: ["accounts.google.com"],
  gtm: ["accounts.google.com"],
  youtube: ["accounts.google.com"],
  gmail: ["accounts.google.com"],
  meta: ["www.facebook.com", "business.facebook.com"],
  instagram: ["www.instagram.com", "www.facebook.com"],
  tiktok: ["www.tiktok.com"],
  linkedin: ["www.linkedin.com"],
  ahrefs: ["app.ahrefs.com"],
  clarity: ["clarity.microsoft.com", "login.microsoftonline.com"],
};

export function providerSupportsCredentialFill(provider: ProviderKey): boolean {
  return Boolean(CREDENTIAL_LOGIN_HOSTS[provider]?.length && CREDENTIAL_LOGIN_URLS[provider]);
}
