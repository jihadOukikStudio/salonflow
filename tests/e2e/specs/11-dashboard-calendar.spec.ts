import { expect, test } from "@playwright/test";
import { createAppointmentScenario } from "../helpers/db";
import { loginAsAdmin, loginAsEmployee } from "../helpers/auth";

test.describe("Phase 12.6 — dashboard et calendrier", () => {
  test("la gérante accède au dashboard financier", async ({ page }) => {
    await createAppointmentScenario();
    await loginAsAdmin(page);
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /état du salon/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /activité financière/i }),
    ).toBeVisible();
    await expect(page.getByText(/aujourd’hui/i).first()).toBeVisible();
  });

  test("l'employée standard est redirigée vers le planning", async ({
    page,
  }) => {
    await createAppointmentScenario();
    await loginAsEmployee(page);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/planning/);
    await expect(
      page.getByRole("heading", { name: /activité financière/i }),
    ).toHaveCount(0);
  });

  test("le planning expose les trois vues calendrier", async ({ page }) => {
    await createAppointmentScenario();
    await loginAsAdmin(page);
    await page.goto("/planning");
    await expect(
      page.getByRole("link", { name: /planning/i }).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /employées/i })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /salles/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/la hauteur des blocs représente la durée/i),
    ).toBeVisible();
  });
});

test.describe("Lot 1 — création depuis le planning", () => {
  const dateKey = (offsetDays: number) => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Casablanca",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(
      new Date(Date.now() + offsetDays * 24 * 60 * 60_000),
    );
  };

  test("le planning historique reste consultable mais la création sur une date passée est bloquée", async ({
    page,
  }) => {
    await createAppointmentScenario();
    await loginAsAdmin(page);

    const yesterdayKey = dateKey(-1);
    await page.goto("/planning?view=planning&period=day");
    await page.getByRole("link", { name: "Période précédente" }).click();

    await expect(page).toHaveURL(new RegExp(`date=${yesterdayKey}`));
    await page.getByRole("link", { name: /nouveau rendez-vous/i }).click();

    await expect(
      page.getByRole("dialog", { name: "Création impossible" }),
    ).toBeVisible();
    await expect(page.getByText(/cette date est déjà passée/i)).toBeVisible();
  });

  test("le calendrier central permet de consulter une date passée puis bloque seulement la création", async ({
    page,
  }) => {
    await createAppointmentScenario();
    await loginAsAdmin(page);

    const yesterdayKey = dateKey(-1);
    const [year, month, day] = yesterdayKey.split("-").map(Number);
    const yesterdayLabel = new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day, 12)));

    await page.goto("/planning?view=planning&period=day");
    await page.getByRole("button", { name: /choisir une date/i }).click();

    const calendar = page.getByRole("dialog", { name: "Choisir une date" });
    await expect(calendar).toBeVisible();

    // Si hier se trouve dans le mois précédent, la grille de 42 jours l'affiche
    // quand même : on sélectionne donc directement sa date accessible.
    await calendar.getByRole("button", { name: yesterdayLabel }).click();

    await expect(page).toHaveURL(new RegExp(`date=${yesterdayKey}`));
    await expect(
      page.getByRole("button", { name: /choisir une date/i }),
    ).toContainText(new RegExp(String(day)));

    await page.getByRole("link", { name: /nouveau rendez-vous/i }).click();
    await expect(
      page.getByRole("dialog", { name: "Création impossible" }),
    ).toBeVisible();
    await expect(page.getByText(/cette date est déjà passée/i)).toBeVisible();
  });

  test("un rendez-vous futur créé depuis le bouton conserve la date et prend le premier horaire légal", async ({
    page,
  }) => {
    await createAppointmentScenario();
    await loginAsAdmin(page);

    const tomorrowKey = dateKey(1);
    await page.goto(`/planning?date=${tomorrowKey}&view=planning&period=day`);
    await page.getByRole("link", { name: /nouveau rendez-vous/i }).click();

    await expect(
      page.getByRole("dialog", { name: "Nouveau rendez-vous" }),
    ).toBeVisible();

    await page.getByLabel("Téléphone").fill("0612345678");
    await page.getByLabel(/Nom/).fill("Cliente E2E");
    await page.getByRole("button", { name: "Continuer" }).click();

    await expect(page.getByLabel("Date du rendez-vous")).toHaveValue(
      tomorrowKey,
    );
    await expect(page.getByLabel("Heure du rendez-vous")).toHaveValue("10:00");
  });

  test("un créneau futur ouvre la popup avec des horaires de 15 minutes et les catégories pliables", async ({
    page,
  }) => {
    await createAppointmentScenario();
    await loginAsAdmin(page);

    const tomorrowKey = dateKey(1);
    await page.goto(`/planning?date=${tomorrowKey}&view=planning&period=day`);
    await page
      .getByRole("link", { name: "Créer un rendez-vous à 10:00" })
      .click();

    await expect(
      page.getByRole("dialog", { name: "Nouveau rendez-vous" }),
    ).toBeVisible();

    await page.getByLabel("Téléphone").fill("0612345678");
    await page.getByLabel(/Nom/).fill("Cliente E2E");
    await page.getByRole("button", { name: "Continuer" }).click();

    await expect(page.getByLabel("Date du rendez-vous")).toHaveValue(
      tomorrowKey,
    );
    await expect(page.getByLabel("Heure du rendez-vous")).toHaveValue("10:00");

    await page
      .getByRole("button", { name: /choisir l’heure du rendez-vous/i })
      .click();
    const timeDialog = page.getByRole("dialog", {
      name: "Choisir l'heure du rendez-vous",
    });
    await expect(timeDialog).toBeVisible();

    const timeButtons = timeDialog.locator("button[aria-pressed]");
    const labels = await timeButtons.allTextContents();
    const options = labels
      .map((label) => label.trim().match(/\d{2}:\d{2}/)?.[0])
      .filter((value): value is string => Boolean(value));

    expect(options.length).toBeGreaterThan(0);
    expect(
      options.every((value) => {
        const [hour, minute] = value.split(":").map(Number);
        const total = hour * 60 + minute;
        return total >= 10 * 60 && total <= 21 * 60 && minute % 15 === 0;
      }),
    ).toBe(true);

    const categories = page.locator("details");
    expect(await categories.count()).toBeGreaterThan(0);
    await expect(categories.first()).not.toHaveAttribute("open", "");
  });

  test("la création utilise un calendrier SalonFlow et une grille horaire, sans contrôles natifs visibles", async ({
    page,
  }) => {
    await createAppointmentScenario();
    await loginAsAdmin(page);

    const tomorrowKey = dateKey(1);
    await page.goto(`/planning?date=${tomorrowKey}&view=planning&period=day`);
    await page.getByRole("link", { name: /nouveau rendez-vous/i }).click();

    await page.getByLabel("Téléphone").fill("0612345678");
    await page.getByLabel(/Nom/).fill("Cliente Design");
    await page.getByRole("button", { name: "Continuer" }).click();

    await page
      .getByRole("button", { name: /choisir la date du rendez-vous/i })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Choisir la date du rendez-vous" }),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: /choisir l’heure du rendez-vous/i })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Choisir l'heure du rendez-vous" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("dialog", { name: "Choisir l'heure du rendez-vous" })
        .getByRole("button", { name: /10:15/ }),
    ).toBeVisible();
  });

  test("les sections volumineuses sont pliables pour limiter le scroll", async ({
    page,
  }) => {
    await createAppointmentScenario();
    await loginAsAdmin(page);

    await page.goto("/employees");
    await expect(
      page
        .locator("details")
        .filter({ hasText: "Compétences prestations" })
        .first(),
    ).toBeVisible();

    await page.goto("/employees/unavailability");
    await expect(page.locator("details").first()).toBeVisible();

    await page.goto("/rooms");
    await expect(
      page.locator("details").filter({ hasText: "Indisponibilités" }).first(),
    ).toBeVisible();

    await page.goto("/services");
    await expect(page.locator("details").first()).toBeVisible();
  });
});

test.describe("Lot 2 — navigation temporelle du planning", () => {
  test("le planning du jour propose un accès direct à Maintenant", async ({
    page,
  }) => {
    await createAppointmentScenario();
    await loginAsAdmin(page);
    await page.goto("/planning?view=planning&period=day");

    const nowLink = page.getByRole("link", { name: "Maintenant" });
    await expect(nowLink).toBeVisible();
    await expect(nowLink).toHaveAttribute("href", "#planning-now");
  });

  test("une date historique propose de revenir à Aujourd'hui sans bloquer la consultation", async ({
    page,
  }) => {
    await createAppointmentScenario();
    await loginAsAdmin(page);
    await page.goto("/planning?date=2024-01-15&view=planning&period=day");

    await expect(page).toHaveURL(/date=2024-01-15/);
    await expect(page.getByRole("link", { name: "Aujourd’hui" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Maintenant" })).toHaveCount(0);
  });
});
