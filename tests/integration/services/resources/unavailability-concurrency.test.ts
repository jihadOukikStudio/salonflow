import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";

import { assignEmployeeToService } from "@/server/services/appointments/assign-employee-to-service";
import { assignRoomToService } from "@/server/services/appointments/assign-room-to-service";

import { createEmployeeUnavailability } from "@/server/services/employees/create-employee-unavailability";
import { createRoomUnavailability } from "@/server/services/rooms/create-room-unavailability";

import { cleanDatabase } from "../../helpers/database";
import { testPrisma } from "../../helpers/prisma";

async function createContext() {
  const salon = await testPrisma.salon.create({
    data: {
      name: `Salon ${crypto.randomUUID()}`,
    },
  });

  const adminUser = await testPrisma.user.create({
    data: {
      salonId: salon.id,
      email: `${crypto.randomUUID()}@test.local`,
      passwordHash: "test-hash",
      firstName: "Admin",
      role: "ADMIN",
      canManageSalon: true,
    },
  });

  const currentUser: CurrentUser = {
    id: adminUser.id,
    salonId: salon.id,
    role: adminUser.role,
    canManageSalon: adminUser.canManageSalon,
    isActive: adminUser.isActive,
  };

  const employeeUser = await testPrisma.user.create({
    data: {
      salonId: salon.id,
      email: `${crypto.randomUUID()}@test.local`,
      passwordHash: "test-hash",
      firstName: "Amina",
      role: "EMPLOYEE",
    },
  });

  const employee = await testPrisma.employee.create({
    data: {
      salonId: salon.id,
      userId: employeeUser.id,
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

  const appointment = await testPrisma.appointment.create({
    data: {
      salonId: salon.id,
      clientId: client.id,

      scheduledStart: new Date("2026-09-10T10:00:00.000Z"),

      estimatedDurationMinutes: 60,
      status: "PLANNED",

      createdByUserId: adminUser.id,

      services: {
        create: {
          serviceNameSnapshot: "Soin visage",
          durationMinutes: 60,
          price: 250,

          requiredRoomTypeSnapshot: "TREATMENT_ROOM",
        },
      },
    },

    include: {
      services: true,
    },
  });

  const service = appointment.services[0];

  if (!service) {
    throw new Error("La prestation de test n'a pas été créée.");
  }

  return {
    salon,
    adminUser,
    currentUser,
    employee,
    room,
    appointment,
    service,
  };
}

describe("resource unavailability concurrency", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("allows only one of employee assignment or overlapping employee unavailability to win", async () => {
    const context = await createContext();

    const results = await Promise.allSettled([
      assignEmployeeToService(context.currentUser, {
        appointmentServiceId: context.service.id,
        employeeId: context.employee.id,
      }),

      createEmployeeUnavailability(context.currentUser, {
        employeeId: context.employee.id,
        type: "ABSENCE",

        startAt: new Date("2026-09-10T10:00:00.000Z"),

        endAt: new Date("2026-09-10T11:00:00.000Z"),
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");

    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const persistedService = await testPrisma.appointmentService.findUnique({
      where: {
        id: context.service.id,
      },
    });

    const unavailabilityCount = await testPrisma.employeeUnavailability.count({
      where: {
        employeeId: context.employee.id,
      },
    });

    /*
     * État final cohérent :
     *
     * soit affectation,
     * soit indisponibilité,
     * jamais les deux.
     */
    const employeeAssigned =
      persistedService?.assignedEmployeeId === context.employee.id;

    const employeeUnavailable = unavailabilityCount === 1;

    expect(Number(employeeAssigned) + Number(employeeUnavailable)).toBe(1);
  });

  it("allows only one of room assignment or overlapping room unavailability to win", async () => {
    const context = await createContext();

    const results = await Promise.allSettled([
      assignRoomToService(context.currentUser, {
        appointmentServiceId: context.service.id,
        roomId: context.room.id,
      }),

      createRoomUnavailability(context.currentUser, {
        roomId: context.room.id,

        startAt: new Date("2026-09-10T10:00:00.000Z"),

        endAt: new Date("2026-09-10T11:00:00.000Z"),
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");

    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const persistedService = await testPrisma.appointmentService.findUnique({
      where: {
        id: context.service.id,
      },
    });

    const unavailabilityCount = await testPrisma.roomUnavailability.count({
      where: {
        roomId: context.room.id,
      },
    });

    const roomAssigned = persistedService?.roomId === context.room.id;

    const roomUnavailable = unavailabilityCount === 1;

    expect(Number(roomAssigned) + Number(roomUnavailable)).toBe(1);
  });
});
