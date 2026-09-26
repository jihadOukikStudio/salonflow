import { expect, test } from "@playwright/test";

import { createAppointmentScenario, pastDate, testPrisma } from "../helpers/db";
import {
  getCasablancaDayRange,
  parsePlanningDate,
} from "@/features/planning/server/casablanca-day";
import { loginAsAdmin, loginAsEmployee } from "../helpers/auth";
import { serviceCard } from "../helpers/ui";

function organizationTodayDate() {
  const today = parsePlanningDate(undefined, new Date());
  const { start } = getCasablancaDayRange(today);

  return new Date(start.getTime() + 14 * 60 * 60_000);
}

test.describe("Recette métier — parcours critique", () => {
  test("parcours complet : organiser → réaliser → encaisser → clôturer", async ({
    page,
  }) => {
    const s = await createAppointmentScenario({
      scheduledStart: organizationTodayDate(),
    });

    await loginAsAdmin(page);

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

    await page
      .getByRole("button", { name: /encaisser .* en espèces/i })
      .click();

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

  test("un rendez-vous incomplet reste hors des colonnes du planning", async ({
    page,
  }) => {
    await createAppointmentScenario({
      scheduledStart: organizationTodayDate(),
      assignedEmployeeId: null,
      roomId: null,
    });
    await loginAsAdmin(page);
    await page.goto("/planning");
    await expect(page.getByText("Soin visage E2E")).toHaveCount(0);
  });

  test("un rendez-vous totalement organisé reste consultable dans le planning", async ({
    page,
  }) => {
    await createAppointmentScenario({
      scheduledStart: organizationTodayDate(),
    });
    await loginAsAdmin(page);
    await page.goto("/planning");
    await expect(page.getByText("Soin visage E2E")).toBeVisible();
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
