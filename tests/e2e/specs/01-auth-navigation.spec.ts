import { expect, test } from "@playwright/test";

import { createBaseE2EContext } from "../helpers/db";
import { loginAsAdmin, loginAsEmployee } from "../helpers/auth";

test.describe("Phase 12.1 — authentification et navigation", () => {
  test.beforeEach(async () => {
    await createBaseE2EContext();
  });

  test("la gérante se connecte et ouvre le planning", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/planning");
    await expect(page).toHaveURL(/\/planning/);
    await expect(page.locator("body")).toContainText(/planning|rendez-vous/i);
  });

  test("l'employée se connecte et ouvre le planning", async ({ page }) => {
    await loginAsEmployee(page);
    await page.goto("/planning");
    await expect(page).toHaveURL(/\/planning/);
    await expect(page.locator("body")).toContainText(/planning|rendez-vous/i);
  });

  test("la gérante accède à À organiser", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/organize");
    await expect(
      page.getByRole("heading", { name: /à organiser/i }),
    ).toBeVisible();
  });

  test("la gérante accède aux écrans structurels", async ({ page }) => {
    await loginAsAdmin(page);
    for (const route of ["/services", "/employees", "/rooms", "/clients"]) {
      await page.goto(route);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator("body")).not.toContainText(
        /404|page not found/i,
      );
    }
  });

  test("une mauvaise connexion reste sur login", async ({ page }) => {
    await page.goto("/login");
    await page
      .locator('input[type="email"], input[name="email"]')
      .first()
      .fill("bad@salonflow.test");
    await page
      .locator('input[type="password"], input[name="password"]')
      .first()
      .fill("bad-password");
    await page
      .getByRole("button", { name: /connexion|se connecter|connecter|login/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/login/);
  });
});
