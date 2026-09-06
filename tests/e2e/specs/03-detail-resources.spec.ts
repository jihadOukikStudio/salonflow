import { expect, test } from "@playwright/test";

import { createAppointmentScenario, testPrisma } from "../helpers/db";
import { loginAsAdmin } from "../helpers/auth";
import { serviceCard } from "../helpers/ui";

test.describe("Phase 12.3 — détail et ressources", () => {
  test("affiche cliente, prestation, employée, salle, durée et montant", async ({
    page,
  }) => {
    const s = await createAppointmentScenario();

    await loginAsAdmin(page);
    await page.goto(`/appointments/${s.appointment.id}`);

    const body = page.locator("body");
    await expect(body).toContainText("Cliente E2E");
    await expect(body).toContainText("Soin visage E2E");
    await expect(body).toContainText("Amina");
    await expect(body).toContainText("Salle de soins 1");
    await expect(body).toContainText(/60 min/);
    await expect(body).toContainText(/300/);
  });

  test("la gérante réaffecte une prestation à une autre employée", async ({
    page,
  }) => {
    const s = await createAppointmentScenario();

    await loginAsAdmin(page);
    await page.goto(`/appointments/${s.appointment.id}`);

    const card = serviceCard(page, "Soin visage E2E");
    await card.locator("select").first().selectOption(s.sara.id);

    await expect
      .poll(
        async () => {
          const row = await testPrisma.appointmentService.findUnique({
            where: { id: s.appointmentService.id },
            select: { assignedEmployeeId: true },
          });
          return row?.assignedEmployeeId;
        },
        { timeout: 15_000 },
      )
      .toBe(s.sara.id);
  });

  test("la gérante change la salle compatible", async ({ page }) => {
    const s = await createAppointmentScenario();

    await loginAsAdmin(page);
    await page.goto(`/appointments/${s.appointment.id}`);

    const card = serviceCard(page, "Soin visage E2E");
    await card.locator("select").last().selectOption(s.treatmentRoom2.id);

    await expect
      .poll(
        async () => {
          const row = await testPrisma.appointmentService.findUnique({
            where: { id: s.appointmentService.id },
            select: { roomId: true },
          });
          return row?.roomId;
        },
        { timeout: 15_000 },
      )
      .toBe(s.treatmentRoom2.id);
  });

  test("la note interne est enregistrée", async ({ page }) => {
    const s = await createAppointmentScenario();

    await loginAsAdmin(page);
    await page.goto(`/appointments/${s.appointment.id}`);

    await page
      .getByLabel(/note interne/i)
      .fill("Cliente préfère une cabine calme.");
    await page.getByRole("button", { name: /enregistrer la note/i }).click();

    await expect
      .poll(
        async () => {
          const row = await testPrisma.appointment.findUnique({
            where: { id: s.appointment.id },
            select: { internalNote: true },
          });
          return row?.internalNote;
        },
        { timeout: 15_000 },
      )
      .toBe("Cliente préfère une cabine calme.");
  });

  test("un RDV clôturé a ses sélecteurs de ressources désactivés", async ({
    page,
  }) => {
    const s = await createAppointmentScenario({
      status: "CLOSED",
      paidAmount: 300,
    });

    await loginAsAdmin(page);
    await page.goto(`/appointments/${s.appointment.id}`);

    const card = serviceCard(page, "Soin visage E2E");
    for (const select of await card.locator("select").all()) {
      await expect(select).toBeDisabled();
    }
  });
});
