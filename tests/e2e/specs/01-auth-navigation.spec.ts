import { createHash } from "node:crypto";

import { expect, test } from "@playwright/test";

import { ADMIN_EMAIL, createBaseE2EContext, testPrisma } from "../helpers/db";
import {
  loginAsAdmin,
  loginAsEmployee,
  loginAsEmployeeByPhone,
} from "../helpers/auth";

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

  test("l'employée peut aussi se connecter avec son téléphone", async ({
    page,
  }) => {
    await loginAsEmployeeByPhone(page);
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

  test("le formulaire mot de passe oublié reste générique", async ({
    page,
  }) => {
    await page.goto("/forgot-password");
    await page.getByLabel(/email du compte/i).fill("inconnu@salonflow.test");
    await page.getByRole("button", { name: /recevoir le lien/i }).click();

    await expect(
      page.getByText(/si un compte actif correspond à cet email/i),
    ).toBeVisible();
  });

  test("une gérante peut réinitialiser son mot de passe avec un lien valide", async ({
    page,
  }) => {
    const user = await testPrisma.user.findFirstOrThrow({
      where: { email: ADMIN_EMAIL },
    });
    const rawToken = `e2e-reset-${"x".repeat(40)}`;
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    await testPrisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    });

    const newPassword = "SalonFlow-Nouveau-2026!";
    await page.goto(`/reset-password/${encodeURIComponent(rawToken)}`);
    await page
      .getByLabel("Nouveau mot de passe", { exact: true })
      .fill(newPassword);
    await page.getByLabel(/confirmer le mot de passe/i).fill(newPassword);
    await page
      .getByRole("button", { name: /modifier le mot de passe/i })
      .click();

    await expect(page.getByRole("status")).toContainText(
      /mot de passe a été modifié/i,
    );
    await page.getByRole("link", { name: /se connecter/i }).click();
    await page.locator('input[name="identifier"]').fill(ADMIN_EMAIL);
    await page.locator('input[name="password"]').fill(newPassword);
    await page.getByRole("button", { name: /se connecter/i }).click();
    await expect(page).toHaveURL(/\/planning$/);
  });

  test("un changement de sessionVersion invalide une session JWT existante", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const user = await testPrisma.user.findFirstOrThrow({
      where: { email: ADMIN_EMAIL },
    });

    await testPrisma.user.update({
      where: { id: user.id },
      data: { sessionVersion: { increment: 1 } },
    });

    await page.goto("/planning");
    await expect(page).toHaveURL(/\/login/);
  });

  test("une mauvaise connexion reste sur login", async ({ page }) => {
    await page.goto("/login");
    await page
      .locator('input[name="identifier"], input[name="email"]')
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
