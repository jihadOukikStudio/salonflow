import { expect, test } from "@playwright/test";

import {
  createAppointmentScenario,
  createSecondAppointment,
  testPrisma,
} from "../helpers/db";
import { loginAsAdmin } from "../helpers/auth";
import { organizationCard } from "../helpers/ui";

test.describe("Phase 12.8 — concurrence réelle navigateur", () => {
  test("deux navigateurs ne peuvent pas prendre la même dernière employée sur deux RDV chevauchants", async ({
    browser,
  }) => {
    const s = await createAppointmentScenario({
      assignedEmployeeId: null,
      roomId: null,
      requiredRoomType: null,
    });

    const second = await createSecondAppointment(s, {
      scheduledStart: s.appointment.scheduledStart,
      assignedEmployeeId: null,
      requiredRoomType: null,
    });

    const start = s.appointment.scheduledStart;
    const end = new Date(start.getTime() + 60 * 60_000);

    await testPrisma.employeeUnavailability.createMany({
      data: [
        {
          employeeId: s.sara.id,
          type: "ABSENCE",
          startAt: start,
          endAt: end,
          createdByUserId: s.adminUser.id,
        },
        {
          employeeId: s.lina.id,
          type: "ABSENCE",
          startAt: start,
          endAt: end,
          createdByUserId: s.adminUser.id,
        },
      ],
    });

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await loginAsAdmin(pageA);
      await loginAsAdmin(pageB);

      await Promise.all([pageA.goto("/organize"), pageB.goto("/organize")]);

      const selectA = organizationCard(pageA, "Soin visage E2E")
        .locator("select")
        .first();
      const selectB = organizationCard(pageB, "Deuxième prestation E2E")
        .locator("select")
        .first();

      await Promise.allSettled([
        selectA.selectOption(s.amina.id),
        selectB.selectOption(s.amina.id),
      ]);

      await expect
        .poll(
          async () => {
            const rows = await testPrisma.appointmentService.findMany({
              where: {
                id: { in: [s.appointmentService.id, second.services[0]!.id] },
                assignedEmployeeId: s.amina.id,
              },
            });
            return rows.length;
          },
          { timeout: 15_000 },
        )
        .toBe(1);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("deux navigateurs ne peuvent pas prendre la même salle sur deux RDV chevauchants", async ({
    browser,
  }) => {
    const s = await createAppointmentScenario({
      assignedEmployeeId: null,
      roomId: null,
    });

    const second = await createSecondAppointment(s, {
      scheduledStart: s.appointment.scheduledStart,
      assignedEmployeeId: null,
      requiredRoomType: "TREATMENT_ROOM",
      roomId: null,
    });

    await testPrisma.roomUnavailability.create({
      data: {
        roomId: s.treatmentRoom2.id,
        startAt: s.appointment.scheduledStart,
        endAt: new Date(s.appointment.scheduledStart.getTime() + 60 * 60_000),
        reason: "E2E",
        createdByUserId: s.adminUser.id,
      },
    });

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await loginAsAdmin(pageA);
      await loginAsAdmin(pageB);

      await Promise.all([pageA.goto("/organize"), pageB.goto("/organize")]);

      const selectA = organizationCard(pageA, "Soin visage E2E")
        .locator("select")
        .last();
      const selectB = organizationCard(pageB, "Deuxième prestation E2E")
        .locator("select")
        .last();

      await Promise.allSettled([
        selectA.selectOption(s.treatmentRoom1.id),
        selectB.selectOption(s.treatmentRoom1.id),
      ]);

      await expect
        .poll(
          async () => {
            const rows = await testPrisma.appointmentService.findMany({
              where: {
                id: { in: [s.appointmentService.id, second.services[0]!.id] },
                roomId: s.treatmentRoom1.id,
              },
            });
            return rows.length;
          },
          { timeout: 15_000 },
        )
        .toBe(1);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
