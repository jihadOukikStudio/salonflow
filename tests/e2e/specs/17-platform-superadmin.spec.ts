import { expect, test, type Page } from "@playwright/test";
import { hash } from "bcryptjs";
import {
  createBaseE2EContext,
  testPrisma,
  E2E_PASSWORD,
  ADMIN_EMAIL,
} from "../helpers/db";
const SUPER_EMAIL = "platform.e2e@salonflow.test";
async function login(page: Page, email = SUPER_EMAIL) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(E2E_PASSWORD);
  await page.getByRole("button", { name: /se connecter|connexion/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
test.beforeEach(async () => {
  await createBaseE2EContext();
  await testPrisma.user.create({
    data: {
      role: "SUPER_ADMIN",
      salonId: null,
      firstName: "Jihad",
      email: SUPER_EMAIL,
      passwordHash: await hash(E2E_PASSWORD, 4),
    },
  });
});
test("superadmin dashboard, onboarding and activation", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/superadmin$/);
  await expect(
    page.getByRole("heading", { name: "Vos salons, en un regard." }),
  ).toBeVisible();
  await page.goto("/superadmin/salons");
  const create = page
    .getByRole("heading", { name: "Ajouter un salon" })
    .locator("..");
  await create.getByLabel("Nom du salon").fill("Salon démonstration");
  await create.getByRole("button", { name: "Créer le salon" }).click();
  await expect(page.getByText(/Salon créé en préparation/)).toBeVisible();
  await page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { name: "Salon démonstration" }) })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Salon démonstration" }),
  ).toBeVisible();
  await page.getByText("Ajouter une gérante", { exact: true }).click();
  const manager = page
    .locator("form")
    .filter({ has: page.locator('input[value="createManager"]') });
  await manager.getByLabel("Prénom", { exact: true }).fill("Amina");
  await manager
    .getByLabel("Email", { exact: true })
    .fill("amina.new@salonflow.test");
  await manager
    .getByLabel("Mot de passe — 12 caractères minimum", { exact: true })
    .fill(E2E_PASSWORD);
  await manager
    .getByLabel("Confirmer le mot de passe", { exact: true })
    .fill(E2E_PASSWORD);
  await manager
    .getByRole("button", { name: "Créer le compte gérante" })
    .click();
  await expect(
    page.getByText("amina.new@salonflow.test", { exact: true }),
  ).toBeVisible();
  const state = page
    .locator("form")
    .filter({ has: page.locator('input[value="salonStatus"]') });
  await state.getByLabel("Nouvel état").selectOption("ACTIVE");
  await state.getByLabel("Motif").fill("Ouverture du pilote");
  await state.getByLabel(/Recopiez le nom/).fill("Salon démonstration");
  await state
    .getByRole("button", { name: "Confirmer le changement d’état" })
    .click();
  await expect(state.getByRole("status")).toBeVisible();
  expect(
    await testPrisma.salon.findFirst({
      where: { name: "Salon démonstration" },
    }),
  ).toMatchObject({ isActive: true });
});
test("salon administrators cannot enter platform pages", async ({ page }) => {
  await login(page, ADMIN_EMAIL);
  await page.goto("/superadmin");
  await expect(page).toHaveURL(/\/planning/);
  await expect(
    page.getByRole("heading", { name: "Ajouter un salon" }),
  ).toHaveCount(0);
});
test("gérante can report a problem and cannot see internal platform notes", async ({
  page,
}) => {
  await login(page, ADMIN_EMAIL);
  await page.goto("/support");
  await page.getByLabel("Sujet").fill("Planning bloqué");
  await page
    .getByLabel("Que se passe-t-il ?")
    .fill("Le planning ne s’ouvre plus.");
  await page.getByRole("button", { name: "Envoyer la demande" }).click();
  await expect(
    page.getByRole("heading", { name: "Planning bloqué" }),
  ).toBeVisible();
  const incident = await testPrisma.platformIncident.findFirstOrThrow();
  const admin = await testPrisma.user.findFirstOrThrow({
    where: { email: SUPER_EMAIL },
  });
  await testPrisma.platformIncidentMessage.create({
    data: {
      incidentId: incident.id,
      authorId: admin.id,
      internal: true,
      body: "NOTE INTERNE CONFIDENTIELLE",
    },
  });
  await page.reload();
  await expect(page.getByText("NOTE INTERNE CONFIDENTIELLE")).toHaveCount(0);
});
test("security page clearly states MFA is deferred and revokes the current session", async ({
  page,
}) => {
  await login(page);
  await page.goto("/superadmin/securite");
  await expect(
    page.getByText(
      "Double authentification : non configurée dans cette version.",
    ),
  ).toBeVisible();
  await page.getByLabel("Motif").fill("Fin de test");
  await page
    .getByRole("button", { name: "Déconnecter toutes mes sessions" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Session indisponible" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retour à la connexion" }).click();
  await expect(page).toHaveURL(/\/login/);
});
test("dashboard remains usable on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Vos salons, en un regard." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("shared login has no pilot branding and revenue controls are readable", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByText("Le 7ème Sens Marrakech", { exact: true }),
  ).toHaveCount(0);
  await login(page);
  await page.goto("/superadmin/revenus");
  await expect(
    page.getByRole("heading", { name: "Vos revenus SalonFlow" }),
  ).toBeVisible();
  await page.getByLabel("Mois des encaissements").fill("2026-09");
  await page.getByRole("button", { name: "Afficher les revenus" }).click();
  await expect(page).toHaveURL(/month=2026-09/);
  await expect(
    page.getByText("Base mensuelle actuelle", { exact: true }),
  ).toBeVisible();
});
test("schedule a due and find its date and status", async ({ page }) => {
  await login(page);
  await page.goto("/superadmin/echeances");
  // Scope to the creation form; use the accessible combobox name instead of
  // exact textContent of a wrapping label, which can include its options.
  const form = page.locator("form").filter({
    has: page.getByRole("button", { name: "Ajouter l’échéance", exact: true }),
  });
  await form
    .getByRole("combobox", { name: "Salon concerné", exact: true })
    .selectOption({ label: "SalonFlow E2E" });
  await form
    .getByLabel("Libellé", { exact: true })
    .fill("Abonnement test octobre");
  await form.getByLabel("Date limite", { exact: true }).fill("2026-10-05");
  await form
    .getByRole("spinbutton", { name: "Montant attendu", exact: true })
    .fill("250");
  const currency = form.getByRole("combobox", { name: "Devise", exact: true });
  await expect(currency).toBeVisible();
  await currency.selectOption("MAD");
  await expect(currency).toHaveValue("MAD");
  await form
    .getByRole("button", { name: "Ajouter l’échéance", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Abonnement test octobre" }),
  ).toBeVisible();
  await expect(page.getByText(/Date limite : 5 oct/)).toBeVisible();
  const due = await testPrisma.subscriptionDue.findFirstOrThrow({
    where: { title: "Abonnement test octobre" },
    include: { salon: true },
  });
  expect(due.currency).toBe("MAD");
  expect(due.amount.toString()).toBe("250");
  expect(due.dueAt.toISOString()).toBe("2026-10-05T00:00:00.000Z");
  expect(due.salon.name).toBe("SalonFlow E2E");
});
