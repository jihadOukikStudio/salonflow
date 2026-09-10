import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";

import { updateAppointmentSchedule } from "@/server/services/appointments/update-appointment-schedule";

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

  withEmployee?: boolean;
  withRoom?: boolean;
}) {
  const salon = await testPrisma.salon.create({
    data: {
      name: `Salon ${crypto.randomUUID()}`,
    },
  });

  const admin = await createUser(salon.id, {
    role: "ADMIN",
    canManageSalon: true,
    firstName: "Admin",
  });

  const employeeAccount = await createUser(salon.id, {
    role: "EMPLOYEE",
    firstName: "Amina",
  });

  const employee = await testPrisma.employee.create({
    data: {
      salonId: salon.id,
      userId: employeeAccount.user.id,
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
      name: "Cliente",
      phone: `+212${crypto.randomUUID().replaceAll("-", "").slice(0, 9)}`,
    },
  });

  const appointment = await testPrisma.appointment.create({
    data: {
      salonId: salon.id,
      clientId: client.id,

      scheduledStart: new Date("2099-09-10T10:00:00.000Z"),

      estimatedDurationMinutes: 60,

      status: params?.appointmentStatus ?? "PLANNED",

      createdByUserId: admin.user.id,

      services: {
        create: {
          serviceNameSnapshot: "Soin visage",

          durationMinutes: 60,
          price: 250,

          requiredRoomTypeSnapshot: "TREATMENT_ROOM",

          assignedEmployeeId:
            params?.withEmployee === false ? null : employee.id,

          roomId: params?.withRoom === false ? null : room.id,
        },
      },
    },

    include: {
      services: true,
    },
  });

  return {
    salon,
    admin,
    employeeAccount,
    employee,
    room,
    client,
    appointment,
  };
}

describe("updateAppointmentSchedule", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("allows an admin to move a planned appointment", async () => {
    const context = await createContext();

    const newStart = new Date("2099-09-10T14:00:00.000Z");

    const result = await updateAppointmentSchedule(context.admin.currentUser, {
      appointmentId: context.appointment.id,
      scheduledStart: newStart,
    });

    expect(result.scheduledStart).toEqual(newStart);

    expect(result.status).toBe("PLANNED");
  });

  it("allows a responsible employee to move a planned appointment", async () => {
    const context = await createContext();

    const responsible = await createUser(context.salon.id, {
      role: "EMPLOYEE",
      canManageSalon: true,
    });

    const result = await updateAppointmentSchedule(responsible.currentUser, {
      appointmentId: context.appointment.id,

      scheduledStart: new Date("2099-09-10T14:00:00.000Z"),
    });

    expect(result.scheduledStart).toEqual(new Date("2099-09-10T14:00:00.000Z"));
  });

  it("rejects a standard employee", async () => {
    const context = await createContext();

    await expect(
      updateAppointmentSchedule(context.employeeAccount.currentUser, {
        appointmentId: context.appointment.id,

        scheduledStart: new Date("2099-09-10T14:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it("rejects an inactive user", async () => {
    const context = await createContext();

    const inactiveAdmin = await createUser(context.salon.id, {
      role: "ADMIN",
      canManageSalon: true,
      isActive: false,
    });

    await expect(
      updateAppointmentSchedule(inactiveAdmin.currentUser, {
        appointmentId: context.appointment.id,

        scheduledStart: new Date("2099-09-10T14:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it("does not expose an appointment from another salon", async () => {
    const contextA = await createContext();

    const contextB = await createContext();

    await expect(
      updateAppointmentSchedule(contextA.admin.currentUser, {
        appointmentId: contextB.appointment.id,

        scheduledStart: new Date("2099-09-10T14:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("rejects an invalid scheduled start", async () => {
    const context = await createContext();

    await expect(
      updateAppointmentSchedule(context.admin.currentUser, {
        appointmentId: context.appointment.id,

        scheduledStart: new Date("invalid"),
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it.each(["IN_PROGRESS", "COMPLETED", "CLOSED", "CANCELLED"] as const)(
    "rejects an appointment with status %s",
    async (status) => {
      const context = await createContext({
        appointmentStatus: status,
      });

      await expect(
        updateAppointmentSchedule(context.admin.currentUser, {
          appointmentId: context.appointment.id,

          scheduledStart: new Date("2099-09-10T14:00:00.000Z"),
        }),
      ).rejects.toBeInstanceOf(BusinessRuleError);
    },
  );

  it("rejects a move when an assigned employee is unavailable on the new slot", async () => {
    const context = await createContext();

    await testPrisma.employeeUnavailability.create({
      data: {
        employeeId: context.employee.id,

        type: "ABSENCE",

        startAt: new Date("2099-09-10T14:00:00.000Z"),

        endAt: new Date("2099-09-10T16:00:00.000Z"),

        createdByUserId: context.admin.user.id,
      },
    });

    await expect(
      updateAppointmentSchedule(context.admin.currentUser, {
        appointmentId: context.appointment.id,

        scheduledStart: new Date("2099-09-10T14:30:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects a move when an assigned room is unavailable on the new slot", async () => {
    const context = await createContext();

    await testPrisma.roomUnavailability.create({
      data: {
        roomId: context.room.id,

        startAt: new Date("2099-09-10T14:00:00.000Z"),

        endAt: new Date("2099-09-10T16:00:00.000Z"),

        reason: "Maintenance",

        createdByUserId: context.admin.user.id,
      },
    });

    await expect(
      updateAppointmentSchedule(context.admin.currentUser, {
        appointmentId: context.appointment.id,

        scheduledStart: new Date("2099-09-10T14:30:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects a move when the assigned employee has another overlapping appointment", async () => {
    const context = await createContext();

    const otherClient = await testPrisma.client.create({
      data: {
        salonId: context.salon.id,
        phone: `+212${crypto.randomUUID().replaceAll("-", "").slice(0, 9)}`,
      },
    });

    await testPrisma.appointment.create({
      data: {
        salonId: context.salon.id,
        clientId: otherClient.id,

        scheduledStart: new Date("2099-09-10T14:00:00.000Z"),

        estimatedDurationMinutes: 60,
        status: "PLANNED",

        createdByUserId: context.admin.user.id,

        services: {
          create: {
            serviceNameSnapshot: "Brushing",

            durationMinutes: 60,
            price: 100,

            assignedEmployeeId: context.employee.id,
          },
        },
      },
    });

    await expect(
      updateAppointmentSchedule(context.admin.currentUser, {
        appointmentId: context.appointment.id,

        scheduledStart: new Date("2099-09-10T14:30:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects a move when the assigned room is used by another overlapping appointment", async () => {
    const context = await createContext();

    const otherClient = await testPrisma.client.create({
      data: {
        salonId: context.salon.id,
        phone: `+212${crypto.randomUUID().replaceAll("-", "").slice(0, 9)}`,
      },
    });

    await testPrisma.appointment.create({
      data: {
        salonId: context.salon.id,
        clientId: otherClient.id,

        scheduledStart: new Date("2099-09-10T14:00:00.000Z"),

        estimatedDurationMinutes: 60,
        status: "PLANNED",

        createdByUserId: context.admin.user.id,

        services: {
          create: {
            serviceNameSnapshot: "Massage",

            durationMinutes: 60,
            price: 300,

            requiredRoomTypeSnapshot: "TREATMENT_ROOM",

            roomId: context.room.id,
          },
        },
      },
    });

    await expect(
      updateAppointmentSchedule(context.admin.currentUser, {
        appointmentId: context.appointment.id,

        scheduledStart: new Date("2099-09-10T14:30:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("allows adjacent employee and room bookings", async () => {
    const context = await createContext();

    const otherClient = await testPrisma.client.create({
      data: {
        salonId: context.salon.id,
        phone: `+212${crypto.randomUUID().replaceAll("-", "").slice(0, 9)}`,
      },
    });

    /*
     * Autre RDV : 14:00 -> 15:00.
     */
    await testPrisma.appointment.create({
      data: {
        salonId: context.salon.id,
        clientId: otherClient.id,

        scheduledStart: new Date("2099-09-10T14:00:00.000Z"),

        estimatedDurationMinutes: 60,
        status: "PLANNED",

        createdByUserId: context.admin.user.id,

        services: {
          create: {
            serviceNameSnapshot: "Autre soin",

            durationMinutes: 60,
            price: 200,

            assignedEmployeeId: context.employee.id,

            roomId: context.room.id,
          },
        },
      },
    });

    /*
     * Nouveau RDV : 15:00 -> 16:00.
     * Aucun chevauchement.
     */
    const result = await updateAppointmentSchedule(context.admin.currentUser, {
      appointmentId: context.appointment.id,

      scheduledStart: new Date("2099-09-10T15:00:00.000Z"),
    });

    expect(result.scheduledStart).toEqual(new Date("2099-09-10T15:00:00.000Z"));
  });

  it("persists the new scheduled start", async () => {
    const context = await createContext();

    const newStart = new Date("2099-09-10T16:00:00.000Z");

    await updateAppointmentSchedule(context.admin.currentUser, {
      appointmentId: context.appointment.id,
      scheduledStart: newStart,
    });

    const stored = await testPrisma.appointment.findUnique({
      where: {
        id: context.appointment.id,
      },
    });

    expect(stored?.scheduledStart).toEqual(newStart);
  });

  it("does not modify the appointment when validation fails", async () => {
    const context = await createContext();

    const originalStart = context.appointment.scheduledStart;

    await testPrisma.employeeUnavailability.create({
      data: {
        employeeId: context.employee.id,

        type: "ABSENCE",

        startAt: new Date("2099-09-10T14:00:00.000Z"),

        endAt: new Date("2099-09-10T16:00:00.000Z"),

        createdByUserId: context.admin.user.id,
      },
    });

    await expect(
      updateAppointmentSchedule(context.admin.currentUser, {
        appointmentId: context.appointment.id,

        scheduledStart: new Date("2099-09-10T14:30:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);

    const stored = await testPrisma.appointment.findUnique({
      where: {
        id: context.appointment.id,
      },
    });

    expect(stored?.scheduledStart).toEqual(originalStart);
  });

  it("creates an activity log", async () => {
    const context = await createContext();

    const newStart = new Date("2099-09-10T16:00:00.000Z");

    await updateAppointmentSchedule(context.admin.currentUser, {
      appointmentId: context.appointment.id,
      scheduledStart: newStart,
    });

    const log = await testPrisma.activityLog.findFirst({
      where: {
        salonId: context.salon.id,

        userId: context.admin.user.id,

        entityId: context.appointment.id,

        action: "APPOINTMENT_SCHEDULE_UPDATED",
      },
    });

    expect(log).not.toBeNull();

    expect(log?.entityType).toBe("APPOINTMENT");
  });
});
