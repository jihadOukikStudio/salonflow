import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { BusinessRuleError } from "@/server/services/errors";
import { validateEmployeeAvailability } from "@/server/services/resources/validate-employee-availability";
import { validateRoomAvailability } from "@/server/services/resources/validate-room-availability";

import { cleanDatabase } from "../../helpers/database";
import { testPrisma } from "../../helpers/prisma";

async function createContext() {
  const salon = await testPrisma.salon.create({
    data: {
      name: `Salon ${crypto.randomUUID()}`,
    },
  });

  const user = await testPrisma.user.create({
    data: {
      salonId: salon.id,
      email: `${crypto.randomUUID()}@test.local`,
      passwordHash: "test-hash",
      firstName: "Admin",
      role: "ADMIN",
      canManageSalon: true,
    },
  });

  const employee = await testPrisma.employee.create({
    data: {
      salonId: salon.id,
      userId: user.id,
      firstName: "Amina",
    },
  });

  const room = await testPrisma.room.create({
    data: {
      salonId: salon.id,
      name: `Salle ${crypto.randomUUID()}`,
      type: "TREATMENT_ROOM",
      capacity: 1,
    },
  });

  const client = await testPrisma.client.create({
    data: {
      salonId: salon.id,
      phone: `+212${crypto.randomUUID().replaceAll("-", "").slice(0, 9)}`,
    },
  });

  return {
    salon,
    user,
    employee,
    room,
    client,
  };
}

describe("availability validators", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("accepts an available employee", async () => {
    const context = await createContext();

    await expect(
      testPrisma.$transaction((tx) =>
        validateEmployeeAvailability(tx, {
          salonId: context.salon.id,
          employeeId: context.employee.id,
          scheduledStart: new Date("2026-09-10T10:00:00.000Z"),
          estimatedDurationMinutes: 60,
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects an employee unavailability overlap", async () => {
    const context = await createContext();

    await testPrisma.employeeUnavailability.create({
      data: {
        employeeId: context.employee.id,
        type: "ABSENCE",
        startAt: new Date("2026-09-10T10:30:00.000Z"),
        endAt: new Date("2026-09-10T11:30:00.000Z"),
        createdByUserId: context.user.id,
      },
    });

    await expect(
      testPrisma.$transaction((tx) =>
        validateEmployeeAvailability(tx, {
          salonId: context.salon.id,
          employeeId: context.employee.id,
          scheduledStart: new Date("2026-09-10T10:00:00.000Z"),
          estimatedDurationMinutes: 60,
        }),
      ),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("accepts an available room", async () => {
    const context = await createContext();

    await expect(
      testPrisma.$transaction((tx) =>
        validateRoomAvailability(tx, {
          salonId: context.salon.id,
          roomId: context.room.id,
          scheduledStart: new Date("2026-09-10T10:00:00.000Z"),
          estimatedDurationMinutes: 60,
          requiredRoomType: "TREATMENT_ROOM",
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects a room unavailability overlap", async () => {
    const context = await createContext();

    await testPrisma.roomUnavailability.create({
      data: {
        roomId: context.room.id,
        startAt: new Date("2026-09-10T10:30:00.000Z"),
        endAt: new Date("2026-09-10T11:30:00.000Z"),
        reason: "Maintenance",
        createdByUserId: context.user.id,
      },
    });

    await expect(
      testPrisma.$transaction((tx) =>
        validateRoomAvailability(tx, {
          salonId: context.salon.id,
          roomId: context.room.id,
          scheduledStart: new Date("2026-09-10T10:00:00.000Z"),
          estimatedDurationMinutes: 60,
          requiredRoomType: "TREATMENT_ROOM",
        }),
      ),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });
});
