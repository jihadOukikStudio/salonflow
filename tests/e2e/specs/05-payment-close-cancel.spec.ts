import { expect, test } from "@playwright/test";

import { createAppointmentScenario, pastDate, testPrisma } from "../helpers/db";
import { loginAsAdmin } from "../helpers/auth";
import { acceptNextDialog } from "../helpers/ui";

test.describe("Phase 12.5 — paiement, clôture et annulation", () => {
  test("le paiement est désactivé tant que le RDV n'est pas terminé", async ({
    page,
  }) => {
    const s = await createAppointmentScenario();

    await loginAsAdmin(page);
    await page.goto(`/appointments/${s.appointment.id}`);

    await expect(
      page.getByRole("button", { name: /espèces encaissées/i }),
    ).toBeDisabled();
    await expect(page.locator("body")).toContainText(
      /paiement devient disponible/i,
    );
  });

  test("un RDV terminé accepte un montant réellement encaissé différent", async ({
    page,
  }) => {
    const s = await createAppointmentScenario({
      scheduledStart: pastDate(90),
      status: "COMPLETED",
      serviceStatus: "DONE",
    });

    await loginAsAdmin(page);
    await page.goto(`/appointments/${s.appointment.id}`);

    const amount = page.getByLabel(/montant réellement encaissé/i);
    await amount.fill("275.50");
    await page.getByRole("button", { name: /espèces encaissées/i }).click();

    await expect
      .poll(
        async () => {
          const payment = await testPrisma.payment.findUnique({
            where: { appointmentId: s.appointment.id },
            select: { status: true, amount: true },
          });
          return payment
            ? { status: payment.status, amount: payment.amount.toNumber() }
            : null;
        },
        { timeout: 15_000 },
      )
      .toEqual({ status: "PAID", amount: 275.5 });
  });

  test("un RDV terminé non payé ne peut pas être clôturé", async ({ page }) => {
    const s = await createAppointmentScenario({
      scheduledStart: pastDate(90),
      status: "COMPLETED",
      serviceStatus: "DONE",
    });

    await loginAsAdmin(page);
    await page.goto(`/appointments/${s.appointment.id}`);

    await expect(
      page.getByRole("button", { name: /clôturer le rendez-vous/i }),
    ).toBeDisabled();
  });

  test("un RDV terminé et payé peut être clôturé", async ({ page }) => {
    const s = await createAppointmentScenario({
      scheduledStart: pastDate(90),
      status: "COMPLETED",
      serviceStatus: "DONE",
      paidAmount: 300,
    });

    await loginAsAdmin(page);
    await page.goto(`/appointments/${s.appointment.id}`);

    const close = page.getByRole("button", {
      name: /clôturer le rendez-vous/i,
    });
    await expect(close).toBeEnabled();
    await close.click();

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
      .toBe("CLOSED");
  });

  test("la gérante peut annuler un RDV planifié", async ({ page }) => {
    const s = await createAppointmentScenario();

    await loginAsAdmin(page);
    await page.goto(`/appointments/${s.appointment.id}`);

    await acceptNextDialog(page);
    await page.getByRole("button", { name: /annuler le rendez-vous/i }).click();

    await expect
      .poll(
        async () => {
          const row = await testPrisma.appointment.findUnique({
            where: { id: s.appointment.id },
            select: { status: true, cancelledAt: true },
          });
          return row;
        },
        { timeout: 15_000 },
      )
      .toMatchObject({ status: "CANCELLED" });
  });

  test("un RDV annulé est figé", async ({ page }) => {
    const s = await createAppointmentScenario({
      status: "CANCELLED",
    });

    await loginAsAdmin(page);
    await page.goto(`/appointments/${s.appointment.id}`);

    await expect(page.locator("body")).toContainText(/annulé/i);
    await expect(
      page.getByRole("button", { name: /enregistrer la note/i }),
    ).toHaveCount(0);
  });
});
