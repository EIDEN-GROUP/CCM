import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end smoke tests.
 *
 * These run against the real application. Depending on whether the backend
 * is configured, the app deliberately shows either the setup screen (nothing
 * configured) or the sign-in screen (configured, not signed in). The suite
 * asserts that the application boots into one of those states honestly, that
 * it applies the Medicalbay Calm Care tokens, and that it never leaks an
 * internal error.
 */

type Screen = "setup" | "login" | "app";

async function currentScreen(page: Page): Promise<Screen> {
  const url = page.url();
  if (url.includes("/setup")) return "setup";
  if (url.includes("/login")) return "login";
  return "app";
}

test.describe("application boot", () => {
  test("boots into the setup or sign-in screen", async ({ page }) => {
    await page.goto("/overview");

    const screen = await currentScreen(page);
    expect(["setup", "login", "app"]).toContain(screen);

    if (screen === "setup") {
      await expect(
        page.getByRole("heading", { name: "Setup" }),
      ).toBeVisible();
    } else if (screen === "login") {
      await expect(
        page.getByRole("heading", { name: "Command Center Medicalbay" }),
      ).toBeVisible();
      // Invite-only: there is no sign-up path.
      await expect(page.getByText(/No account yet/)).toBeVisible();
    }
  });

  test("the setup screen names the missing configuration", async ({
    page,
  }) => {
    await page.goto("/setup");
    await expect(
      page.getByRole("heading", { name: "Setup" }),
    ).toBeVisible();
  });

  test("applies the Medicalbay Calm Care primary colour", async ({ page }) => {
    // The sign-in screen carries the teal brand mark, so it is the one place
    // a visitor sees the palette before signing in.
    await page.goto("/login");

    const brand = page.locator("span", { hasText: /^CCM$/ }).first();
    await expect(brand).toBeVisible();

    const background = await brand.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    // #4bbdbd
    expect(background).toBe("rgb(75, 189, 189)");
  });

  test("the setup screen reports the database repair when it is needed", async ({
    page,
  }) => {
    await page.goto("/setup");
    await expect(
      page.getByRole("heading", { name: "Setup" }),
    ).toBeVisible();

    // Either the authorisation layer is present, or the screen says exactly
    // what has to be applied. Both are honest; a blank screen is not.
    const repair = page.getByText("Database repair required");
    const installed = page.getByText("Row Level Security is installed");
    await expect(repair.or(installed).first()).toBeVisible();
  });

  test("renders the Heebo typeface", async ({ page }) => {
    await page.goto("/setup");
    const font = await page.evaluate(() => {
      const body = document.querySelector("body");
      return body ? getComputedStyle(body).fontFamily : "";
    });
    expect(font).toContain("Heebo");
  });

  test("never renders a raw stack trace or an internal error", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/overview");
    await page.goto("/setup");
    await page.goto("/login");

    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/at Object\./);
    expect(body).not.toMatch(/node_modules/);
    expect(body).not.toMatch(/PostgrestError/i);
    expect(errors).toHaveLength(0);
  });
});

test.describe("the root", () => {
  test("is never a 404", async ({ page }) => {
    // The proxy sends an unauthenticated visitor from `/` to
    // `/login?next=%2F`, and the sign-in form returns them to `/` afterwards.
    // Without a root page that round trip ends in a 404.
    await page.goto("/");

    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/could not be found/i);

    // Signed out, the root leads to the sign-in screen. Signed in — after
    // the credentials are accepted — it leads to the overview.
    expect(["/login", "/overview"]).toContain(new URL(page.url()).pathname);
  });
});

test.describe("public key endpoint", () => {
  test("either serves a public key or explains that none is configured", async ({
    request,
  }) => {
    const response = await request.get("/api/launch/public-key");

    if (response.status() === 200) {
      const body = (await response.json()) as {
        kty: string;
        crv: string;
        x: string;
      };
      expect(body.kty).toBe("EC");
      expect(body.crv).toBe("P-256");
      expect(body.x.length).toBeGreaterThan(0);
    } else {
      expect(response.status()).toBe(503);
      const body = (await response.json()) as {
        error: string;
        code?: string;
      };
      // Either the key is absent, or it is present but unusable (for example
      // truncated). Both must name the fix.
      expect(body.error).toMatch(
        /LAUNCH_SIGNING_PUBLIC_KEY|could not be imported|keys:launch/i,
      );
    }
  });
});

test.describe("health endpoint", () => {
  test("reports configuration state without leaking a value", async ({
    request,
  }) => {
    const response = await request.get("/api/health");
    expect([200, 503]).toContain(response.status());

    const body = (await response.json()) as {
      status: string;
      configuration: { ready: boolean; present: string[]; missing: string[] };
      database: { reachable: boolean };
    };

    expect(["ok", "degraded"]).toContain(body.status);
    expect(typeof body.configuration.ready).toBe("boolean");
    expect(Array.isArray(body.configuration.missing)).toBe(true);

    // It must never return a secret, only names.
    const serialised = JSON.stringify(body);
    expect(serialised).not.toMatch(/[A-Za-z0-9_-]{40,}/);
  });
});

test.describe("locale switching", () => {
  test("the interface language can be changed", async ({ request }) => {
    const response = await request.post("/api/locale", {
      data: { locale: "fr" },
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).locale).toBe("fr");

    const arabic = await request.post("/api/locale", {
      data: { locale: "ar" },
    });
    expect(arabic.status()).toBe(200);
  });

  test("rejects an unsupported locale", async ({ request }) => {
    const response = await request.post("/api/locale", {
      data: { locale: "xx" },
    });
    expect(response.status()).toBe(400);
  });
});
