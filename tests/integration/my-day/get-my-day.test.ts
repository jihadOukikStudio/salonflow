import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { getMyDay } from "@/features/my-day/server";
import type { CurrentUser } from "@/server/permissions";

import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

async function createContext() {
  const salon = await testPrisma.salon.create({
    data: { name: "Salon My Day" },
  });
  const user = await testPrisma.user.create({
    data: {
      salonId: salon.id,
      email: `employee-${crypto.randomUUID()}@test.local`,
      passwordHash: "test-hash",
      firstName: "Amina",
      role: "EMPLOYEE",
      isActive: true,
    },
  });
  const employee = await testPrisma.employee.create({
    data: { salonId: salon.id, userId: user.id, firstName: "Amina" },
  });
  const other = await testPrisma.employee.create({
    data: { salonId: salon.id, firstName: "Sara" },
  });
  const client = await testPrisma.client.create({
    data: { salonId: salon.id, name: "Cliente Test", phone: "+212600001111" },
  });
  const category = await testPrisma.serviceCategory.create({
    data: { salonId: salon.id, name: "Catégorie" },
  });
  const service = await testPrisma.service.create({
    data: {
      salonId: salon.id,
      categoryId: category.id,
      name: "Manucure",
      defaultDurationMinutes: 30,
      defaultPrice: 150,
    },
  });
  await testPrisma.employeeSkill.create({
    data: { employeeId: employee.id, serviceId: service.id },
  });

  const currentUser: CurrentUser = {
    id: user.id,
    salonId: salon.id,
    role: "EMPLOYEE",
    canManageSalon: false,
    isActive: true,
  };

  return { salon, user, employee, other, client, service, currentUser };
}

describe("getMyDay", () => {
  beforeEach(cleanDatabase);
  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("returns only services assigned to the connected employee", async () => {
    const context = await createContext();

    await testPrisma.appointment.create({
      data: {
        salonId: context.salon.id,
        clientId: context.client.id,
        scheduledStart: new Date("2026-09-09T11:00:00.000Z"),
        estimatedDurationMinutes: 30,
        createdByUserId: context.user.id,
        services: {
          create: [
            {
              serviceId: context.service.id,
              serviceNameSnapshot: "Manucure Amina",
              durationMinutes: 30,
              price: 150,
              assignedEmployeeId: context.employee.id,
            },
            {
              serviceId: context.service.id,
              serviceNameSnapshot: "Manucure Sara",
              durationMinutes: 30,
              price: 150,
              assignedEmployeeId: context.other.id,
            },
          ],
        },
      },
    });

    const data = await getMyDay(context.currentUser, "2026-09-09");

    expect(data?.services).toHaveLength(1);
    expect(data?.services[0]?.serviceName).toBe("Manucure Amina");
  });

  it("lists compatible unassigned services as takeable candidates", async () => {
    const context = await createContext();

    await testPrisma.appointment.create({
      data: {
        salonId: context.salon.id,
        clientId: context.client.id,
        scheduledStart: new Date("2026-09-09T12:00:00.000Z"),
        estimatedDurationMinutes: 30,
        createdByUserId: context.user.id,
        services: {
          create: {
            serviceId: context.service.id,
            serviceNameSnapshot: "Manucure libre",
            durationMinutes: 30,
            price: 150,
          },
        },
      },
    });

    const data = await getMyDay(context.currentUser, "2026-09-09");

    expect(data?.takeableServices).toHaveLength(1);
    expect(data?.takeableServices[0]?.serviceName).toBe("Manucure libre");
  });
});
