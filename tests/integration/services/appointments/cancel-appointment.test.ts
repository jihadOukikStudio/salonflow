import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";

import { cancelAppointment } from "@/server/services/appointments/cancel-appointment";

import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

import { cleanDatabase } from "../../helpers/database";
import { testPrisma } from "../../helpers/prisma";

async function createContext(
  status:
    | "PLANNED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CLOSED"
    | "CANCELLED" = "PLANNED",
) {
  const salon = await testPrisma.salon.create({
    data: {
      name: `Salon ${crypto.randomUUID()}`,
    },
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

  const currentUser: CurrentUser = {
    id: admin.id,
    salonId: salon.id,
    role: admin.role,
    canManageSalon: admin.canManageSalon,
    isActive: admin.isActive,
  };

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

      status,

      createdByUserId: admin.id,

      ...(status === "CANCELLED"
        ? {
            cancelledAt: new Date(),
            cancelledByUserId: admin.id,
          }
        : {}),

      services: {
        create: {
          serviceNameSnapshot: "Brushing",
          durationMinutes: 60,
          price: 100,
        },
      },
    },
  });

  return {
    salon,
    admin,
    currentUser,
    appointment,
  };
}

describe("cancelAppointment", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("cancels a planned appointment", async () => {
    const context = await createContext();

    const result = await cancelAppointment(context.currentUser, {
      appointmentId: context.appointment.id,
    });

    expect(result.status).toBe("CANCELLED");

    expect(result.cancelledAt).not.toBeNull();

    expect(result.cancelledByUserId).toBe(context.admin.id);
  });

  it("persists cancellation information", async () => {
    const context = await createContext();

    await cancelAppointment(context.currentUser, {
      appointmentId: context.appointment.id,
    });

    const stored = await testPrisma.appointment.findUnique({
      where: {
        id: context.appointment.id,
      },
    });

    expect(stored?.status).toBe("CANCELLED");

    expect(stored?.cancelledAt).not.toBeNull();

    expect(stored?.cancelledByUserId).toBe(context.admin.id);
  });

  it.each(["IN_PROGRESS", "COMPLETED", "CLOSED", "CANCELLED"] as const)(
    "rejects appointment status %s",
    async (status) => {
      const context = await createContext(status);

      await expect(
        cancelAppointment(context.currentUser, {
          appointmentId: context.appointment.id,
        }),
      ).rejects.toBeInstanceOf(BusinessRuleError);
    },
  );

  it("does not expose another salon appointment", async () => {
    const contextA = await createContext();

    const contextB = await createContext();

    await expect(
      cancelAppointment(contextA.currentUser, {
        appointmentId: contextB.appointment.id,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("creates an activity log", async () => {
    const context = await createContext();

    await cancelAppointment(context.currentUser, {
      appointmentId: context.appointment.id,
    });

    const log = await testPrisma.activityLog.findFirst({
      where: {
        salonId: context.salon.id,

        userId: context.admin.id,

        entityId: context.appointment.id,

        action: "APPOINTMENT_CANCELLED",
      },
    });

    expect(log).not.toBeNull();

    expect(log?.entityType).toBe("APPOINTMENT");
  });

  it("allows only one concurrent cancellation", async () => {
    const context = await createContext();

    const results = await Promise.allSettled([
      cancelAppointment(context.currentUser, {
        appointmentId: context.appointment.id,
      }),

      cancelAppointment(context.currentUser, {
        appointmentId: context.appointment.id,
      }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);

    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);

    const stored = await testPrisma.appointment.findUnique({
      where: {
        id: context.appointment.id,
      },
    });

    expect(stored?.status).toBe("CANCELLED");

    const logCount = await testPrisma.activityLog.count({
      where: {
        salonId: context.salon.id,

        entityId: context.appointment.id,

        action: "APPOINTMENT_CANCELLED",
      },
    });

    expect(logCount).toBe(1);
  });
});
