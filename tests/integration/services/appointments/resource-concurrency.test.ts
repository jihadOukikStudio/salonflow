import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";
import { assignEmployeeToService } from "@/server/services/appointments/assign-employee-to-service";
import { assignRoomToService } from "@/server/services/appointments/assign-room-to-service";
import { BusinessRuleError } from "@/server/services/errors";

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
      firstName: "Amina",
    },
  });

  const room = await testPrisma.room.create({
    data: {
      salonId: salon.id,
      name: "Salle de soins 1",
      type: "TREATMENT_ROOM",
      capacity: 1,
    },
  });

  const clientA = await testPrisma.client.create({
    data: {
      salonId: salon.id,
      name: "Cliente A",
      phone: "+212600001001",
    },
  });

  const clientB = await testPrisma.client.create({
    data: {
      salonId: salon.id,
      name: "Cliente B",
      phone: "+212600001002",
    },
  });

  const appointmentA = await testPrisma.appointment.create({
    data: {
      salonId: salon.id,
      clientId: clientA.id,
      scheduledStart: new Date("2026-09-10T10:00:00.000Z"),
      estimatedDurationMinutes: 60,
      createdByUserId: user.id,

      services: {
        create: {
          serviceNameSnapshot: "Massage A",
          durationMinutes: 60,
          price: 350,
          requiredRoomTypeSnapshot: "TREATMENT_ROOM",
        },
      },
    },

    include: {
      services: true,
    },
  });

  const appointmentB = await testPrisma.appointment.create({
    data: {
      salonId: salon.id,
      clientId: clientB.id,
      scheduledStart: new Date("2026-09-10T10:30:00.000Z"),
      estimatedDurationMinutes: 60,
      createdByUserId: user.id,

      services: {
        create: {
          serviceNameSnapshot: "Massage B",
          durationMinutes: 60,
          price: 350,
          requiredRoomTypeSnapshot: "TREATMENT_ROOM",
        },
      },
    },

    include: {
      services: true,
    },
  });

  const serviceA = appointmentA.services[0];
  const serviceB = appointmentB.services[0];

  if (!serviceA || !serviceB) {
    throw new Error("Appointment services were not created.");
  }

  const currentUser: CurrentUser = {
    id: user.id,
    salonId: salon.id,
    role: user.role,
    canManageSalon: user.canManageSalon,
    isActive: true,
  };

  return {
    salon,
    user,
    employee,
    room,
    currentUser,
    serviceA,
    serviceB,
  };
}

describe("resource assignment concurrency", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("allows only one overlapping appointment to claim the same employee concurrently", async () => {
    const context = await createContext();

    const results = await Promise.allSettled([
      assignEmployeeToService(context.currentUser, {
        appointmentServiceId: context.serviceA.id,
        employeeId: context.employee.id,
      }),

      assignEmployeeToService(context.currentUser, {
        appointmentServiceId: context.serviceB.id,
        employeeId: context.employee.id,
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");

    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rejectedResult = rejected[0];

    expect(rejectedResult?.status).toBe("rejected");

    if (rejectedResult?.status === "rejected") {
      expect(rejectedResult.reason).toBeInstanceOf(BusinessRuleError);
    }

    const assignedServices = await testPrisma.appointmentService.count({
      where: {
        assignedEmployeeId: context.employee.id,
      },
    });

    expect(assignedServices).toBe(1);
  });

  it("allows only one overlapping appointment to claim the same room concurrently", async () => {
    const context = await createContext();

    const results = await Promise.allSettled([
      assignRoomToService(context.currentUser, {
        appointmentServiceId: context.serviceA.id,
        roomId: context.room.id,
      }),

      assignRoomToService(context.currentUser, {
        appointmentServiceId: context.serviceB.id,
        roomId: context.room.id,
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");

    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rejectedResult = rejected[0];

    expect(rejectedResult?.status).toBe("rejected");

    if (rejectedResult?.status === "rejected") {
      expect(rejectedResult.reason).toBeInstanceOf(BusinessRuleError);
    }

    const assignedServices = await testPrisma.appointmentService.count({
      where: {
        roomId: context.room.id,
      },
    });

    expect(assignedServices).toBe(1);
  });
});
