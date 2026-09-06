import { expect, test } from "@playwright/test";

import { createAppointmentScenario } from "../helpers/db";
import { loginAsAdmin, loginAsEmployee } from "../helpers/auth";

test.describe("Phase 12.6 — permissions", () => {
  test("la gérante voit les écrans de structure", async ({ page }) => {
    await createAppointmentScenario();
    await loginAsAdmin(page);

    for (const route of ["/services", "/employees", "/rooms", "/clients"]) {
      await page.goto(route);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator("body")).not.toContainText(
        /accès refusé|non autorisé/i,
      );
    }
  });

  test("l'employée standard est redirigée proprement hors de l'administration équipe", async ({
    page,
  }) => {
    await createAppointmentScenario();
    await loginAsEmployee(page);
    await page.goto("/employees");

    await expect(page).toHaveURL(/\/planning(?:\?|$)/);
    await expect(
      page.getByRole("button", { name: /ajouter l[’']employée/i }),
    ).toHaveCount(0);
  });

  test("l'employée standard ne voit pas l'ajout structurel de prestation sur le RDV", async ({
    page,
  }) => {
    const s = await createAppointmentScenario();
    await loginAsEmployee(page);
    await page.goto(`/appointments/${s.appointment.id}`);

    await expect(
      page.getByRole("heading", { name: /ajouter une prestation/i }),
    ).toHaveCount(0);
  });

  test("l'employée standard ne peut pas enregistrer le paiement", async ({
    page,
  }) => {
    const s = await createAppointmentScenario({
      status: "COMPLETED",
      serviceStatus: "DONE",
    });
    await loginAsEmployee(page);
    await page.goto(`/appointments/${s.appointment.id}`);

    await expect(
      page.getByRole("button", { name: /espèces encaissées/i }),
    ).toBeDisabled();
  });

  test("l'employée standard ne peut pas clôturer", async ({ page }) => {
    const s = await createAppointmentScenario({
      status: "COMPLETED",
      serviceStatus: "DONE",
      paidAmount: 300,
    });
    await loginAsEmployee(page);
    await page.goto(`/appointments/${s.appointment.id}`);

    await expect(
      page.getByRole("button", { name: /clôturer le rendez-vous/i }),
    ).toBeDisabled();
  });
});
