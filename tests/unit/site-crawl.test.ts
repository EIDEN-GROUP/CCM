import { describe, expect, it } from "vitest";
import { classify, serviceLineOf } from "@/lib/jobs/handlers/site-crawl";

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

describe("the service line", () => {
  it("maps the site's own service paths", () => {
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
