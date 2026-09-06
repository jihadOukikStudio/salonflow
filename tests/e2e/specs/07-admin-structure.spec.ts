import { expect, test } from "@playwright/test";

import { createBaseE2EContext, testPrisma } from "../helpers/db";
import { loginAsAdmin } from "../helpers/auth";

test.describe("Phase 12.7 — administration structurelle", () => {
  test("la gérante ajoute une employée", async ({ page }) => {
    const s = await createBaseE2EContext();

    await loginAsAdmin(page);
    await page.goto("/employees");

    await page.getByPlaceholder("Prénom *", { exact: true }).fill("Nora");

    const addEmployeeSection = page
      .locator("section")
      .filter({ hasText: "Ajouter une employée" })
      .first();

    await addEmployeeSection
      .getByPlaceholder("Nom", { exact: true })
      .fill("E2E");
    await addEmployeeSection
      .getByPlaceholder("Téléphone")
      .fill("+212600000777");

    /*
     * L'UI utilise l'apostrophe typographique U+2019 :
     * "Ajouter l’employée".
     * Ce regexp accepte à la fois ’ et ' pour éviter un test fragile.
     */
    const addButton = addEmployeeSection.getByRole("button", {
      name: /ajouter l[’']employée/i,
    });

    await expect(addButton).toBeVisible();
    await expect(addButton).toBeEnabled();
    await addButton.click();

    await expect
      .poll(
        async () =>
          testPrisma.employee.count({
            where: {
              salonId: s.salon.id,
              firstName: "Nora",
              lastName: "E2E",
            },
          }),
        { timeout: 15_000 },
      )
      .toBe(1);

    await expect(page.locator("body")).toContainText(/employée ajoutée/i);
  });

  test("la gérante ajoute une salle de soins", async ({ page }) => {
    const s = await createBaseE2EContext();

    await loginAsAdmin(page);
    await page.goto("/rooms");

    const addSection = page
      .locator("section")
      .filter({ hasText: "Ajouter une salle" })
      .first();

    await addSection.getByPlaceholder("Nom").fill("Salle E2E 3");
    await addSection.locator("select").selectOption("TREATMENT_ROOM");
    await addSection.locator('input[type="number"]').fill("1");
    await addSection.getByRole("button", { name: /^Ajouter$/i }).click();

    await expect
      .poll(
        async () =>
          testPrisma.room.count({
            where: {
              salonId: s.salon.id,
              name: "Salle E2E 3",
              type: "TREATMENT_ROOM",
            },
          }),
        { timeout: 15_000 },
      )
      .toBe(1);
  });

  test("la gérante ajoute un Hamam", async ({ page }) => {
    const s = await createBaseE2EContext();

    await loginAsAdmin(page);
    await page.goto("/rooms");

    const addSection = page
      .locator("section")
      .filter({ hasText: "Ajouter une salle" })
      .first();

    await addSection.getByPlaceholder("Nom").fill("Hamam E2E 3");
    await addSection.locator("select").selectOption("HAMAM");
    await addSection.locator('input[type="number"]').fill("1");
    await addSection.getByRole("button", { name: /^Ajouter$/i }).click();

    await expect
      .poll(
        async () =>
          testPrisma.room.count({
            where: {
              salonId: s.salon.id,
              name: "Hamam E2E 3",
              type: "HAMAM",
            },
          }),
        { timeout: 15_000 },
      )
      .toBe(1);
  });
});
