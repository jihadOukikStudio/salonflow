import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { findNextAvailableSlotsInDb } from "@/server/services/appointments/find-next-available-slots";

import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

describe("findNextAvailableSlotsInDb", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("ne propose pas de créneau quand le blocage est structurel", async () => {
    const salon = await testPrisma.salon.create({
      data: { name: "Salon" },
    });

    const category = await testPrisma.serviceCategory.create({
      data: {
        salonId: salon.id,
        name: "Coiffure",
      },
    });

    const service = await testPrisma.service.create({
      data: {
        salonId: salon.id,
        categoryId: category.id,
        name: "Brushing",
        defaultPrice: 100,
        defaultDurationMinutes: 60,
        isActive: true,
      },
    });

    const result = await testPrisma.$transaction((tx) =>
      findNextAvailableSlotsInDb(tx, {
        salonId: salon.id,
        scheduledStart: new Date("2035-01-02T15:00:00.000Z"),
        serviceIds: [service.id],
      }),
    );

    expect(result).toEqual([]);
  });

  it("ne renvoie jamais plus de trois alternatives", async () => {
    const salon = await testPrisma.salon.create({
      data: { name: "Salon" },
    });

    const employee = await testPrisma.employee.create({
      data: {
        salonId: salon.id,
        firstName: "Amina",
        isActive: true,
      },
    });

    const category = await testPrisma.serviceCategory.create({
      data: {
        salonId: salon.id,
        name: "Coiffure",
      },
    });

    const service = await testPrisma.service.create({
      data: {
        salonId: salon.id,
        categoryId: category.id,
        name: "Brushing",
        defaultPrice: 100,
        defaultDurationMinutes: 60,
        isActive: true,
      },
    });

    await testPrisma.employeeSkill.create({
      data: {
        employeeId: employee.id,
        serviceId: service.id,
      },
    });

    const result = await testPrisma.$transaction((tx) =>
      findNextAvailableSlotsInDb(tx, {
        salonId: salon.id,
        scheduledStart: new Date("2035-01-02T15:00:00.000Z"),
        serviceIds: [service.id],
      }),
    );

    expect(result.length).toBeLessThanOrEqual(3);
  });
});
