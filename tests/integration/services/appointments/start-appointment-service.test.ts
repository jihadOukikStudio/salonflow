import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";
import { startAppointmentService } from "@/server/services/appointments/start-appointment-service";

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

async function createContext() {
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

  const appointment = await testPrisma.appointment.create({
    data: {
      salonId: salon.id,
      clientId: client.id,

      scheduledStart: new Date(Date.now() - 15 * 60 * 1000),

      estimatedDurationMinutes: 60,

      createdByUserId: account.user.id,

      services: {
        create: {
          serviceNameSnapshot: "Brushing",
          durationMinutes: 60,
          price: 100,

          assignedEmployeeId: account.employee.id,
        },
      },
    },

    include: {
      services: true,
    },
  });

  const appointmentService = appointment.services[0];

  if (!appointmentService) {
    throw new Error("Appointment service was not created.");
  }

  return {
    salon,
    client,
    appointment,
    appointmentService,
    ...account,
  };
}

describe("startAppointmentService", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("allows the assigned employee to start the service", async () => {
    const context = await createContext();

    const result = await startAppointmentService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
    });

    expect(result.status).toBe("IN_PROGRESS");

    expect(result.actualStartedAt).toBeInstanceOf(Date);

    expect(result.actualFinishedAt).toBeNull();

    expect(result.performedByEmployeeId).toBe(context.employee.id);
  });

  it("moves the appointment from PLANNED to IN_PROGRESS", async () => {
    const context = await createContext();

    const result = await startAppointmentService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
    });

    expect(result.appointment.status).toBe("IN_PROGRESS");

    const appointment = await testPrisma.appointment.findUnique({
      where: {
        id: context.appointment.id,
      },
    });

    expect(appointment?.status).toBe("IN_PROGRESS");
  });

  it("rejects a standard employee who is not assigned to the service", async () => {
    const context = await createContext();

    const secondEmployee = await createEmployeeAccount(context.salon.id, {
      firstName: "Sara",
    });

    await expect(
      startAppointmentService(secondEmployee.currentUser, {
        appointmentServiceId: context.appointmentService.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("allows an employee with salon management access to start an assigned service", async () => {
    const context = await createContext();

    const responsible = await createEmployeeAccount(context.salon.id, {
      firstName: "Responsable",
      canManageSalon: true,
    });

    const result = await startAppointmentService(responsible.currentUser, {
      appointmentServiceId: context.appointmentService.id,
    });

    expect(result.status).toBe("IN_PROGRESS");

    /*
     * Même si la responsable a enregistré l'action,
     * l'exécutante réelle reste Amina.
     */
    expect(result.performedByEmployeeId).toBe(context.employee.id);
  });

  it("allows an admin to register the start of an assigned service", async () => {
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

    const result = await startAppointmentService(currentUser, {
      appointmentServiceId: context.appointmentService.id,
    });

    expect(result.status).toBe("IN_PROGRESS");

    expect(result.performedByEmployeeId).toBe(context.employee.id);
  });

  it("rejects an unassigned service", async () => {
    const context = await createContext();

    await testPrisma.appointmentService.update({
      where: {
        id: context.appointmentService.id,
      },
      data: {
        assignedEmployeeId: null,
      },
    });

    await expect(
      startAppointmentService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects a service that is already in progress", async () => {
    const context = await createContext();

    await testPrisma.appointmentService.update({
      where: {
        id: context.appointmentService.id,
      },
      data: {
        status: "IN_PROGRESS",
        actualStartedAt: new Date(),
        performedByEmployeeId: context.employee.id,
      },
    });

    await expect(
      startAppointmentService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects a service that is already done", async () => {
    const context = await createContext();

    const startedAt = new Date("2026-09-10T10:00:00.000Z");

    await testPrisma.appointmentService.update({
      where: {
        id: context.appointmentService.id,
      },
      data: {
        status: "DONE",
        actualStartedAt: startedAt,
        actualFinishedAt: new Date("2026-09-10T11:00:00.000Z"),
        performedByEmployeeId: context.employee.id,
      },
    });

    await expect(
      startAppointmentService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
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
      startAppointmentService(context.currentUser, {
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
      startAppointmentService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("does not expose a service from another salon", async () => {
    const contextA = await createContext();
    const contextB = await createContext();

    await expect(
      startAppointmentService(contextA.currentUser, {
        appointmentServiceId: contextB.appointmentService.id,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("creates an activity log", async () => {
    const context = await createContext();

    await startAppointmentService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
    });

    const log = await testPrisma.activityLog.findFirst({
      where: {
        salonId: context.salon.id,
        entityId: context.appointmentService.id,
        action: "APPOINTMENT_SERVICE_STARTED",
      },
    });

    expect(log).not.toBeNull();

    expect(log?.userId).toBe(context.user.id);
  });

  it("only starts the same service once under concurrent calls", async () => {
    const context = await createContext();

    const results = await Promise.allSettled([
      startAppointmentService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
      }),

      startAppointmentService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
      }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);

    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);

    const logs = await testPrisma.activityLog.count({
      where: {
        salonId: context.salon.id,
        entityId: context.appointmentService.id,
        action: "APPOINTMENT_SERVICE_STARTED",
      },
    });

    expect(logs).toBe(1);
  });
});
