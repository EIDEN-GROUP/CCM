import { expect, test, type Page } from "@playwright/test";

/**
 * Right-to-left layout and visual regression.
 *
 * The Arabic interface is a requirement, not a nicety: the Medical Bay team
 * works in French, English and Arabic, and a right-to-left language that
 * renders left-to-right is a broken screen.
 *
 * The visual snapshots are of the sign-in screen, which is the one surface
 * that renders without a signed-in user and without a configured
 * database — so the baseline does not move every time the owner's data
 * changes. The dynamic part of the form is masked for the same reason.
 */

async function setLocale(page: Page, locale: "en" | "fr" | "ar") {
  // The locale endpoint sets the cookie on the browser's own jar.
  await page.request.post("/api/locale", { data: { locale } });
}

test.describe("right-to-left layout", () => {
  test("Arabic renders right to left", async ({ page }) => {
    await setLocale(page, "ar");
    await page.goto("/login");

    const html = page.locator("html");
    await expect(html).toHaveAttribute("dir", "rtl");
    await expect(html).toHaveAttribute("lang", "ar");

    const direction = await page.evaluate(
      () => getComputedStyle(document.body).direction,
    );
    expect(direction).toBe("rtl");
  });

  test("English and French render left to right", async ({ page }) => {
    for (const locale of ["en", "fr"] as const) {
      await setLocale(page, locale);
      await page.goto("/login");

      await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

      const direction = await page.evaluate(
        () => getComputedStyle(document.body).direction,
      );
      expect(direction).toBe("ltr");
    }
  });

  test("the Arabic typeface is applied to Arabic text", async ({ page }) => {
    await setLocale(page, "ar");
    await page.goto("/login");

    const font = await page.evaluate(() => {
      const heading = document.querySelector("h1");
      return heading ? getComputedStyle(heading).fontFamily : "";
    });

    // The Arabic font is layered over Heebo, so the family list has to
    // mention it. A missing Arabic font would leave Arabic text in the
    // Latin fallback.
    expect(font).toMatch(/Noto|Naskh|Arabic/i);
  });

  test("the locale survives a reload", async ({ page }) => {
    await setLocale(page, "ar");
    await page.goto("/login");
    await page.reload();

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });
});

test.describe("visual regression", () => {
  test("the sign-in screen", async ({ page }) => {
    await setLocale(page, "en");
    await page.goto("/login");

    // The form's own state changes with the deployment, so it is masked.
    // The brand, the type and the palette are what this baseline protects.
    await expect(page).toHaveScreenshot("login-en.png", {
      fullPage: true,
      mask: [page.locator("main form")],
      animations: "disabled",
    });
  });

  test("the sign-in screen in Arabic", async ({ page }) => {
    await setLocale(page, "ar");
    await page.goto("/login");

    await expect(page).toHaveScreenshot("login-ar.png", {
      fullPage: true,
      mask: [page.locator("main form")],
      animations: "disabled",
    });
  });
});
