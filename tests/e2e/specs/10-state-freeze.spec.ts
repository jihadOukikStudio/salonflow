import { expect, test } from "@playwright/test";

import { createAppointmentScenario } from "../helpers/db";
import { loginAsAdmin } from "../helpers/auth";
import { serviceCard } from "../helpers/ui";

test.describe("Phase 12.10 — gel des états finaux", () => {
  for (const status of ["CLOSED", "CANCELLED"] as const) {
    test(`${status}: pas d'ajout/retrait/édition structurelle`, async ({
      page,
    }) => {
      const s = await createAppointmentScenario({
        status,
        paidAmount: status === "CLOSED" ? 300 : null,
      });

      await loginAsAdmin(page);
      await page.goto(`/appointments/${s.appointment.id}`);

      await expect(
        page.getByRole("heading", { name: /ajouter une prestation/i }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /^Retirer$/i }),
      ).toHaveCount(0);

      const card = serviceCard(page, "Soin visage E2E");
      for (const select of await card.locator("select").all()) {
        await expect(select).toBeDisabled();
      }
    });
  }
});
