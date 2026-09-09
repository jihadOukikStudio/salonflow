import { expect, test } from "@playwright/test";

import { loginAsEmployee } from "../helpers/auth";
import { createBaseE2EContext, testPrisma } from "../helpers/db";

test.describe("Ma journée employée", () => {
  test.beforeEach(async () => {
    await createBaseE2EContext();
  });

  test("une employée standard arrive directement sur Ma journée", async ({
    page,
  }) => {
    await loginAsEmployee(page);

    await expect(page).toHaveURL(/\/my-day$/);
    await expect(
      page.getByRole("heading", { name: /Bonjour Amina/i }),
    ).toBeVisible();
    await expect(
      page.getByText("Ma journée", { exact: true }).first(),
    ).toBeVisible();
  });

  test("affiche les prestations affectées à l'employée", async ({ page }) => {
    const employee = await testPrisma.employee.findFirstOrThrow({
      where: { firstName: "Amina" },
      include: { user: true },
    });
    const salon = await testPrisma.salon.findFirstOrThrow();
    const client = await testPrisma.client.findFirstOrThrow();

    await testPrisma.appointment.create({
      data: {
        salonId: salon.id,
        clientId: client.id,
        scheduledStart: new Date(),
        estimatedDurationMinutes: 30,
        createdByUserId: employee.userId!,
        services: {
          create: {
            serviceNameSnapshot: "Brushing mobile",
            durationMinutes: 30,
            price: 180,
            assignedEmployeeId: employee.id,
          },
        },
      },
    });

    await loginAsEmployee(page);

    await expect(page.getByText("Brushing mobile").first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Planning complet/i }),
    ).toBeVisible();
  });
});
