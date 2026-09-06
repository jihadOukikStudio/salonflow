import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";

import { updateAppointmentSchedule } from "@/server/services/appointments/update-appointment-schedule";

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

      /*
       * Le RDV démarre à 10h.
       * On essayera de le déplacer à 14h.
       */
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

          assignedEmployeeId: employee.id,

          roomId: room.id,
        },
      },
    },
  });

  return {
    salon,
    currentUser,
    adminUser,
    employee,
    room,
    appointment,
  };
}

describe("update appointment schedule concurrency", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("allows only one of appointment move or overlapping employee unavailability to win", async () => {
    const context = await createContext();

    const targetStart = new Date("2026-09-10T14:00:00.000Z");

    const targetEnd = new Date("2026-09-10T15:00:00.000Z");

    const results = await Promise.allSettled([
      updateAppointmentSchedule(context.currentUser, {
        appointmentId: context.appointment.id,

        scheduledStart: targetStart,
      }),

      createEmployeeUnavailability(context.currentUser, {
        employeeId: context.employee.id,

        type: "ABSENCE",
        startAt: targetStart,
        endAt: targetEnd,
      }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);

    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);

    const storedAppointment = await testPrisma.appointment.findUnique({
      where: {
        id: context.appointment.id,
      },
    });

    const unavailabilityCount = await testPrisma.employeeUnavailability.count({
      where: {
        employeeId: context.employee.id,

        startAt: {
          lt: targetEnd,
        },

        endAt: {
          gt: targetStart,
        },
      },
    });

    const moved =
      storedAppointment?.scheduledStart.getTime() === targetStart.getTime();

    const unavailable = unavailabilityCount === 1;

    expect(Number(moved) + Number(unavailable)).toBe(1);
  });

  it("allows only one of appointment move or overlapping room unavailability to win", async () => {
    const context = await createContext();

    const targetStart = new Date("2026-09-10T14:00:00.000Z");

    const targetEnd = new Date("2026-09-10T15:00:00.000Z");

    const results = await Promise.allSettled([
      updateAppointmentSchedule(context.currentUser, {
        appointmentId: context.appointment.id,

        scheduledStart: targetStart,
      }),

      createRoomUnavailability(context.currentUser, {
        roomId: context.room.id,

        startAt: targetStart,
        endAt: targetEnd,

        reason: "Maintenance",
      }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);

    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);

    const storedAppointment = await testPrisma.appointment.findUnique({
      where: {
        id: context.appointment.id,
      },
    });

    const unavailabilityCount = await testPrisma.roomUnavailability.count({
      where: {
        roomId: context.room.id,

        startAt: {
          lt: targetEnd,
        },

        endAt: {
          gt: targetStart,
        },
      },
    });

    const moved =
      storedAppointment?.scheduledStart.getTime() === targetStart.getTime();

    const unavailable = unavailabilityCount === 1;

    expect(Number(moved) + Number(unavailable)).toBe(1);
  });
});
