import { expect, test } from "@playwright/test";

import {
  createAppointmentScenario,
  createSecondAppointment,
} from "../helpers/db";
import { loginAsAdmin, loginAsEmployee } from "../helpers/auth";
import {
  getCasablancaDayRange,
  parsePlanningDate,
  shiftPlanningDate,
} from "@/features/planning/server/casablanca-day";

function todayAt14() {
  const today = parsePlanningDate(undefined, new Date());
  const { start } = getCasablancaDayRange(today);
  return new Date(start.getTime() + 14 * 60 * 60_000);
}

test.describe("Planning — rendez-vous du jour", () => {
  test("un rendez-vous incomplet reste hors des colonnes tant qu’il n’est pas affecté", async ({
    page,
  }) => {
    await createAppointmentScenario({
      scheduledStart: todayAt14(),
      assignedEmployeeId: null,
      roomId: null,
    });

    await loginAsAdmin(page);
    await page.goto("/planning");

    await expect(page.getByText("Rendez-vous").first()).toBeVisible();
    await expect(page.getByText("Soin visage E2E")).toHaveCount(0);
  });

  test("le planning du jour n'affiche pas les rendez-vous d'hier ou de demain", async ({
    page,
  }) => {
    const s = await createAppointmentScenario({
      scheduledStart: todayAt14(),
    });
    const today = parsePlanningDate(undefined, new Date());
    const yesterday = getCasablancaDayRange(shiftPlanningDate(today, -1));
    const tomorrow = getCasablancaDayRange(shiftPlanningDate(today, 1));

    await createSecondAppointment(s, {
      clientName: "Cliente Hier",
      serviceName: "Prestation Hier",
      scheduledStart: new Date(yesterday.start.getTime() + 14 * 60 * 60_000),
    });
    await createSecondAppointment(s, {
      clientName: "Cliente Demain",
      serviceName: "Prestation Demain",
      scheduledStart: new Date(tomorrow.start.getTime() + 14 * 60 * 60_000),
    });

    await loginAsAdmin(page);
    await page.goto("/planning");

    await expect(page.getByText("Soin visage E2E")).toBeVisible();
    await expect(page.getByText("Prestation Hier")).toHaveCount(0);
    await expect(page.getByText("Prestation Demain")).toHaveCount(0);
  });

  test("un rendez-vous complètement affecté apparaît dans sa colonne", async ({
    page,
  }) => {
    await createAppointmentScenario({ scheduledStart: todayAt14() });
    await loginAsAdmin(page);
    await page.goto("/planning");

    await expect(page.getByText("Soin visage E2E")).toBeVisible();
  });

  test("une employée standard ne peut pas accéder à l'ancien écran Organisation", async ({
    page,
  }) => {
    await createAppointmentScenario({
      scheduledStart: todayAt14(),
      assignedEmployeeId: null,
      roomId: null,
    });
    await loginAsEmployee(page);
    await page.goto("/organize");

    await expect(page).toHaveURL(/\/my-day(?:\?|$)/);
    await expect(page.getByRole("button", { name: /je prends/i })).toHaveCount(
      0,
    );
    await expect(page.locator("select")).toHaveCount(0);
  });
});
