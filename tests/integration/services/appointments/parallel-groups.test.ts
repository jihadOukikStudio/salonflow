import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";

import { createParallelGroup } from "@/server/services/appointments/create-parallel-group";
import { removeParallelGroup } from "@/server/services/appointments/remove-parallel-group";

import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

import { cleanDatabase } from "../../helpers/database";
import { testPrisma } from "../../helpers/prisma";

async function createUser(
  salonId: string,
  params?: {
    role?: "ADMIN" | "EMPLOYEE";
    canManageSalon?: boolean;
  },
) {
  const user = await testPrisma.user.create({
    data: {
      salonId,

      email: `${crypto.randomUUID()}@test.local`,

      passwordHash: "test-hash",

      firstName: "Utilisateur",

      role: params?.role ?? "EMPLOYEE",

      canManageSalon: params?.canManageSalon ?? false,
    },
  });

  const currentUser: CurrentUser = {
    id: user.id,
    salonId: user.salonId,
    role: user.role,

    canManageSalon: user.canManageSalon,

    isActive: user.isActive,
  };

  return {
    user,
    currentUser,
  };
}

async function createContext() {
  const salon = await testPrisma.salon.create({
    data: {
      name: `Salon ${crypto.randomUUID()}`,
    },
  });

  const admin = await createUser(salon.id, {
    role: "ADMIN",
    canManageSalon: true,
  });

  const standardEmployee = await createUser(salon.id, {
    role: "EMPLOYEE",
    canManageSalon: false,
  });

  const client = await testPrisma.client.create({
    data: {
      salonId: salon.id,

      name: "Cliente",

      phone: `+212${crypto.randomUUID().replaceAll("-", "").slice(0, 9)}`,
    },
  });

  /*
   * Durée sans parallélisme :
   *
   * 60 + 45 + 30 = 135 minutes.
   */
  const appointment = await testPrisma.appointment.create({
    data: {
      salonId: salon.id,
      clientId: client.id,

      scheduledStart: new Date("2026-09-10T10:00:00.000Z"),

      estimatedDurationMinutes: 135,

      status: "PLANNED",

      createdByUserId: admin.user.id,

      services: {
        create: [
          {
            serviceNameSnapshot: "Brushing",

            durationMinutes: 60,
            price: 100,
          },

          {
            serviceNameSnapshot: "Manucure",

            durationMinutes: 45,
            price: 150,
          },

          {
            serviceNameSnapshot: "Pédicure",

            durationMinutes: 30,
            price: 150,
          },
        ],
      },
    },

    include: {
      services: true,
    },
  });

  const service60 = appointment.services.find(
    (service) => service.durationMinutes === 60,
  );

  const service45 = appointment.services.find(
    (service) => service.durationMinutes === 45,
  );

  const service30 = appointment.services.find(
    (service) => service.durationMinutes === 30,
  );

  if (!service60 || !service45 || !service30) {
    throw new Error("Les prestations du contexte de test sont manquantes.");
  }

  return {
    salon,
    admin,
    standardEmployee,
    client,
    appointment,
    service60,
    service45,
    service30,
  };
}

describe("parallel groups", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("creates a parallel group and recalculates duration", async () => {
    const context = await createContext();

    /*
     * 45 + 30 en parallèle => 45
     *
     * 60 + 45 = 105.
     */
    const result = await createParallelGroup(context.admin.currentUser, {
      appointmentId: context.appointment.id,

      appointmentServiceIds: [context.service45.id, context.service30.id],
    });

    expect(result.estimatedDurationMinutes).toBe(105);

    expect(result.parallelGroups).toHaveLength(1);

    expect(result.parallelGroups[0]?.services).toHaveLength(2);
  });

  it("uses the longest duration in the group", async () => {
    const context = await createContext();

    /*
     * 60 + 45 parallèles => 60
     * + 30 hors groupe => 90.
     */
    const result = await createParallelGroup(context.admin.currentUser, {
      appointmentId: context.appointment.id,

      appointmentServiceIds: [context.service60.id, context.service45.id],
    });

    expect(result.estimatedDurationMinutes).toBe(90);
  });

  it("allows a responsible employee", async () => {
    const context = await createContext();

    const responsible = await createUser(context.salon.id, {
      role: "EMPLOYEE",
      canManageSalon: true,
    });

    const result = await createParallelGroup(responsible.currentUser, {
      appointmentId: context.appointment.id,

      appointmentServiceIds: [context.service45.id, context.service30.id],
    });

    expect(result.parallelGroups).toHaveLength(1);
  });

  it("rejects a standard employee", async () => {
    const context = await createContext();

    await expect(
      createParallelGroup(context.standardEmployee.currentUser, {
        appointmentId: context.appointment.id,

        appointmentServiceIds: [context.service45.id, context.service30.id],
      }),
    ).rejects.toThrow();
  });

  it("requires at least two services", async () => {
    const context = await createContext();

    await expect(
      createParallelGroup(context.admin.currentUser, {
        appointmentId: context.appointment.id,

        appointmentServiceIds: [context.service45.id],
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects duplicate service ids", async () => {
    const context = await createContext();

    await expect(
      createParallelGroup(context.admin.currentUser, {
        appointmentId: context.appointment.id,

        appointmentServiceIds: [context.service45.id, context.service45.id],
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("does not accept a service from another appointment", async () => {
    const contextA = await createContext();

    const contextB = await createContext();

    await expect(
      createParallelGroup(contextA.admin.currentUser, {
        appointmentId: contextA.appointment.id,

        appointmentServiceIds: [contextA.service45.id, contextB.service30.id],
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("does not expose another salon appointment", async () => {
    const contextA = await createContext();

    const contextB = await createContext();

    await expect(
      createParallelGroup(contextA.admin.currentUser, {
        appointmentId: contextB.appointment.id,

        appointmentServiceIds: [contextB.service45.id, contextB.service30.id],
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("prevents the same service from belonging to two groups", async () => {
    const context = await createContext();

    await createParallelGroup(context.admin.currentUser, {
      appointmentId: context.appointment.id,

      appointmentServiceIds: [context.service45.id, context.service30.id],
    });

    await expect(
      createParallelGroup(context.admin.currentUser, {
        appointmentId: context.appointment.id,

        appointmentServiceIds: [context.service60.id, context.service45.id],
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("removes a parallel group and restores normal duration", async () => {
    const context = await createContext();

    const created = await createParallelGroup(context.admin.currentUser, {
      appointmentId: context.appointment.id,

      appointmentServiceIds: [context.service45.id, context.service30.id],
    });

    expect(created.estimatedDurationMinutes).toBe(105);

    const group = created.parallelGroups[0];

    if (!group) {
      throw new Error("Le groupe parallèle n'a pas été créé.");
    }

    const result = await removeParallelGroup(context.admin.currentUser, {
      parallelGroupId: group.id,
    });

    expect(result.parallelGroups).toHaveLength(0);

    expect(result.estimatedDurationMinutes).toBe(135);
  });

  it("creates creation and removal activity logs", async () => {
    const context = await createContext();

    const created = await createParallelGroup(context.admin.currentUser, {
      appointmentId: context.appointment.id,

      appointmentServiceIds: [context.service45.id, context.service30.id],
    });

    const group = created.parallelGroups[0];

    if (!group) {
      throw new Error("Le groupe parallèle n'a pas été créé.");
    }

    await removeParallelGroup(context.admin.currentUser, {
      parallelGroupId: group.id,
    });

    const createLog = await testPrisma.activityLog.findFirst({
      where: {
        salonId: context.salon.id,

        entityId: group.id,

        action: "PARALLEL_GROUP_CREATED",
      },
    });

    const removeLog = await testPrisma.activityLog.findFirst({
      where: {
        salonId: context.salon.id,

        entityId: group.id,

        action: "PARALLEL_GROUP_REMOVED",
      },
    });

    expect(createLog).not.toBeNull();

    expect(removeLog).not.toBeNull();
  });

  it("serializes concurrent creation using the same services", async () => {
    const context = await createContext();

    const results = await Promise.allSettled([
      createParallelGroup(context.admin.currentUser, {
        appointmentId: context.appointment.id,

        appointmentServiceIds: [context.service45.id, context.service30.id],
      }),

      createParallelGroup(context.admin.currentUser, {
        appointmentId: context.appointment.id,

        appointmentServiceIds: [context.service45.id, context.service30.id],
      }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);

    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);

    const groups = await testPrisma.parallelGroup.count({
      where: {
        appointmentId: context.appointment.id,
      },
    });

    expect(groups).toBe(1);
  });

  it("refuses removing parallelism when the longer appointment conflicts with another employee appointment", async () => {
    const context = await createContext();

    const employeeUser = await testPrisma.user.create({
      data: {
        salonId: context.salon.id,

        email: `${crypto.randomUUID()}@test.local`,

        passwordHash: "test-hash",

        firstName: "Amina",
        role: "EMPLOYEE",
      },
    });

    const employee = await testPrisma.employee.create({
      data: {
        salonId: context.salon.id,

        userId: employeeUser.id,

        firstName: "Amina",
      },
    });

    await testPrisma.appointmentService.update({
      where: {
        id: context.service60.id,
      },

      data: {
        assignedEmployeeId: employee.id,
      },
    });

    /*
     * Avec parallélisme :
     *
     * 10:00 + 105 min = 11:45.
     */
    const created = await createParallelGroup(context.admin.currentUser, {
      appointmentId: context.appointment.id,

      appointmentServiceIds: [context.service45.id, context.service30.id],
    });

    const group = created.parallelGroups[0];

    if (!group) {
      throw new Error("Le groupe parallèle n'a pas été créé.");
    }

    const otherClient = await testPrisma.client.create({
      data: {
        salonId: context.salon.id,

        phone: `+212${crypto.randomUUID().replaceAll("-", "").slice(0, 9)}`,
      },
    });

    /*
     * Second RDV à 12:00.
     *
     * Avec parallélisme :
     * fin premier RDV = 11:45 => OK.
     *
     * Sans parallélisme :
     * fin premier RDV = 12:15 => conflit.
     */
    await testPrisma.appointment.create({
      data: {
        salonId: context.salon.id,

        clientId: otherClient.id,

        scheduledStart: new Date("2026-09-10T12:00:00.000Z"),

        estimatedDurationMinutes: 60,

        status: "PLANNED",

        createdByUserId: context.admin.user.id,

        services: {
          create: {
            serviceNameSnapshot: "Autre prestation",

            durationMinutes: 60,
            price: 100,

            assignedEmployeeId: employee.id,
          },
        },
      },
    });

    await expect(
      removeParallelGroup(context.admin.currentUser, {
        parallelGroupId: group.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);

    /*
     * Vérification du rollback.
     */
    const storedGroup = await testPrisma.parallelGroup.findUnique({
      where: {
        id: group.id,
      },
    });

    expect(storedGroup).not.toBeNull();

    const storedAppointment = await testPrisma.appointment.findUnique({
      where: {
        id: context.appointment.id,
      },
    });

    expect(storedAppointment?.estimatedDurationMinutes).toBe(105);
  });
});
