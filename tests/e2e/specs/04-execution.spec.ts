import { expect, test } from "@playwright/test";

import { createAppointmentScenario, pastDate, testPrisma } from "../helpers/db";
import { loginAsAdmin, loginAsEmployee, loginAsSara } from "../helpers/auth";
import { serviceCard } from "../helpers/ui";

test.describe("Phase 12.4 — exécution opérationnelle", () => {
  test("l'employée affectée démarre sa prestation", async ({ page }) => {
    const s = await createAppointmentScenario({
      scheduledStart: pastDate(5),
    });

    await loginAsEmployee(page);
    await page.goto(`/appointments/${s.appointment.id}`);

    const card = serviceCard(page, "Soin visage E2E");
    await card.getByRole("button", { name: /commencer/i }).click();

    await expect
      .poll(
        async () => {
          const row = await testPrisma.appointmentService.findUnique({
            where: { id: s.appointmentService.id },
            select: { status: true },
          });
          return row?.status;
        },
        { timeout: 15_000 },
      )
      .toBe("IN_PROGRESS");

    await expect
      .poll(
        async () => {
          const row = await testPrisma.appointment.findUnique({
            where: { id: s.appointment.id },
            select: { status: true },
          });
          return row?.status;
        },
        { timeout: 15_000 },
      )
      .toBe("IN_PROGRESS");
  });

  test("une employée non affectée ne peut pas démarrer la prestation d'une autre", async ({
    page,
  }) => {
    const s = await createAppointmentScenario({
      scheduledStart: pastDate(5),
    });

    await loginAsSara(page);
    await page.goto(`/appointments/${s.appointment.id}`);

    const card = serviceCard(page, "Soin visage E2E");
    const start = card.getByRole("button", { name: /commencer/i });

    if (await start.count()) {
      await start.click();
    }

    await expect
      .poll(async () => {
        const row = await testPrisma.appointmentService.findUnique({
          where: { id: s.appointmentService.id },
          select: { status: true },
        });
        return row?.status;
      })
      .toBe("TODO");
  });

  test("la gérante peut enregistrer le démarrage opérationnel", async ({
    page,
  }) => {
    const s = await createAppointmentScenario({
      scheduledStart: pastDate(5),
    });

    await loginAsAdmin(page);
    await page.goto(`/appointments/${s.appointment.id}`);

    await serviceCard(page, "Soin visage E2E")
      .getByRole("button", { name: /commencer/i })
      .click();

    await expect
      .poll(
        async () => {
          const row = await testPrisma.appointmentService.findUnique({
            where: { id: s.appointmentService.id },
            select: { status: true },
          });
          return row?.status;
        },
        { timeout: 15_000 },
      )
      .toBe("IN_PROGRESS");
  });

  test("une prestation en cours peut être terminée", async ({ page }) => {
    const s = await createAppointmentScenario({
      scheduledStart: pastDate(60),
      status: "IN_PROGRESS",
      serviceStatus: "IN_PROGRESS",
    });

    await testPrisma.appointmentService.update({
      where: { id: s.appointmentService.id },
      data: {
        performedByEmployeeId: s.amina.id,
        actualStartedAt: pastDate(30),
      },
    });

    await loginAsEmployee(page);
    await page.goto(`/appointments/${s.appointment.id}`);

    await serviceCard(page, "Soin visage E2E")
      .getByRole("button", { name: /terminer/i })
      .click();

    await expect
      .poll(
        async () => {
          const row = await testPrisma.appointmentService.findUnique({
            where: { id: s.appointmentService.id },
            select: { status: true, performedByEmployeeId: true },
          });
          return row;
        },
        { timeout: 15_000 },
      )
      .toMatchObject({
        status: "DONE",
        performedByEmployeeId: s.amina.id,
      });

    const appointment = await testPrisma.appointment.findUnique({
      where: { id: s.appointment.id },
      select: { status: true },
    });
    expect(appointment?.status).toBe("COMPLETED");
  });

  test("un rendez-vous futur ne démarre pas avant son heure", async ({
    page,
  }) => {
    const s = await createAppointmentScenario();

    await loginAsEmployee(page);
    await page.goto(`/appointments/${s.appointment.id}`);

    const card = serviceCard(page, "Soin visage E2E");
    const start = card.getByRole("button", { name: /commencer/i });
    await expect(start).toBeVisible();
    await start.click();

    await expect
      .poll(async () => {
        const row = await testPrisma.appointmentService.findUnique({
          where: { id: s.appointmentService.id },
          select: { status: true },
        });
        return row?.status;
      })
      .toBe("TODO");
  });
});
