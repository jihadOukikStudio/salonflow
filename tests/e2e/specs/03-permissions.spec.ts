import { expect, test } from "@playwright/test";

import { createBaseE2EContext } from "../helpers/db";
import { loginAsAdmin, loginAsEmployee } from "../helpers/auth";

test.describe("Phase 12 — permissions de navigation", () => {
  test.beforeEach(async () => {
    await createBaseE2EContext();
  });

  for (const route of [
    "/appointments/new",
    "/services",
    "/employees",
    "/rooms",
    "/clients",
  ]) {
    test(`la gérante peut ouvrir ${route}`, async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto(route);

      await expect(page).toHaveURL(
        new RegExp(`${route.replaceAll("/", "\\/")}(?:\\?|$)`),
      );
      await expect(page.locator("body")).not.toContainText(
        /accès refusé|non autorisé|forbidden/i,
      );
    });
  }

  test("l'employée standard ne voit pas les écrans d'administration réservés dans le planning", async ({
    page,
  }) => {
    await loginAsEmployee(page);
    await page.goto("/planning");

    await expect(page.locator('a[href="/clients"]')).toHaveCount(0);
    await expect(page.locator('a[href="/employees"]')).toHaveCount(0);
    await expect(page.locator('a[href="/rooms"]')).toHaveCount(0);
    await expect(page.locator('a[href="/services"]')).toHaveCount(0);
    await expect(page.locator('a[href="/appointments/new"]')).toHaveCount(0);

    await expect(
      page.getByRole("link", { name: "Organisation", exact: true }),
    ).toBeVisible();

    const planningViews = page.getByRole("navigation", {
      name: "Vue du planning",
    });

    await expect(
      planningViews.getByRole("link", { name: "Employées", exact: true }),
    ).toBeVisible();

    await expect(
      planningViews.getByRole("link", { name: "Salles", exact: true }),
    ).toBeVisible();
  });

  for (const route of [
    "/appointments/new",
    "/services",
    "/employees",
    "/employees/unavailability",
    "/rooms",
    "/clients",
  ]) {
    test(`l'accès direct employée à ${route} redirige proprement vers le planning`, async ({
      page,
    }) => {
      await loginAsEmployee(page);
      await page.goto(route);

      await expect(page).toHaveURL(/\/planning(?:\?|$)/);
      await expect(page.locator("body")).not.toContainText(
        /permissiondeniederror|seule la gérante peut gérer|uncaught/i,
      );
    });
  }

  test("À organiser ne propose pas le raccourci Équipe à l'employée standard", async ({
    page,
  }) => {
    await loginAsEmployee(page);
    await page.goto("/organize");

    await expect(page.locator('a[href="/employees"]')).toHaveCount(0);
  });
});
