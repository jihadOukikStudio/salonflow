import { expect, test } from "@playwright/test";
import { createAppointmentScenario } from "../helpers/db";
import { loginAsAdmin, loginAsEmployee } from "../helpers/auth";

test.describe("Phase 12.6 — dashboard et calendrier", () => {
  test("la gérante accède au dashboard financier", async ({ page }) => {
    await createAppointmentScenario();
    await loginAsAdmin(page);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /bonjour/i })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /encaissements/i }),
    ).toBeVisible();
    await expect(page.getByText(/aujourd’hui/i).first()).toBeVisible();
  });

  test("le dashboard propose la création rapide en haut via la popup du planning", async ({
    page,
  }) => {
    await createAppointmentScenario();
    await loginAsAdmin(page);
    await page.goto("/dashboard");

    await page.getByRole("link", { name: /voir le planning/i }).click();
    await page.getByRole("link", { name: /nouveau rendez-vous/i }).click();
    await expect(page).toHaveURL(/\/planning.*new=1/);
    await expect(
      page.getByRole("dialog", { name: /nouveau rendez-vous/i }),
    ).toBeVisible();
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

  test("le planning expose la vue principale par employée", async ({
    page,
  }) => {
    await createAppointmentScenario();
    await loginAsAdmin(page);
    await page.goto("/planning");
    await expect(
      page.getByRole("link", { name: /planning/i }).first(),
    ).toBeVisible();
    await expect(page.getByText(/une colonne par employée/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /employées/i })).toHaveCount(0);
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
    await page.goto(
      `/planning?date=${yesterdayKey}&view=planning&period=day&new=1`,
    );

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

    await page.goto(
      `/planning?date=${yesterdayKey}&view=planning&period=day&new=1`,
    );
    await expect(
      page.getByRole("dialog", { name: "Création impossible" }),
    ).toBeVisible();
    await expect(page.getByText(/cette date est déjà passée/i)).toBeVisible();
  });

  test("un rendez-vous futur ouvert depuis le planning conserve la date", async ({
    page,
  }) => {
    await createAppointmentScenario();
    await loginAsAdmin(page);

    const tomorrowKey = dateKey(1);
    await page.goto(`/planning?date=${tomorrowKey}&view=planning&period=day`);
    await page.getByRole("link", { name: /nouveau rendez-vous/i }).click();

    const dialog = page.getByRole("dialog", { name: "Nouveau rendez-vous" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('input[type="date"]')).toHaveValue(tomorrowKey);
    await expect(dialog.getByText(/pas de 15 min/i)).toBeVisible();
  });

  test("la création permet de rechercher ou créer une cliente puis d’ajouter une prestation", async ({
    page,
  }) => {
    await createAppointmentScenario();
    await loginAsAdmin(page);

    const tomorrowKey = dateKey(1);
    await page.goto(
      `/planning?date=${tomorrowKey}&view=planning&period=day&new=1`,
    );
    const dialog = page.getByRole("dialog", { name: "Nouveau rendez-vous" });

    const search = dialog.getByPlaceholder(/rechercher par nom ou téléphone/i);
    await search.fill("Cliente Design E2E");
    await expect(
      dialog.getByText("Nouvelle cliente", { exact: true }),
    ).toBeVisible();
    await dialog
      .getByRole("textbox", { name: "Téléphone", exact: true })
      .fill("0612345678");
    await expect(
      dialog.getByRole("button", { name: /ajouter une prestation/i }).first(),
    ).toBeVisible();
  });

  test("les écrans de structure restent accessibles depuis le parcours gérante", async ({
    page,
  }) => {
    await createAppointmentScenario();
    await loginAsAdmin(page);

    await page.goto("/employees");
    await expect(page.getByRole("heading", { name: /équipe/i })).toBeVisible();

    await page.goto("/employees/unavailability");
    await expect(
      page.getByRole("heading", { name: /indisponibilités équipe/i }),
    ).toBeVisible();

    await page.goto("/rooms");
    await expect(page.getByRole("heading", { name: /salles/i })).toBeVisible();

    await page.goto("/services");
    await expect(
      page.getByRole("heading", { name: /prestations/i }),
    ).toBeVisible();
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
