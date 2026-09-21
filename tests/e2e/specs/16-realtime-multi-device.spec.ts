import { expect, test } from "@playwright/test";

import {
  getCasablancaDayRange,
  parsePlanningDate,
} from "@/features/planning/server/casablanca-day";
import { loginAsAdmin, loginAsEmployee } from "../helpers/auth";
import { createAppointmentScenario } from "../helpers/db";
import { organizationCard } from "../helpers/ui";

function organizationTodayDate() {
  const today = parsePlanningDate(undefined, new Date());
  const { start } = getCasablancaDayRange(today);

  return new Date(start.getTime() + 14 * 60 * 60_000);
}

test.describe("Realtime sécurisé — multi-appareils", () => {
  test("une affectation faite par la gérante apparaît chez l'employée sans F5", async ({
    browser,
  }) => {
    const scenario = await createAppointmentScenario({
      scheduledStart: organizationTodayDate(),
      assignedEmployeeId: null,
      roomId: null,
    });

    const adminContext = await browser.newContext();
    const employeeContext = await browser.newContext();

    try {
      const adminPage = await adminContext.newPage();
      const employeePage = await employeeContext.newPage();

      await loginAsAdmin(adminPage);
      await loginAsEmployee(employeePage);

      await adminPage.goto("/organize");
      await employeePage.goto("/organize");

      const employeeCard = organizationCard(employeePage, "Soin visage E2E");
      await expect(employeeCard).toBeVisible();

      const adminCard = organizationCard(adminPage, "Soin visage E2E");
      await adminCard.locator("select").first().selectOption(scenario.sara.id);

      // Aucun goto/reload/refresh côté employée : la mise à jour doit arriver
      // uniquement via le canal SSE du salon.
      await expect(employeeCard).toContainText("Sara", { timeout: 15_000 });
    } finally {
      await adminContext.close();
      await employeeContext.close();
    }
  });

  test("le flux SSE refuse un navigateur non authentifié", async ({ page }) => {
    await page.goto("/login");

    // Le proxy Auth.js protège /api/realtime avant même que le Route Handler
    // soit exécuté. Un navigateur non authentifié est donc redirigé vers la
    // page de connexion. Un fetch() navigateur suit cette redirection et
    // masquerait le vrai statut en retournant 200 sur /login.
    const response = await page.context().request.get("/api/realtime", {
      maxRedirects: 0,
    });

    expect([302, 303, 307, 308]).toContain(response.status());
    expect(response.headers().location).toContain("/login");
    expect(response.headers()["content-type"] ?? "").not.toContain(
      "text/event-stream",
    );
  });
});
