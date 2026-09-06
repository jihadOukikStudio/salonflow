import { expect, test } from "@playwright/test";

import { createAppointmentScenario } from "../helpers/db";
import { loginAsAdmin } from "../helpers/auth";
import { expectNoHorizontalOverflow } from "../helpers/ui";

// Important: ne pas utiliser devices["iPhone ..."] ici.
// Certains descriptors imposent defaultBrowserType="webkit".
// On garde Chromium et on change uniquement le viewport / touch.
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1,
});

test.describe("Phase 12.9 — responsive mobile Chromium", () => {
  test("planning utilisable sans débordement horizontal", async ({ page }) => {
    await createAppointmentScenario();
    await loginAsAdmin(page);
    await page.goto("/planning");

    await expect(page.locator("body")).toContainText(/planning|rendez-vous/i);
    await expectNoHorizontalOverflow(page);
  });

  test("détail RDV utilisable sans débordement horizontal", async ({
    page,
  }) => {
    const s = await createAppointmentScenario();
    await loginAsAdmin(page);
    await page.goto(`/appointments/${s.appointment.id}`);

    await expect(page.locator("body")).toContainText("Soin visage E2E");
    await expectNoHorizontalOverflow(page);
  });

  test("À organiser utilisable sans débordement horizontal", async ({
    page,
  }) => {
    await createAppointmentScenario({
      assignedEmployeeId: null,
      roomId: null,
    });
    await loginAsAdmin(page);
    await page.goto("/organize");

    await expect(page.locator("body")).toContainText(/à organiser/i);
    await expectNoHorizontalOverflow(page);
  });

  test("login utilisable sur mobile", async ({ page }) => {
    await createAppointmentScenario();
    await loginAsAdmin(page);
    await expectNoHorizontalOverflow(page);
  });
});
