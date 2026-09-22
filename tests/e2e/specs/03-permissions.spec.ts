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

  test("l'employée standard est limitée à Ma journée", async ({ page }) => {
    await loginAsEmployee(page);
    await page.goto("/planning");

    await expect(page).toHaveURL(/\/my-day/);
    await expect(page.locator("body")).toContainText(/ma journée/i);
    await expect(page.locator('a[href="/clients"]')).toHaveCount(0);
    await expect(page.locator('a[href="/employees"]')).toHaveCount(0);
    await expect(page.locator('a[href="/rooms"]')).toHaveCount(0);
    await expect(page.locator('a[href="/services"]')).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Organisation", exact: true }),
    ).toHaveCount(0);
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

      await expect(page).toHaveURL(/\/my-day(?:\?|$)/);
      await expect(page.locator("body")).not.toContainText(
        /permissiondeniederror|seule la gérante peut gérer|uncaught/i,
      );
    });
  }

  test("l'ancien écran Organisation redirige aussi l'employée vers Ma journée", async ({
    page,
  }) => {
    await loginAsEmployee(page);
    await page.goto("/organize");
    await expect(page).toHaveURL(/\/my-day(?:\?|$)/);
  });
});
