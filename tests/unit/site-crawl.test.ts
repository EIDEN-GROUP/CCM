import { describe, expect, it } from "vitest";
import {
  classify,
  sameHost,
  serviceLineOf,
} from "@/lib/jobs/handlers/site-crawl";

/**
 * The crawl's classification.
 *
 * The page class drives the reporting, and the service line decides which
 * campaign a page belongs to. Getting them wrong would misattribute
 * traffic, so the rules are pinned here.
 */
describe("the page class", () => {
  it("classifies a legal page first, whatever else it says", () => {
    expect(classify("/mentions-legales", "Mentions légales")).toBe("legal");
    expect(classify("/privacy-policy", "Privacy")).toBe("legal");
    expect(classify("/fr/cookies", null)).toBe("legal");
  });

  it("classifies a service page", () => {
    expect(classify("/services/dentistry", "Dentistry")).toBe("service");
    expect(classify("/dentiste-agadir", null)).toBe("service");
    expect(classify("/greffe-de-cheveux", null)).toBe("service");
  });

  it("classifies a content page", () => {
    expect(classify("/blog/soin-dentaire", "Soin")).toBe("content");
    expect(classify("/actualites/nouveau", null)).toBe("content");
  });

  it("classifies a landing page", () => {
    expect(classify("/contact", null)).toBe("landing");
    expect(classify("/reservation", null)).toBe("landing");
    expect(classify("/anything", "Book now")).toBe("landing");
  });

  it("classifies the home page as a landing page", () => {
    expect(classify("/", null)).toBe("landing");
  });

  it("falls back to other", () => {
    expect(classify("/some/other/page", null)).toBe("other");
  });
});

describe("the host check", () => {
  it("accepts a URL on the same host", () => {
    expect(sameHost("https://medicalbay.ma/a", "https://medicalbay.ma")).toBe(
      true,
    );
    expect(sameHost("https://www.medicalbay.ma/a", "https://www.medicalbay.ma")).toBe(
      true,
    );
  });

  it("refuses a host that merely starts with the site's address", () => {
    // A string prefix would accept all three of these.
    expect(sameHost("https://medicalbay.ma.evil.test/a", "https://medicalbay.ma")).toBe(
      false,
    );
    expect(sameHost("https://medicalbay.ma@evil.test/a", "https://medicalbay.ma")).toBe(
      false,
    );
    expect(sameHost("https://evil.test/?x=https://medicalbay.ma", "https://medicalbay.ma")).toBe(
      false,
    );
  });

  it("refuses a different scheme on the same host", () => {
    expect(sameHost("http://medicalbay.ma/a", "https://medicalbay.ma")).toBe(
      false,
    );
  });

  it("refuses a malformed URL", () => {
    expect(sameHost("not a url", "https://medicalbay.ma")).toBe(false);
  });
});

describe("the service line", () => {  it("maps the site's own service paths", () => {
    expect(serviceLineOf("/dentiste-agadir")).toBe("dentistry");
    expect(serviceLineOf("/services/dentistry")).toBe("dentistry");
    expect(serviceLineOf("/greffe-de-cheveux")).toBe("hair_transplant");
    expect(serviceLineOf("/hair-transplant")).toBe("hair_transplant");
    expect(serviceLineOf("/chirurgie-esthetique")).toBe("aesthetics");
    expect(serviceLineOf("/tourisme-medical")).toBe("medical_tourism");
  });

  it("returns null when the path names no service", () => {
    expect(serviceLineOf("/blog/a-post")).toBeNull();
    expect(serviceLineOf("/")).toBeNull();
  });
});
