import { expect, test } from "@playwright/test";

import { createAppointmentScenario } from "../helpers/db";
import { loginAsAdmin, loginAsEmployee } from "../helpers/auth";

test.describe("Recette non-régression — accès, erreurs et PWA", () => {
  test("les routes métier protégées redirigent un utilisateur non connecté", async ({
    page,
  }) => {
    for (const route of [
      "/planning",
      "/organize",
      "/dashboard",
      "/clients",
      "/services",
      "/employees",
      "/rooms",
    ]) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("une employée standard ne peut pas administrer la structure", async ({
    page,
  }) => {
    await createAppointmentScenario();
    await loginAsEmployee(page);

    for (const route of ["/employees", "/services", "/rooms", "/clients"]) {
      await page.goto(route);
      await expect(page).not.toHaveURL(new RegExp(`${route}$`));
    }
  });

  test("aucune erreur console/page critique sur le parcours principal gérante", async ({
    page,
  }) => {
    const s = await createAppointmentScenario();
    const errors: string[] = [];

    page.on("pageerror", (error) => {
      errors.push(`pageerror: ${error.message}`);
    });

    page.on("console", (message) => {
      if (message.type() === "error") {
        const text = message.text();
        // Les erreurs réseau d'assets dev peuvent être transitoires ;
        // on garde uniquement les erreurs applicatives significatives.
        if (!/favicon|source map|webpack-hmr/i.test(text)) {
          errors.push(`console: ${text}`);
        }
      }
    });

    await loginAsAdmin(page);

    for (const route of [
      "/planning",
      "/organize",
      `/appointments/${s.appointment.id}`,
      "/dashboard",
    ]) {
      await page.goto(route);
      await expect(page.locator("body")).not.toContainText(
        /application error|internal server error/i,
      );
    }

    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("manifest PWA et service worker sont servis", async ({ request }) => {
    const manifestCandidates = ["/manifest.webmanifest", "/manifest.json"];
    let manifestOk = false;

    for (const path of manifestCandidates) {
      const response = await request.get(path);
      if (response.ok()) {
        manifestOk = true;
        const contentType = response.headers()["content-type"] ?? "";
        expect(contentType).toMatch(/json|manifest/i);
        break;
      }
    }

    expect(manifestOk).toBe(true);

    const sw = await request.get("/sw.js");
    expect(sw.ok()).toBe(true);
    expect(await sw.text()).toContain("salonflow");
  });

  test("le détail conserve les informations essentielles du rendez-vous", async ({
    page,
  }) => {
    const s = await createAppointmentScenario();

    await loginAsAdmin(page);
    await page.goto(`/appointments/${s.appointment.id}`);

    await expect(page.locator("body")).toContainText("Cliente E2E");
    await expect(page.locator("body")).toContainText("Soin visage E2E");
    await expect(page.locator("body")).toContainText("Amina");
    await expect(page.locator("body")).toContainText("Salle de soins 1");
    await expect(page.locator("body")).toContainText(/300/);
  });
});
