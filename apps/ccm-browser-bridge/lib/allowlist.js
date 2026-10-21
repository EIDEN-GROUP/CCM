/**
 * Provider host allowlist.
 *
 * The extension keeps its own copy rather than trusting a host sent in a
 * message. This is the second half of the launch security model: the server
 * builds the URL, the extension independently decides whether the host is one
 * it is willing to open. Both must agree.
 *
 * Keep this list in step with `src/providers/registry.ts` in the main app.
 * Adding a provider means adding it in both places, deliberately.
 */
export const PROVIDER_HOSTS = {
  google_ads: ["ads.google.com", "adwords.google.com"],
  ga4: ["analytics.google.com"],
  gsc: ["search.google.com"],
  gtm: ["tagmanager.google.com"],
  youtube: ["studio.youtube.com", "www.youtube.com"],
  gmail: ["mail.google.com"],
  meta: [
    "www.facebook.com",
    "business.facebook.com",
    "graph.facebook.com",
  ],
  instagram: ["www.instagram.com", "graph.facebook.com"],
  linkedin: ["www.linkedin.com"],
  ahrefs: ["app.ahrefs.com", "docs.ahrefs.com"],
  clarity: ["clarity.microsoft.com"],
  pagespeed: ["pagespeed.web.dev", "www.googleapis.com"],
  uptime: ["www.google.com"],
};

/**
 * True when the host is exactly one of the allowlisted hosts for the
 * provider. Exact match only: a suffix or substring test would let
 * "evil-analytics.google.com" pass.
 */
export function isHostAllowed(providerKey, host) {
  const hosts = PROVIDER_HOSTS[providerKey];
  if (!hosts) return false;
  if (typeof host !== "string" || host.length === 0) return false;
  return hosts.includes(host.toLowerCase());
}

/** Every host the extension is willing to open. */
export function allAllowedHosts() {
  return new Set(Object.values(PROVIDER_HOSTS).flat());
}
