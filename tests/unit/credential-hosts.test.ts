import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CREDENTIAL_LOGIN_HOSTS,
  CREDENTIAL_LOGIN_URLS,
  providerSupportsCredentialFill,
} from "@/lib/launch/credential-hosts";
import { assertAllowedLaunchUrl } from "@/lib/launch/urls";

describe("saved-login host permissions", () => {
  it("keeps every credential-fill origin in the extension's exact host permissions", () => {
    const manifest = JSON.parse(
      readFileSync("apps/ccm-browser-bridge/manifest.json", "utf8"),
    ) as { permissions: string[]; host_permissions: string[] };
    const background = readFileSync("apps/ccm-browser-bridge/background.js", "utf8");

    expect(manifest.permissions).toContain("scripting");
    const permissions = new Set(manifest.host_permissions);
    const hosts = Object.values(CREDENTIAL_LOGIN_HOSTS).flatMap((items) => items ?? []);
    for (const host of hosts) {
      expect(permissions.has(`https://${host}/*`), host).toBe(true);
      expect(background.includes(`"${host}"`), host).toBe(true);
    }
    expect(manifest.host_permissions).not.toContain("<all_urls>");
  });

  it("does not offer fill support for providers without an account login", () => {
    expect(CREDENTIAL_LOGIN_HOSTS.pagespeed).toBeUndefined();
    expect(CREDENTIAL_LOGIN_HOSTS.uptime).toBeUndefined();
    expect(CREDENTIAL_LOGIN_HOSTS.tiktok).toEqual(["www.tiktok.com"]);
  });

  it("uses only a fixed provider-approved destination for each saved-login account", () => {
    for (const [provider, launchUrl] of Object.entries(CREDENTIAL_LOGIN_URLS)) {
      expect(launchUrl, provider).toBeTruthy();
      expect(providerSupportsCredentialFill(provider as keyof typeof CREDENTIAL_LOGIN_HOSTS)).toBe(true);
      expect(() => assertAllowedLaunchUrl(provider as keyof typeof CREDENTIAL_LOGIN_HOSTS, launchUrl!)).not.toThrow();
    }
  });
});
