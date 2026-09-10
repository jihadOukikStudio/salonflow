import { expect, test } from "@playwright/test";

import {
  createAppointmentScenario,
  futureDate,
  pastDate,
  testPrisma,
} from "../helpers/db";
import { loginAsAdmin, loginAsEmployee } from "../helpers/auth";
import { organizationCard, serviceCard } from "../helpers/ui";

test.describe("Recette métier — parcours critique", () => {
  test("parcours complet : organiser → réaliser → encaisser → clôturer", async ({
    page,
  }) => {
    const s = await createAppointmentScenario({
      assignedEmployeeId: null,
      roomId: null,
      scheduledStart: futureDate(24 * 60),
    });

    await loginAsAdmin(page);
    await page.goto("/organize");

    const card = organizationCard(page, "Soin visage E2E");
    await expect(card).toBeVisible();

    await card.locator("select").first().selectOption(s.amina.id);
    await expect
      .poll(async () => {
        const row = await testPrisma.appointmentService.findUnique({
          where: { id: s.appointmentService.id },
          select: { assignedEmployeeId: true },
        });
        return row?.assignedEmployeeId;
      })
      .toBe(s.amina.id);

    const refreshedCard = organizationCard(page, "Soin visage E2E");
    await refreshedCard
      .locator("select")
      .last()
      .selectOption(s.treatmentRoom1.id);

    await expect
      .poll(async () => {
        const row = await testPrisma.appointmentService.findUnique({
          where: { id: s.appointmentService.id },
          select: { roomId: true },
        });
        return row?.roomId;
      })
      .toBe(s.treatmentRoom1.id);

    // Pour tester l'exécution sans attendre le lendemain.
    await testPrisma.appointment.update({
      where: { id: s.appointment.id },
      data: { scheduledStart: pastDate(5) },
    });

    await page.goto(`/appointments/${s.appointment.id}`);

    const service = serviceCard(page, "Soin visage E2E");
    await service.getByRole("button", { name: /commencer/i }).click();

    await expect
      .poll(async () => {
        const row = await testPrisma.appointmentService.findUnique({
          where: { id: s.appointmentService.id },
          select: { status: true },
        });
        return row?.status;
      })
      .toBe("IN_PROGRESS");

    await serviceCard(page, "Soin visage E2E")
      .getByRole("button", { name: /terminer/i })
      .click();

    await expect
      .poll(async () => {
        const row = await testPrisma.appointment.findUnique({
          where: { id: s.appointment.id },
          select: { status: true },
        });
        return row?.status;
      })
      .toBe("COMPLETED");

    const amount = page.getByLabel(/montant réellement encaissé/i);
    await amount.fill("300");
    await page.getByRole("button", { name: /espèces encaissées/i }).click();

    await expect
      .poll(async () => {
        const payment = await testPrisma.payment.findUnique({
          where: { appointmentId: s.appointment.id },
          select: { status: true },
        });
        return payment?.status;
      })
      .toBe("PAID");

    const close = page.getByRole("button", {
      name: /clôturer le rendez-vous/i,
    });
    await expect(close).toBeEnabled();
    await close.click();

    await expect
      .poll(async () => {
        const row = await testPrisma.appointment.findUnique({
          where: { id: s.appointment.id },
          select: { status: true },
        });
        return row?.status;
      })
      .toBe("CLOSED");

    const actions = await testPrisma.activityLog.findMany({
      where: {
        salonId: s.salon.id,
        entityId: s.appointment.id,
      },
      select: { action: true },
    });

    expect(actions.length).toBeGreaterThan(0);
  });

  test("un rendez-vous incomplet reste visible dans Organisation", async ({
    page,
  }) => {
    const s = await createAppointmentScenario({
      assignedEmployeeId: null,
      roomId: null,
    });

    await loginAsAdmin(page);
    await page.goto("/organize");

    const card = organizationCard(page, "Soin visage E2E");
    await expect(card).toBeVisible();
    await expect(card.locator("select")).toHaveCount(2);

    await card.locator("select").first().selectOption(s.sara.id);

    await expect
      .poll(async () => {
        const row = await testPrisma.appointmentService.findUnique({
          where: { id: s.appointmentService.id },
          select: { assignedEmployeeId: true, roomId: true },
        });
        return row;
      })
      .toMatchObject({ assignedEmployeeId: s.sara.id, roomId: null });

    // Il reste une décision à régler : la salle.
    await expect(organizationCard(page, "Soin visage E2E")).toBeVisible();
  });

  test("un rendez-vous totalement organisé reste consultable", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/organize");

    await expect(page.locator("body")).toContainText(
      /organisé|tout est organisé/i,
    );
    await expect(
      page.getByRole("link", { name: /cliente e2e|voir/i }).first(),
    ).toBeVisible();
  });

  test("l'employée peut exécuter uniquement sa prestation affectée", async ({
    page,
  }) => {
    const s = await createAppointmentScenario({
      scheduledStart: pastDate(5),
      assignedEmployeeId: undefined,
    });

    await loginAsEmployee(page);
    await page.goto(`/appointments/${s.appointment.id}`);

    const card = serviceCard(page, "Soin visage E2E");
    await expect(
      card.getByRole("button", { name: /commencer/i }),
    ).toBeVisible();
    await card.getByRole("button", { name: /commencer/i }).click();

    await expect
      .poll(async () => {
        const row = await testPrisma.appointmentService.findUnique({
          where: { id: s.appointmentService.id },
          select: { status: true },
        });
        return row?.status;
      })
      .toBe("IN_PROGRESS");
  });

  test("annuler un rendez-vous libère son état sans supprimer son historique", async ({
    page,
  }) => {
    const s = await createAppointmentScenario();

    await loginAsAdmin(page);
    await page.goto(`/appointments/${s.appointment.id}`);

    await page.getByRole("button", { name: /annuler le rendez-vous/i }).click();
    const dialog = page.getByRole("alertdialog", {
      name: /annuler le rendez-vous/i,
    });
    await expect(dialog).toBeVisible();

    await dialog
      .getByRole("button", { name: /^annuler le rendez-vous$/i })
      .click();

    await expect
      .poll(async () =>
        testPrisma.appointment.findUnique({
          where: { id: s.appointment.id },
          select: { status: true, cancelledAt: true, clientId: true },
        }),
      )
      .toMatchObject({
        status: "CANCELLED",
        clientId: s.client.id,
      });
  });
});
