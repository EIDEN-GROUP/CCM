import { describe, expect, it } from "vitest";
import {
  assertAllowedLaunchUrl,
  buildLaunchTarget,
  InvalidLaunchTargetError,
} from "@/lib/launch/urls";
import { PROVIDERS, PROVIDER_LIST } from "@/providers/registry";

/**
 * Launch URL validation.
 *
 * The server builds every launch URL, so these tests are the guarantee that a
 * client cannot make CCM open an address it should not.
 */

describe("buildLaunchTarget", () => {
  it("builds the exact GA4 property destination", () => {
    const target = buildLaunchTarget("ga4", {
      ga4: { propertyId: "123456789" },
    });
    expect(target.url).toBe(
      "https://analytics.google.com/analytics/web/?property=123456789",
    );
  });

  it("builds the exact Google Ads customer destination", () => {
    const target = buildLaunchTarget("google_ads", {
      google_ads: { customerId: "456-789-1234" },
    });
    expect(target.url).toBe("https://ads.google.com/aw?ocid=456-789-1234");
  });

  it("builds the exact Search Console property destination", () => {
    const target = buildLaunchTarget("gsc", {
      gsc: { propertyUrl: "https://www.medicalbay.ma/" },
    });
    expect(target.url).toContain(
      "resource_id=https%3A%2F%2Fwww.medicalbay.ma%2F",
    );
  });

  it("builds the exact GTM container destination", () => {
    const target = buildLaunchTarget("gtm", {
      gtm: { containerId: "GTM-WF77DFJD" },
    });
    expect(target.url).toBe(
      "https://tagmanager.google.com/#/versions?gmid=GTM-WF77DFJD",
    );
  });

  it("builds the exact Instagram profile destination", () => {
    const target = buildLaunchTarget("instagram", {
      meta: { username: "medicalbay.maroc" },
    });
    expect(target.url).toBe("https://www.instagram.com/medicalbay.maroc/");
  });

  it("builds an allowlisted TikTok profile or login destination", () => {
    expect(buildLaunchTarget("tiktok", { tiktok: { username: "@clinic" } }).url)
      .toBe("https://www.tiktok.com/@clinic");
    expect(buildLaunchTarget("tiktok", {}).url)
      .toBe("https://www.tiktok.com/login");
    expect(buildLaunchTarget("tiktok", {}, "management").url)
      .toBe("https://www.tiktok.com/creator-center/");
  });

  it("builds the exact LinkedIn company destination", () => {
    const target = buildLaunchTarget("linkedin", {
      linkedin: { pageSlug: "medical-bay-agadir" },
    });
    expect(target.url).toBe(
      "https://www.linkedin.com/company/medical-bay-agadir/",
    );
  });

  it("returns null and names the missing identifier rather than falling back to a homepage", () => {
    const target = buildLaunchTarget("ga4", {});
    expect(target.url).toBeNull();
    expect(target.missing?.length).toBeGreaterThan(0);
  });

  it("returns null for a provider with no destination of that kind", () => {
    const target = buildLaunchTarget("ahrefs", {}, "management");
    expect(target.url).toBeNull();
  });
});

describe("assertAllowedLaunchUrl", () => {
  it("accepts an https url on the provider allowlist", () => {
    const url = assertAllowedLaunchUrl(
      "ga4",
      "https://analytics.google.com/analytics/web/?property=1",
    );
    expect(url.hostname).toBe("analytics.google.com");
  });

  it("rejects http", () => {
    expect(() =>
      assertAllowedLaunchUrl("ga4", "http://analytics.google.com/"),
    ).toThrow(InvalidLaunchTargetError);
  });

  it("rejects a non-https scheme such as javascript", () => {
    expect(() =>
      assertAllowedLaunchUrl("ga4", "javascript:alert(1)"),
    ).toThrow(InvalidLaunchTargetError);
  });

  it("rejects a host that merely ends with an allowed host", () => {
    expect(() =>
      assertAllowedLaunchUrl("ga4", "https://evil-analytics.google.com/"),
    ).toThrow(InvalidLaunchTargetError);
  });

  it("rejects a host that merely contains an allowed host", () => {
    expect(() =>
      assertAllowedLaunchUrl("ga4", "https://analytics.google.com.evil.test/"),
    ).toThrow(InvalidLaunchTargetError);
  });

  it("rejects a host belonging to a different provider", () => {
    expect(() =>
      assertAllowedLaunchUrl("ga4", "https://ads.google.com/aw"),
    ).toThrow(InvalidLaunchTargetError);
  });

  it("rejects a malformed url", () => {
    expect(() => assertAllowedLaunchUrl("ga4", "not a url")).toThrow(
      InvalidLaunchTargetError,
    );
  });
});

describe("provider registry", () => {
  it("gives every provider at least one allowlisted host", () => {
    for (const provider of PROVIDER_LIST) {
      expect(provider.hosts.length).toBeGreaterThan(0);
      for (const host of provider.hosts) {
        expect(host).toMatch(/^[a-z0-9.-]+$/);
        expect(host.startsWith("https://")).toBe(false);
      }
    }
  });

  it("only lists https hosts that have no path", () => {
    for (const provider of PROVIDER_LIST) {
      for (const host of provider.hosts) {
        expect(host).not.toContain("/");
      }
    }
  });

  it("pins an API version for every provider", () => {
    for (const provider of PROVIDER_LIST) {
      expect(provider.apiVersion.length).toBeGreaterThan(0);
    }
  });

  it("declares the launch capability for providers that can be opened", () => {
    for (const provider of PROVIDER_LIST) {
      const hasLaunch =
        provider.launch.account !== undefined ||
        provider.launch.management !== undefined;
      const declaresLaunch = provider.capabilities.some(
        (capability) => capability.key === "launch.account",
      );
      expect(declaresLaunch).toBe(hasLaunch);
    }
  });

  it("marks every unimplemented capability honestly", () => {
    for (const provider of PROVIDER_LIST) {
      for (const capability of provider.capabilities) {
        if (!capability.implemented) {
          expect(capability.limitation).toBeTruthy();
        }
      }
    }
  });

  it("does not advertise a write capability in the read-only release", () => {
    for (const provider of PROVIDER_LIST) {
      for (const capability of provider.capabilities) {
        if (
          capability.key === "write.publish" ||
          capability.key === "write.send" ||
          capability.key === "write.budget"
        ) {
          expect(capability.implemented).toBe(false);
        }
      }
    }
  });

  it("keeps the Google Ads access model free of a developer token", () => {
    const ads = PROVIDERS.google_ads;
    expect(ads.apiVersion).toBe("v25");
    expect(ads.blockingApprovals.join(" ")).toContain("Google Cloud project");
  });
});
