import { expect, test } from "@playwright/test";

import {
  createAppointmentScenario,
  createSecondAppointment,
  testPrisma,
} from "../helpers/db";
import { loginAsAdmin, loginAsEmployee } from "../helpers/auth";
import { organizationCard } from "../helpers/ui";

test.describe("Phase 12.2 — Organisation et disponibilités", () => {
  test("n'affiche pas une employée absente ni une salle indisponible", async ({
    page,
  }) => {
    const s = await createAppointmentScenario({
      assignedEmployeeId: null,
      roomId: null,
    });

    const start = s.appointment.scheduledStart;
    const end = new Date(start.getTime() + 60 * 60_000);

    await testPrisma.employeeUnavailability.create({
      data: {
        employeeId: s.sara.id,
        type: "ABSENCE",
        startAt: start,
        endAt: end,
        createdByUserId: s.adminUser.id,
      },
    });

    await testPrisma.roomUnavailability.create({
      data: {
        roomId: s.treatmentRoom1.id,
        startAt: start,
        endAt: end,
        reason: "E2E",
        createdByUserId: s.adminUser.id,
      },
    });

    await loginAsAdmin(page);
    await page.goto("/organize");

    const card = organizationCard(page, "Soin visage E2E");
    const employeeSelect = card.locator("select").first();
    const roomSelect = card.locator("select").last();

    await expect(employeeSelect).toContainText("Amina");
    await expect(employeeSelect).toContainText("Lina");
    await expect(employeeSelect).not.toContainText("Sara");

    await expect(roomSelect).toContainText("Salle de soins 2");
    await expect(roomSelect).not.toContainText("Salle de soins 1");
    await expect(roomSelect).not.toContainText("Hamam");
  });

  test("la gérante affecte une employée depuis Organisation", async ({
    page,
  }) => {
    const s = await createAppointmentScenario({
      assignedEmployeeId: null,
      roomId: null,
    });

    await loginAsAdmin(page);
    await page.goto("/organize");

    const card = organizationCard(page, "Soin visage E2E");
    await card.locator("select").first().selectOption(s.sara.id);

    await expect
      .poll(
        async () => {
          const row = await testPrisma.appointmentService.findUnique({
            where: { id: s.appointmentService.id },
            select: { assignedEmployeeId: true },
          });
          return row?.assignedEmployeeId;
        },
        { timeout: 15_000 },
      )
      .toBe(s.sara.id);

    await expect(card.locator("select").first()).toHaveValue(s.sara.id);
    await expect(card).toContainText("Sara");
  });

  test("la gérante affecte une salle depuis Organisation", async ({ page }) => {
    const s = await createAppointmentScenario({
      assignedEmployeeId: null,
      roomId: null,
    });

    await loginAsAdmin(page);
    await page.goto("/organize");

    const card = organizationCard(page, "Soin visage E2E");
    await card.locator("select").last().selectOption(s.treatmentRoom2.id);

    await expect
      .poll(
        async () => {
          const row = await testPrisma.appointmentService.findUnique({
            where: { id: s.appointmentService.id },
            select: { roomId: true },
          });
          return row?.roomId;
        },
        { timeout: 15_000 },
      )
      .toBe(s.treatmentRoom2.id);
  });

  test("Je prends affecte à l'employée connectée", async ({ page }) => {
    const s = await createAppointmentScenario({
      assignedEmployeeId: null,
      roomId: null,
    });

    await loginAsEmployee(page);
    await page.goto("/organize");

    const card = organizationCard(page, "Soin visage E2E");
    await card.getByRole("button", { name: /je prends/i }).click();

    await expect
      .poll(
        async () => {
          const row = await testPrisma.appointmentService.findUnique({
            where: { id: s.appointmentService.id },
            select: { assignedEmployeeId: true },
          });
          return row?.assignedEmployeeId;
        },
        { timeout: 15_000 },
      )
      .toBe(s.amina.id);
  });

  test("Je prends disparaît si l'employée connectée est indisponible", async ({
    page,
  }) => {
    const s = await createAppointmentScenario({
      assignedEmployeeId: null,
      roomId: null,
    });

    await testPrisma.employeeUnavailability.create({
      data: {
        employeeId: s.amina.id,
        type: "ABSENCE",
        startAt: s.appointment.scheduledStart,
        endAt: new Date(s.appointment.scheduledStart.getTime() + 60 * 60_000),
        createdByUserId: s.adminUser.id,
      },
    });

    await loginAsEmployee(page);
    await page.goto("/organize");

    const card = organizationCard(page, "Soin visage E2E");
    await expect(card.getByRole("button", { name: /je prends/i })).toHaveCount(
      0,
    );
    await expect(card.locator("select").first()).not.toContainText("Amina");
  });

  test("une employée occupée sur un autre RDV n'est pas proposée", async ({
    page,
  }) => {
    const s = await createAppointmentScenario({
      assignedEmployeeId: null,
      roomId: null,
    });

    await createSecondAppointment(s, {
      scheduledStart: s.appointment.scheduledStart,
      assignedEmployeeId: s.sara.id,
    });

    await loginAsAdmin(page);
    await page.goto("/organize");

    const card = organizationCard(page, "Soin visage E2E");
    await expect(card.locator("select").first()).not.toContainText("Sara");
  });

  test("une salle occupée sur un autre RDV n'est pas proposée", async ({
    page,
  }) => {
    const s = await createAppointmentScenario({
      assignedEmployeeId: null,
      roomId: null,
    });

    await createSecondAppointment(s, {
      scheduledStart: s.appointment.scheduledStart,
      requiredRoomType: "TREATMENT_ROOM",
      roomId: s.treatmentRoom1.id,
    });

    await loginAsAdmin(page);
    await page.goto("/organize");

    const card = organizationCard(page, "Soin visage E2E");
    const roomSelect = card.locator("select").last();
    await expect(roomSelect).not.toContainText("Salle de soins 1");
    await expect(roomSelect).toContainText("Salle de soins 2");
  });

  test("une ressource utilisée juste avant reste disponible à la frontière", async ({
    page,
  }) => {
    const s = await createAppointmentScenario({
      assignedEmployeeId: null,
      roomId: null,
    });

    await createSecondAppointment(s, {
      scheduledStart: new Date(
        s.appointment.scheduledStart.getTime() - 60 * 60_000,
      ),
      durationMinutes: 60,
      assignedEmployeeId: s.sara.id,
      requiredRoomType: "TREATMENT_ROOM",
      roomId: s.treatmentRoom1.id,
    });

    await loginAsAdmin(page);
    await page.goto("/organize");

    const card = organizationCard(page, "Soin visage E2E");
    await expect(card.locator("select").first()).toContainText("Sara");
    await expect(card.locator("select").last()).toContainText(
      "Salle de soins 1",
    );
  });

  test("un RDV annulé ne bloque plus ses ressources", async ({ page }) => {
    const s = await createAppointmentScenario({
      assignedEmployeeId: null,
      roomId: null,
    });

    const cancelled = await createSecondAppointment(s, {
      scheduledStart: s.appointment.scheduledStart,
      assignedEmployeeId: s.sara.id,
      requiredRoomType: "TREATMENT_ROOM",
      roomId: s.treatmentRoom1.id,
    });

    await testPrisma.appointment.update({
      where: { id: cancelled.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledByUserId: s.adminUser.id,
      },
    });

    await loginAsAdmin(page);
    await page.goto("/organize");

    const card = organizationCard(page, "Soin visage E2E");
    await expect(card.locator("select").first()).toContainText("Sara");
    await expect(card.locator("select").last()).toContainText(
      "Salle de soins 1",
    );
  });

  test("une prestation Hamam ne propose jamais une salle de soins", async ({
    page,
  }) => {
    await createAppointmentScenario({
      assignedEmployeeId: null,
      roomId: null,
      requiredRoomType: "HAMAM",
      serviceId: null,
      serviceName: "Hamam E2E",
      price: 250,
    });

    await loginAsAdmin(page);
    await page.goto("/organize");

    const card = organizationCard(page, "Hamam E2E");
    await expect(card).toBeVisible();

    const roomSelect = card.locator("select").last();
    await expect(roomSelect).toBeVisible();
    await expect(roomSelect).toContainText("Hamam individuel");
    await expect(roomSelect).toContainText("Hamam duo");
    await expect(roomSelect).not.toContainText("Salle de soins");
  });
  test("affiche le compteur Organisation dans la navigation et le met à jour", async ({
    page,
  }) => {
    const s = await createAppointmentScenario({
      assignedEmployeeId: null,
      roomId: null,
    });

    await loginAsAdmin(page);
    await page.goto("/planning");

    // Organisation V2 compte les décisions manquantes :
    // employée + salle = 2 points à régler.
    await expect(page.getByLabel("2 éléments à organiser")).toBeVisible();

    await page.goto("/organize");
    let card = organizationCard(page, "Soin visage E2E");
    await card.locator("select").first().selectOption(s.sara.id);

    await expect(page.getByLabel("1 élément à organiser")).toBeVisible();

    card = organizationCard(page, "Soin visage E2E");
    await card.locator("select").last().selectOption(s.treatmentRoom2.id);

    await expect(page.getByLabel(/élément.*à organiser/i)).toHaveCount(0);

    // Une fois les deux décisions prises, la prestation doit rester visible
    // dans la zone "Organisé" : Organisation V2 ne la fait plus disparaître.
    await expect
      .poll(async () => {
        const service = await testPrisma.appointmentService.findUnique({
          where: { id: s.appointmentService.id },
          select: {
            assignedEmployeeId: true,
            roomId: true,
          },
        });

        return service;
      })
      .toEqual({
        assignedEmployeeId: s.sara.id,
        roomId: s.treatmentRoom2.id,
      });

    await expect(page.getByText(/organisé/i).first()).toBeVisible();
    await expect(organizationCard(page, "Soin visage E2E")).toBeVisible();
  });
});
