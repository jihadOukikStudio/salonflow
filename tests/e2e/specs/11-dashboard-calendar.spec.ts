import { expect, test } from "@playwright/test";
import { createAppointmentScenario } from "../helpers/db";
import { loginAsAdmin, loginAsEmployee } from "../helpers/auth";

test.describe("Phase 12.6 — dashboard et calendrier", () => {
  test("la gérante accède au dashboard financier", async ({ page }) => {
    await createAppointmentScenario();
    await loginAsAdmin(page);
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /état du salon/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /activité financière/i }),
    ).toBeVisible();
    await expect(page.getByText(/aujourd’hui/i).first()).toBeVisible();
  });

  test("l'employée standard est redirigée vers le planning", async ({
    page,
  }) => {
    await createAppointmentScenario();
    await loginAsEmployee(page);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/planning/);
    await expect(
      page.getByRole("heading", { name: /activité financière/i }),
    ).toHaveCount(0);
  });

  test("le planning expose les trois vues calendrier", async ({ page }) => {
    await createAppointmentScenario();
    await loginAsAdmin(page);
    await page.goto("/planning");
    await expect(
      page.getByRole("link", { name: /planning/i }).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /employées/i })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /salles/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/la hauteur des blocs représente la durée/i),
    ).toBeVisible();
  });
});
