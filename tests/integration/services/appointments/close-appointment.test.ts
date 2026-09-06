import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";

import { closeAppointment } from "@/server/services/appointments/close-appointment";

import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

import { cleanDatabase } from "../../helpers/database";
import { testPrisma } from "../../helpers/prisma";

async function createAccount(
  salonId: string,
  params?: {
    role?: "ADMIN" | "EMPLOYEE";
    canManageSalon?: boolean;
    isActive?: boolean;
    firstName?: string;
  },
) {
  const user = await testPrisma.user.create({
    data: {
      salonId,
      email: `${crypto.randomUUID()}@test.local`,
      passwordHash: "test-hash",
      firstName: params?.firstName ?? "Utilisateur",
      role: params?.role ?? "EMPLOYEE",
      canManageSalon: params?.canManageSalon ?? false,
      isActive: params?.isActive ?? true,
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

async function createContext(params?: {
  appointmentStatus?:
    "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CLOSED" | "CANCELLED";

  serviceStatus?: "TODO" | "IN_PROGRESS" | "DONE";

  paid?: boolean;
}) {
  const salon = await testPrisma.salon.create({
    data: {
      name: `Salon ${crypto.randomUUID()}`,
    },
  });

  const admin = await createAccount(salon.id, {
    role: "ADMIN",
    canManageSalon: true,
    firstName: "Admin",
  });

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

      scheduledStart: new Date(Date.now() - 60 * 60 * 1000),

      estimatedDurationMinutes: 60,

      status: params?.appointmentStatus ?? "COMPLETED",

      createdByUserId: admin.user.id,

      services: {
        create: {
          serviceNameSnapshot: "Brushing",
          durationMinutes: 60,
          price: 200,

          status: params?.serviceStatus ?? "DONE",

          ...((params?.serviceStatus ?? "DONE") === "DONE"
            ? {
                actualStartedAt: new Date(Date.now() - 60 * 60 * 1000),

                actualFinishedAt: new Date(Date.now() - 5 * 60 * 1000),
              }
            : {}),
        },
      },
    },

    include: {
      services: true,
    },
  });

  if (params?.paid ?? true) {
    await testPrisma.payment.create({
      data: {
        appointmentId: appointment.id,
        amount: 200,
        method: "CASH",
        status: "PAID",

        paidAt: new Date(),

        recordedByUserId: admin.user.id,
      },
    });
  }

  return {
    salon,
    client,
    appointment,
    ...admin,
  };
}

describe("closeAppointment", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("allows an admin to close a completed and paid appointment", async () => {
    const context = await createContext();

    const result = await closeAppointment(context.currentUser, {
      appointmentId: context.appointment.id,
    });

    expect(result.status).toBe("CLOSED");

    expect(result.payment?.status).toBe("PAID");
  });

  it("allows an employee with salon management access to close the appointment", async () => {
    const context = await createContext();

    const responsible = await createAccount(context.salon.id, {
      role: "EMPLOYEE",
      canManageSalon: true,
      firstName: "Responsable",
    });

    const result = await closeAppointment(responsible.currentUser, {
      appointmentId: context.appointment.id,
    });

    expect(result.status).toBe("CLOSED");
  });

  it("rejects a standard employee", async () => {
    const context = await createContext();

    const employee = await createAccount(context.salon.id, {
      role: "EMPLOYEE",
      canManageSalon: false,
    });

    await expect(
      closeAppointment(employee.currentUser, {
        appointmentId: context.appointment.id,
      }),
    ).rejects.toThrow();
  });

  it("rejects an inactive user", async () => {
    const context = await createContext();

    const inactiveAdmin = await createAccount(context.salon.id, {
      role: "ADMIN",
      canManageSalon: true,
      isActive: false,
    });

    await expect(
      closeAppointment(inactiveAdmin.currentUser, {
        appointmentId: context.appointment.id,
      }),
    ).rejects.toThrow();
  });

  it("does not expose an appointment belonging to another salon", async () => {
    const contextA = await createContext();
    const contextB = await createContext();

    await expect(
      closeAppointment(contextA.currentUser, {
        appointmentId: contextB.appointment.id,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("rejects a PLANNED appointment", async () => {
    const context = await createContext({
      appointmentStatus: "PLANNED",
    });

    await expect(
      closeAppointment(context.currentUser, {
        appointmentId: context.appointment.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects an IN_PROGRESS appointment", async () => {
    const context = await createContext({
      appointmentStatus: "IN_PROGRESS",
    });

    await expect(
      closeAppointment(context.currentUser, {
        appointmentId: context.appointment.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects a cancelled appointment", async () => {
    const context = await createContext({
      appointmentStatus: "CANCELLED",
    });

    await expect(
      closeAppointment(context.currentUser, {
        appointmentId: context.appointment.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects an appointment that is already closed", async () => {
    const context = await createContext({
      appointmentStatus: "CLOSED",
    });

    await expect(
      closeAppointment(context.currentUser, {
        appointmentId: context.appointment.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects a completed appointment containing an unfinished service", async () => {
    const context = await createContext({
      appointmentStatus: "COMPLETED",
      serviceStatus: "TODO",
    });

    await expect(
      closeAppointment(context.currentUser, {
        appointmentId: context.appointment.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects a completed appointment that is not paid", async () => {
    const context = await createContext({
      paid: false,
    });

    await expect(
      closeAppointment(context.currentUser, {
        appointmentId: context.appointment.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("persists CLOSED status in database", async () => {
    const context = await createContext();

    await closeAppointment(context.currentUser, {
      appointmentId: context.appointment.id,
    });

    const appointment = await testPrisma.appointment.findUnique({
      where: {
        id: context.appointment.id,
      },
    });

    expect(appointment?.status).toBe("CLOSED");
  });

  it("creates an activity log", async () => {
    const context = await createContext();

    await closeAppointment(context.currentUser, {
      appointmentId: context.appointment.id,
    });

    const log = await testPrisma.activityLog.findFirst({
      where: {
        salonId: context.salon.id,
        userId: context.user.id,
        entityId: context.appointment.id,
        action: "APPOINTMENT_CLOSED",
      },
    });

    expect(log).not.toBeNull();

    expect(log?.entityType).toBe("APPOINTMENT");
  });

  it("closes the appointment only once under concurrent calls", async () => {
    const context = await createContext();

    const results = await Promise.allSettled([
      closeAppointment(context.currentUser, {
        appointmentId: context.appointment.id,
      }),

      closeAppointment(context.currentUser, {
        appointmentId: context.appointment.id,
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
    });

    expect(appointment?.status).toBe("CLOSED");

    const logs = await testPrisma.activityLog.count({
      where: {
        salonId: context.salon.id,
        entityId: context.appointment.id,
        action: "APPOINTMENT_CLOSED",
      },
    });

    expect(logs).toBe(1);
  });
});
