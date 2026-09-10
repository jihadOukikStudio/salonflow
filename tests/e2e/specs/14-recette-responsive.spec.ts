import { expect, test } from "@playwright/test";

import { createAppointmentScenario } from "../helpers/db";
import { loginAsAdmin, loginAsEmployee } from "../helpers/auth";
import { expectNoHorizontalOverflow } from "../helpers/ui";

const adminRoutes = [
  "/planning",
  "/organize",
  "/dashboard",
  "/clients",
  "/services",
  "/employees",
  "/rooms",
];

test.describe("Recette responsive — mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("les écrans principaux gérante restent utilisables sans overflow global", async ({
    page,
  }) => {
    const s = await createAppointmentScenario();
    await loginAsAdmin(page);

    for (const route of adminRoutes) {
      await page.goto(route);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator("body")).not.toContainText(
        /application error|internal server error|page not found/i,
      );
      await expectNoHorizontalOverflow(page);
    }

    await page.goto(`/appointments/${s.appointment.id}`);
    await expect(page.locator("body")).toContainText("Cliente E2E");
    await expectNoHorizontalOverflow(page);
  });

  test("Ma journée employée fonctionne sur écran mobile", async ({ page }) => {
    await createAppointmentScenario();
    await loginAsEmployee(page);

    await expect(page).toHaveURL(/\/my-day/);
    await expect(page.locator("body")).toContainText(/ma journée/i);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Recette responsive — desktop large", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("planning, organisation et détail n'ont pas d'erreur de rendu majeure", async ({
    page,
  }) => {
    const s = await createAppointmentScenario();
    await loginAsAdmin(page);

    for (const route of [
      "/planning",
      "/organize",
      `/appointments/${s.appointment.id}`,
    ]) {
      await page.goto(route);
      await expect(page.locator("body")).not.toContainText(
        /application error|internal server error|page not found/i,
      );
      await expectNoHorizontalOverflow(page);
    }
  });
});
