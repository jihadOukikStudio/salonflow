import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { CurrentUser } from "@/server/permissions";
import { BusinessRuleError } from "@/server/services/errors";
import {
  createEmployeeUnavailability,
  createRoomUnavailability,
} from "@/server/services/unavailability";
import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

async function createContext() {
  const salon = await testPrisma.salon.create({
    data: { name: `Salon ${crypto.randomUUID()}` },
  });
  const admin = await testPrisma.user.create({
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
    data: { salonId: salon.id, firstName: "Sara" },
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
      phone: `+2126${Math.floor(Math.random() * 1_000_000_00)
        .toString()
        .padStart(8, "0")}`,
    },
  });
  const currentUser: CurrentUser = {
    id: admin.id,
    salonId: salon.id,
    role: "ADMIN",
    canManageSalon: true,
    isActive: true,
  };
  return { salon, admin, employee, room, client, currentUser };
}

describe("Phase 10 unavailability", () => {
  beforeEach(async () => cleanDatabase());
  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("creates an employee unavailability", async () => {
    const c = await createContext();
    const item = await createEmployeeUnavailability(c.currentUser, {
      employeeId: c.employee.id,
      type: "ABSENCE",
      startAt: new Date("2026-09-20T09:00:00.000Z"),
      endAt: new Date("2026-09-20T10:00:00.000Z"),
    });
    expect(item.employeeId).toBe(c.employee.id);
  });

  it("rejects an employee unavailability overlapping an assigned appointment", async () => {
    const c = await createContext();
    const appointment = await testPrisma.appointment.create({
      data: {
        salonId: c.salon.id,
        clientId: c.client.id,
        scheduledStart: new Date("2026-09-20T09:00:00.000Z"),
        estimatedDurationMinutes: 60,
        createdByUserId: c.admin.id,
      },
    });
    const category = await testPrisma.serviceCategory.create({
      data: { salonId: c.salon.id, name: `Cat ${crypto.randomUUID()}` },
    });
    const service = await testPrisma.service.create({
      data: {
        salonId: c.salon.id,
        categoryId: category.id,
        name: `Service ${crypto.randomUUID()}`,
        defaultDurationMinutes: 60,
        defaultPrice: 100,
      },
    });
    await testPrisma.appointmentService.create({
      data: {
        appointmentId: appointment.id,
        serviceId: service.id,
        serviceNameSnapshot: service.name,
        durationMinutes: 60,
        price: 100,
        assignedEmployeeId: c.employee.id,
      },
    });
    await expect(
      createEmployeeUnavailability(c.currentUser, {
        employeeId: c.employee.id,
        type: "ABSENCE",
        startAt: new Date("2026-09-20T09:30:00.000Z"),
        endAt: new Date("2026-09-20T10:30:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("creates a room unavailability", async () => {
    const c = await createContext();
    const item = await createRoomUnavailability(c.currentUser, {
      roomId: c.room.id,
      startAt: new Date("2026-09-20T12:00:00.000Z"),
      endAt: new Date("2026-09-20T13:00:00.000Z"),
      reason: "Maintenance",
    });
    expect(item.roomId).toBe(c.room.id);
  });
});
