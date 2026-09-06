import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";
import { completeAppointmentService } from "@/server/services/appointments/complete-appointment-service";

import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

import { cleanDatabase } from "../../helpers/database";
import { testPrisma } from "../../helpers/prisma";

async function createEmployeeAccount(
  salonId: string,
  params?: {
    firstName?: string;
    canManageSalon?: boolean;
  },
) {
  const firstName = params?.firstName ?? "Amina";

  const user = await testPrisma.user.create({
    data: {
      salonId,
      email: `${crypto.randomUUID()}@test.local`,
      passwordHash: "test-hash",
      firstName,
      role: "EMPLOYEE",
      canManageSalon: params?.canManageSalon ?? false,
    },
  });

  const employee = await testPrisma.employee.create({
    data: {
      salonId,
      userId: user.id,
      firstName,
    },
  });

  const currentUser: CurrentUser = {
    id: user.id,
    salonId,
    role: user.role,
    canManageSalon: user.canManageSalon,
    isActive: user.isActive,
  };

  return {
    user,
    employee,
    currentUser,
  };
}

async function createContext(params?: { withSecondService?: boolean }) {
  const salon = await testPrisma.salon.create({
    data: {
      name: `Salon ${crypto.randomUUID()}`,
    },
  });

  const account = await createEmployeeAccount(salon.id);

  const client = await testPrisma.client.create({
    data: {
      salonId: salon.id,
      name: "Cliente",
      phone: `+212${crypto.randomUUID().replaceAll("-", "").slice(0, 9)}`,
    },
  });

  /*
   * La prestation est déjà IN_PROGRESS au début du test.
   *
   * completeAppointmentService() utilise l'heure réelle comme
   * actualFinishedAt. Le démarrage doit donc être situé dans le passé
   * pour respecter la contrainte BDD :
   *
   * actualFinishedAt >= actualStartedAt
   */
  const startedAt = new Date(Date.now() - 5 * 60 * 1000);

  const appointment = await testPrisma.appointment.create({
    data: {
      salonId: salon.id,
      clientId: client.id,

      scheduledStart: startedAt,

      estimatedDurationMinutes: params?.withSecondService ? 120 : 60,

      status: "IN_PROGRESS",

      createdByUserId: account.user.id,

      services: {
        create: [
          {
            serviceNameSnapshot: "Brushing",
            durationMinutes: 60,
            price: 100,

            assignedEmployeeId: account.employee.id,

            performedByEmployeeId: account.employee.id,

            status: "IN_PROGRESS",
            actualStartedAt: startedAt,
          },

          ...(params?.withSecondService
            ? [
                {
                  serviceNameSnapshot: "Manucure",
                  durationMinutes: 60,
                  price: 150,

                  assignedEmployeeId: account.employee.id,

                  status: "TODO" as const,
                },
              ]
            : []),
        ],
      },
    },

    include: {
      services: true,
    },
  });

  const appointmentService = appointment.services[0];
  const secondService = appointment.services[1] ?? null;

  if (!appointmentService) {
    throw new Error("Appointment service was not created.");
  }

  return {
    salon,
    client,
    appointment,
    appointmentService,
    secondService,
    ...account,
  };
}

describe("completeAppointmentService", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("allows the performer to complete an in-progress service", async () => {
    const context = await createContext();

    const result = await completeAppointmentService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
    });

    expect(result.status).toBe("DONE");

    expect(result.actualFinishedAt).toBeInstanceOf(Date);

    expect(result.actualStartedAt).toBeInstanceOf(Date);

    expect(result.actualFinishedAt!.getTime()).toBeGreaterThanOrEqual(
      result.actualStartedAt!.getTime(),
    );

    expect(result.performedByEmployeeId).toBe(context.employee.id);
  });

  it("moves the appointment to COMPLETED when all services are done", async () => {
    const context = await createContext();

    const result = await completeAppointmentService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
    });

    expect(result.status).toBe("DONE");

    expect(result.appointment.status).toBe("COMPLETED");

    const appointment = await testPrisma.appointment.findUnique({
      where: {
        id: context.appointment.id,
      },
    });

    expect(appointment?.status).toBe("COMPLETED");
  });

  it("keeps the appointment IN_PROGRESS while another service remains", async () => {
    const context = await createContext({
      withSecondService: true,
    });

    await completeAppointmentService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
    });

    const appointment = await testPrisma.appointment.findUnique({
      where: {
        id: context.appointment.id,
      },
    });

    expect(appointment?.status).toBe("IN_PROGRESS");

    if (!context.secondService) {
      throw new Error("Second appointment service was not created.");
    }

    const secondService = await testPrisma.appointmentService.findUnique({
      where: {
        id: context.secondService.id,
      },
    });

    expect(secondService?.status).toBe("TODO");
  });

  it("rejects completing a TODO service directly", async () => {
    const context = await createContext();

    await testPrisma.appointmentService.update({
      where: {
        id: context.appointmentService.id,
      },
      data: {
        status: "TODO",
        actualStartedAt: null,
        performedByEmployeeId: null,
      },
    });

    await expect(
      completeAppointmentService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects completing a service that is already done", async () => {
    const context = await createContext();

    const finishedAt = new Date();

    await testPrisma.appointmentService.update({
      where: {
        id: context.appointmentService.id,
      },
      data: {
        status: "DONE",
        actualFinishedAt: finishedAt,
      },
    });

    await expect(
      completeAppointmentService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects another standard employee", async () => {
    const context = await createContext();

    const secondEmployee = await createEmployeeAccount(context.salon.id, {
      firstName: "Sara",
    });

    await expect(
      completeAppointmentService(secondEmployee.currentUser, {
        appointmentServiceId: context.appointmentService.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("allows an employee with salon management access to complete the service", async () => {
    const context = await createContext();

    const responsible = await createEmployeeAccount(context.salon.id, {
      firstName: "Responsable",
      canManageSalon: true,
    });

    const result = await completeAppointmentService(responsible.currentUser, {
      appointmentServiceId: context.appointmentService.id,
    });

    expect(result.status).toBe("DONE");

    /*
     * L'employée ayant réalisé la prestation reste celle enregistrée
     * au démarrage, même si la responsable enregistre sa fin.
     */
    expect(result.performedByEmployeeId).toBe(context.employee.id);
  });

  it("allows an admin to register completion", async () => {
    const context = await createContext();

    const admin = await testPrisma.user.create({
      data: {
        salonId: context.salon.id,
        email: `${crypto.randomUUID()}@test.local`,
        passwordHash: "test-hash",
        firstName: "Admin",
        role: "ADMIN",
        canManageSalon: true,
      },
    });

    const currentUser: CurrentUser = {
      id: admin.id,
      salonId: context.salon.id,
      role: admin.role,
      canManageSalon: admin.canManageSalon,
      isActive: admin.isActive,
    };

    const result = await completeAppointmentService(currentUser, {
      appointmentServiceId: context.appointmentService.id,
    });

    expect(result.status).toBe("DONE");

    expect(result.performedByEmployeeId).toBe(context.employee.id);
  });

  it("rejects a cancelled appointment", async () => {
    const context = await createContext();

    await testPrisma.appointment.update({
      where: {
        id: context.appointment.id,
      },
      data: {
        status: "CANCELLED",
      },
    });

    await expect(
      completeAppointmentService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects a closed appointment", async () => {
    const context = await createContext();

    await testPrisma.appointment.update({
      where: {
        id: context.appointment.id,
      },
      data: {
        status: "CLOSED",
      },
    });

    await expect(
      completeAppointmentService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("does not expose a service belonging to another salon", async () => {
    const contextA = await createContext();
    const contextB = await createContext();

    await expect(
      completeAppointmentService(contextA.currentUser, {
        appointmentServiceId: contextB.appointmentService.id,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("creates an activity log", async () => {
    const context = await createContext();

    await completeAppointmentService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
    });

    const log = await testPrisma.activityLog.findFirst({
      where: {
        salonId: context.salon.id,
        entityId: context.appointmentService.id,
        action: "APPOINTMENT_SERVICE_COMPLETED",
      },
    });

    expect(log).not.toBeNull();

    expect(log?.userId).toBe(context.user.id);
  });

  it("only completes the same service once under concurrent calls", async () => {
    const context = await createContext();

    const results = await Promise.allSettled([
      completeAppointmentService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
      }),

      completeAppointmentService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");

    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    if (rejected[0]?.status !== "rejected") {
      throw new Error("Expected one rejected completion.");
    }

    expect(rejected[0].reason).toBeInstanceOf(BusinessRuleError);

    const service = await testPrisma.appointmentService.findUnique({
      where: {
        id: context.appointmentService.id,
      },
    });

    expect(service?.status).toBe("DONE");

    expect(service?.actualFinishedAt).toBeInstanceOf(Date);

    const logs = await testPrisma.activityLog.count({
      where: {
        salonId: context.salon.id,
        entityId: context.appointmentService.id,
        action: "APPOINTMENT_SERVICE_COMPLETED",
      },
    });

    expect(logs).toBe(1);
  });
});
