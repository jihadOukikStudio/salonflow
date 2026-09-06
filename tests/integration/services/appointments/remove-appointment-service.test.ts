import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";

import { removeAppointmentService } from "@/server/services/appointments/remove-appointment-service";

import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

import { cleanDatabase } from "../../helpers/database";
import { testPrisma } from "../../helpers/prisma";

async function createContext(params?: {
  appointmentStatus?:
    "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CLOSED" | "CANCELLED";

  secondServiceStatus?: "TODO" | "IN_PROGRESS" | "DONE";

  onlyOneService?: boolean;
}) {
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

  const client = await testPrisma.client.create({
    data: {
      salonId: salon.id,
      phone: `+212${crypto.randomUUID().replaceAll("-", "").slice(0, 9)}`,
    },
  });

  const secondStatus = params?.secondServiceStatus ?? "TODO";

  const startedAt =
    secondStatus === "TODO" ? null : new Date(Date.now() - 10 * 60 * 1000);

  const finishedAt =
    secondStatus === "DONE" ? new Date(Date.now() - 5 * 60 * 1000) : null;

  const employeeUser =
    secondStatus === "TODO"
      ? null
      : await testPrisma.user.create({
          data: {
            salonId: salon.id,
            email: `${crypto.randomUUID()}@test.local`,
            passwordHash: "test-hash",
            firstName: "Amina",
            role: "EMPLOYEE",
          },
        });

  const employee =
    employeeUser === null
      ? null
      : await testPrisma.employee.create({
          data: {
            salonId: salon.id,
            userId: employeeUser.id,
            firstName: "Amina",
          },
        });

  const appointment = await testPrisma.appointment.create({
    data: {
      salonId: salon.id,
      clientId: client.id,

      scheduledStart: new Date("2026-09-10T10:00:00.000Z"),

      estimatedDurationMinutes: params?.onlyOneService ? 60 : 90,

      status: params?.appointmentStatus ?? "PLANNED",

      createdByUserId: adminUser.id,

      services: {
        create: [
          {
            serviceNameSnapshot: "Brushing",
            durationMinutes: 60,
            price: 100,
            status: "TODO",
          },

          ...(params?.onlyOneService
            ? []
            : [
                {
                  serviceNameSnapshot: "Manucure",
                  durationMinutes: 30,
                  price: 150,

                  status: secondStatus,

                  assignedEmployeeId: employee?.id ?? null,

                  performedByEmployeeId:
                    secondStatus === "TODO" ? null : employee?.id,

                  actualStartedAt: startedAt,

                  actualFinishedAt: finishedAt,
                },
              ]),
        ],
      },
    },

    include: {
      services: true,
    },
  });

  return {
    salon,
    adminUser,
    currentUser,
    appointment,
  };
}

describe("removeAppointmentService", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("removes a TODO service and recalculates duration", async () => {
    const context = await createContext();

    const serviceToRemove = context.appointment.services[1];

    if (!serviceToRemove) {
      throw new Error("Prestation de test manquante.");
    }

    const result = await removeAppointmentService(context.currentUser, {
      appointmentServiceId: serviceToRemove.id,
    });

    expect(result.services).toHaveLength(1);

    expect(result.estimatedDurationMinutes).toBe(60);

    expect(
      result.services.some((service) => service.id === serviceToRemove.id),
    ).toBe(false);
  });

  it("rejects removal of the last service", async () => {
    const context = await createContext({
      onlyOneService: true,
    });

    const service = context.appointment.services[0];

    if (!service) {
      throw new Error("Prestation de test manquante.");
    }

    await expect(
      removeAppointmentService(context.currentUser, {
        appointmentServiceId: service.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it.each(["IN_PROGRESS", "DONE"] as const)(
    "does not remove a service with status %s",
    async (status) => {
      const context = await createContext({
        appointmentStatus:
          status === "IN_PROGRESS" ? "IN_PROGRESS" : "IN_PROGRESS",

        secondServiceStatus: status,
      });

      const service = context.appointment.services[1];

      if (!service) {
        throw new Error("Prestation de test manquante.");
      }

      await expect(
        removeAppointmentService(context.currentUser, {
          appointmentServiceId: service.id,
        }),
      ).rejects.toBeInstanceOf(BusinessRuleError);
    },
  );

  it.each(["COMPLETED", "CLOSED", "CANCELLED"] as const)(
    "rejects appointment status %s",
    async (status) => {
      const context = await createContext({
        appointmentStatus: status,
      });

      const service = context.appointment.services[1];

      if (!service) {
        throw new Error("Prestation de test manquante.");
      }

      await expect(
        removeAppointmentService(context.currentUser, {
          appointmentServiceId: service.id,
        }),
      ).rejects.toBeInstanceOf(BusinessRuleError);
    },
  );

  it("does not expose another salon service", async () => {
    const contextA = await createContext();

    const contextB = await createContext();

    const foreignService = contextB.appointment.services[1];

    if (!foreignService) {
      throw new Error("Prestation de test manquante.");
    }

    await expect(
      removeAppointmentService(contextA.currentUser, {
        appointmentServiceId: foreignService.id,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("creates an activity log", async () => {
    const context = await createContext();

    const service = context.appointment.services[1];

    if (!service) {
      throw new Error("Prestation de test manquante.");
    }

    await removeAppointmentService(context.currentUser, {
      appointmentServiceId: service.id,
    });

    const log = await testPrisma.activityLog.findFirst({
      where: {
        salonId: context.salon.id,

        action: "APPOINTMENT_SERVICE_REMOVED",

        entityId: service.id,
      },
    });

    expect(log).not.toBeNull();
  });

  it("allows only one concurrent removal of the same service", async () => {
    const context = await createContext();

    const service = context.appointment.services[1];

    if (!service) {
      throw new Error("Prestation de test manquante.");
    }

    const results = await Promise.allSettled([
      removeAppointmentService(context.currentUser, {
        appointmentServiceId: service.id,
      }),

      removeAppointmentService(context.currentUser, {
        appointmentServiceId: service.id,
      }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);

    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);

    const appointment = await testPrisma.appointment.findUnique({
      where: {
        id: context.appointment.id,
      },

      include: {
        services: true,
      },
    });

    expect(appointment?.services).toHaveLength(1);

    expect(appointment?.estimatedDurationMinutes).toBe(60);
  });
});
