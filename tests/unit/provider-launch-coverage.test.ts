import { describe, expect, it } from "vitest";
import { PROVIDER_HOSTS } from "../../apps/ccm-browser-bridge/lib/allowlist.js";
import { CREDENTIAL_LOGIN_URLS } from "@/lib/launch/credential-hosts";
import { assertAllowedLaunchUrl, buildLaunchTarget } from "@/lib/launch/urls";
import { PROVIDER_LIST, type AccountIdentifiers, type ProviderKey } from "@/providers/registry";

const identifiers: AccountIdentifiers = {
  google_ads: { customerId: "1234567890", managerCustomerId: "0987654321" },
  ga4: { propertyId: "123456789" },
  gsc: { propertyUrl: "https://www.example.com/" },
  gtm: { containerId: "GTM-ABC123" },
  youtube: { channelId: "UC123456789" },
  gmail: { mailboxEmail: "clinic@example.com" },
  meta: { pageId: "123456789", username: "clinic" },
  tiktok: { username: "clinic" },
  linkedin: { pageSlug: "clinic" },
  ahrefs: { projectId: "project-1" },
  clarity: { projectId: "project-1" },
};

describe("provider launch coverage", () => {
  it("keeps every server provider within the extension host allowlist", () => {
    for (const provider of PROVIDER_LIST) {
      const extensionHosts = PROVIDER_HOSTS[provider.key];
      expect(extensionHosts, provider.key).toBeTruthy();
      for (const host of extensionHosts ?? []) {
        expect(provider.hosts, `${provider.key}: ${host}`).toContain(host);
      }
    }
  });

  it("builds at least one valid account destination for every provider", () => {
    for (const provider of PROVIDER_LIST) {
      const target = buildLaunchTarget(provider.key, identifiers, "account");
      expect(target.url, provider.key).toBeTruthy();
      expect(() => assertAllowedLaunchUrl(provider.key, target.url!)).not.toThrow();
      expect(PROVIDER_HOSTS[provider.key]).toContain(new URL(target.url!).hostname);

      const management = buildLaunchTarget(provider.key, identifiers, "management");
      if (management.url) {
        expect(() => assertAllowedLaunchUrl(provider.key, management.url!)).not.toThrow();
        expect(PROVIDER_HOSTS[provider.key]).toContain(new URL(management.url).hostname);
      }
    }
  });

  it("keeps every saved-login URL within its provider launch allowlist", () => {
    for (const [key, url] of Object.entries(CREDENTIAL_LOGIN_URLS)) {
      expect(() => assertAllowedLaunchUrl(key as ProviderKey, url!)).not.toThrow();
    }
  });
});
