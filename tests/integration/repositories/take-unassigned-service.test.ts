import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";
import { PermissionDeniedError } from "@/server/permissions";
import { takeUnassignedService } from "@/server/services/appointments/take-unassigned-service";

import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";
import { testPrisma } from "../helpers/prisma";
import { cleanDatabase } from "../helpers/database";

async function createEmployeeAccount(
  salonId: string,
  params?: {
    firstName?: string;
    canManageSalon?: boolean;
    isActive?: boolean;
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
      isActive: params?.isActive ?? true,
    },
  });

  const employee = await testPrisma.employee.create({
    data: {
      salonId,
      userId: user.id,
      firstName,
      isActive: params?.isActive ?? true,
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

  const employeeAccount = await createEmployeeAccount(salon.id);

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

      scheduledStart: new Date("2026-09-10T10:00:00.000Z"),

      estimatedDurationMinutes: 60,

      createdByUserId: employeeAccount.user.id,

      services: {
        create: {
          serviceNameSnapshot: "Brushing",
          durationMinutes: 60,
          price: 100,
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
    ...employeeAccount,
  };
}

describe("takeUnassignedService", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("allows a standard employee to take an unassigned service", async () => {
    const context = await createContext();

    const result = await takeUnassignedService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
    });

    expect(result.assignedEmployeeId).toBe(context.employee.id);

    expect(result.assignedEmployee?.id).toBe(context.employee.id);
  });

  it("allows an employee with salon management access to take an unassigned service", async () => {
    const context = await createContext();

    await testPrisma.user.update({
      where: {
        id: context.user.id,
      },
      data: {
        canManageSalon: true,
      },
    });

    const currentUser: CurrentUser = {
      ...context.currentUser,
      canManageSalon: true,
    };

    const result = await takeUnassignedService(currentUser, {
      appointmentServiceId: context.appointmentService.id,
    });

    expect(result.assignedEmployeeId).toBe(context.employee.id);
  });

  it("rejects an inactive user", async () => {
    const context = await createContext();

    const inactiveCurrentUser: CurrentUser = {
      ...context.currentUser,
      isActive: false,
    };

    await expect(
      takeUnassignedService(inactiveCurrentUser, {
        appointmentServiceId: context.appointmentService.id,
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);

    const service = await testPrisma.appointmentService.findUnique({
      where: {
        id: context.appointmentService.id,
      },
    });

    expect(service?.assignedEmployeeId).toBeNull();
  });

  it("rejects a user without an associated employee", async () => {
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

    const adminCurrentUser: CurrentUser = {
      id: admin.id,
      salonId: context.salon.id,
      role: admin.role,
      canManageSalon: admin.canManageSalon,
      isActive: admin.isActive,
    };

    await expect(
      takeUnassignedService(adminCurrentUser, {
        appointmentServiceId: context.appointmentService.id,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    const service = await testPrisma.appointmentService.findUnique({
      where: {
        id: context.appointmentService.id,
      },
    });

    expect(service?.assignedEmployeeId).toBeNull();
  });

  it("rejects an inactive employee", async () => {
    const context = await createContext();

    await testPrisma.employee.update({
      where: {
        id: context.employee.id,
      },
      data: {
        isActive: false,
      },
    });

    await expect(
      takeUnassignedService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    const service = await testPrisma.appointmentService.findUnique({
      where: {
        id: context.appointmentService.id,
      },
    });

    expect(service?.assignedEmployeeId).toBeNull();
  });

  it("does not expose an appointment service belonging to another salon", async () => {
    const salonA = await createContext();

    const salonB = await testPrisma.salon.create({
      data: {
        name: "Salon B",
      },
    });

    const employeeB = await createEmployeeAccount(salonB.id);

    const clientB = await testPrisma.client.create({
      data: {
        salonId: salonB.id,
        name: "Cliente B",
        phone: "+212600002001",
      },
    });

    const appointmentB = await testPrisma.appointment.create({
      data: {
        salonId: salonB.id,
        clientId: clientB.id,

        scheduledStart: new Date("2026-09-10T10:00:00.000Z"),

        estimatedDurationMinutes: 60,

        createdByUserId: employeeB.user.id,

        services: {
          create: {
            serviceNameSnapshot: "Massage",
            durationMinutes: 60,
            price: 350,
          },
        },
      },

      include: {
        services: true,
      },
    });

    const serviceB = appointmentB.services[0];

    if (!serviceB) {
      throw new Error("Appointment service B was not created.");
    }

    await expect(
      takeUnassignedService(salonA.currentUser, {
        appointmentServiceId: serviceB.id,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    const service = await testPrisma.appointmentService.findUnique({
      where: {
        id: serviceB.id,
      },
    });

    expect(service?.assignedEmployeeId).toBeNull();
  });

  it("rejects a service that is already assigned", async () => {
    const context = await createContext();

    const secondEmployee = await createEmployeeAccount(context.salon.id, {
      firstName: "Sara",
    });

    await testPrisma.appointmentService.update({
      where: {
        id: context.appointmentService.id,
      },

      data: {
        assignedEmployeeId: secondEmployee.employee.id,
      },
    });

    await expect(
      takeUnassignedService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);

    const service = await testPrisma.appointmentService.findUnique({
      where: {
        id: context.appointmentService.id,
      },
    });

    expect(service?.assignedEmployeeId).toBe(secondEmployee.employee.id);
  });

  it("rejects taking a service from a cancelled appointment", async () => {
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
      takeUnassignedService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects taking a service from a closed appointment", async () => {
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
      takeUnassignedService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects taking a service when the employee is unavailable", async () => {
    const context = await createContext();

    await testPrisma.employeeUnavailability.create({
      data: {
        employeeId: context.employee.id,
        type: "ABSENCE",

        startAt: new Date("2026-09-10T09:30:00.000Z"),

        endAt: new Date("2026-09-10T10:30:00.000Z"),

        createdByUserId: context.user.id,
      },
    });

    await expect(
      takeUnassignedService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);

    const service = await testPrisma.appointmentService.findUnique({
      where: {
        id: context.appointmentService.id,
      },
    });

    expect(service?.assignedEmployeeId).toBeNull();
  });

  it("allows taking a service when unavailability starts exactly when the appointment ends", async () => {
    const context = await createContext();

    await testPrisma.employeeUnavailability.create({
      data: {
        employeeId: context.employee.id,
        type: "BREAK",

        startAt: new Date("2026-09-10T11:00:00.000Z"),

        endAt: new Date("2026-09-10T12:00:00.000Z"),

        createdByUserId: context.user.id,
      },
    });

    const result = await takeUnassignedService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
    });

    expect(result.assignedEmployeeId).toBe(context.employee.id);
  });

  it("rejects taking a service when the employee has an overlapping appointment", async () => {
    const context = await createContext();

    const otherClient = await testPrisma.client.create({
      data: {
        salonId: context.salon.id,
        name: "Autre cliente",
        phone: "+212600002002",
      },
    });

    await testPrisma.appointment.create({
      data: {
        salonId: context.salon.id,
        clientId: otherClient.id,

        scheduledStart: new Date("2026-09-10T10:30:00.000Z"),

        estimatedDurationMinutes: 60,

        createdByUserId: context.user.id,

        services: {
          create: {
            serviceNameSnapshot: "Coupe",
            durationMinutes: 60,
            price: 200,
            assignedEmployeeId: context.employee.id,
          },
        },
      },
    });

    await expect(
      takeUnassignedService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);

    const service = await testPrisma.appointmentService.findUnique({
      where: {
        id: context.appointmentService.id,
      },
    });

    expect(service?.assignedEmployeeId).toBeNull();
  });

  it("allows adjacent appointments without overlap", async () => {
    const context = await createContext();

    const otherClient = await testPrisma.client.create({
      data: {
        salonId: context.salon.id,
        name: "Autre cliente",
        phone: "+212600002003",
      },
    });

    await testPrisma.appointment.create({
      data: {
        salonId: context.salon.id,
        clientId: otherClient.id,

        scheduledStart: new Date("2026-09-10T09:00:00.000Z"),

        estimatedDurationMinutes: 60,

        createdByUserId: context.user.id,

        services: {
          create: {
            serviceNameSnapshot: "Coupe",
            durationMinutes: 60,
            price: 200,
            assignedEmployeeId: context.employee.id,
          },
        },
      },
    });

    const result = await takeUnassignedService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
    });

    expect(result.assignedEmployeeId).toBe(context.employee.id);
  });

  it("creates an activity log when an employee takes a service", async () => {
    const context = await createContext();

    await takeUnassignedService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
    });

    const logs = await testPrisma.activityLog.findMany({
      where: {
        salonId: context.salon.id,
        entityId: context.appointmentService.id,
      },
    });

    expect(logs).toHaveLength(1);

    expect(logs[0]?.action).toBe("APPOINTMENT_SERVICE_TAKEN");

    expect(logs[0]?.userId).toBe(context.user.id);
  });

  it("is first-wins when two employees take the same service concurrently", async () => {
    const context = await createContext();

    const employeeB = await createEmployeeAccount(context.salon.id, {
      firstName: "Sara",
    });

    const results = await Promise.allSettled([
      takeUnassignedService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
      }),

      takeUnassignedService(employeeB.currentUser, {
        appointmentServiceId: context.appointmentService.id,
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

    const service = await testPrisma.appointmentService.findUnique({
      where: {
        id: context.appointmentService.id,
      },
    });

    expect([context.employee.id, employeeB.employee.id]).toContain(
      service?.assignedEmployeeId,
    );

    const logs = await testPrisma.activityLog.findMany({
      where: {
        salonId: context.salon.id,
        entityId: context.appointmentService.id,
        action: "APPOINTMENT_SERVICE_TAKEN",
      },
    });

    /*
     * Une seule employée a gagné.
     * Donc une seule trace métier.
     */
    expect(logs).toHaveLength(1);
  });

  it("prevents the same employee from taking two overlapping services concurrently", async () => {
    const context = await createContext();

    const secondClient = await testPrisma.client.create({
      data: {
        salonId: context.salon.id,
        name: "Cliente B",
        phone: "+212600002004",
      },
    });

    const secondAppointment = await testPrisma.appointment.create({
      data: {
        salonId: context.salon.id,
        clientId: secondClient.id,

        scheduledStart: new Date("2026-09-10T10:30:00.000Z"),

        estimatedDurationMinutes: 60,

        createdByUserId: context.user.id,

        services: {
          create: {
            serviceNameSnapshot: "Soin visage",
            durationMinutes: 60,
            price: 500,
          },
        },
      },

      include: {
        services: true,
      },
    });

    const secondService = secondAppointment.services[0];

    if (!secondService) {
      throw new Error("Second appointment service was not created.");
    }

    const results = await Promise.allSettled([
      takeUnassignedService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
      }),

      takeUnassignedService(context.currentUser, {
        appointmentServiceId: secondService.id,
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");

    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rejectedResult = rejected[0];

    if (rejectedResult?.status === "rejected") {
      expect(rejectedResult.reason).toBeInstanceOf(BusinessRuleError);
    }

    const assignedCount = await testPrisma.appointmentService.count({
      where: {
        assignedEmployeeId: context.employee.id,
      },
    });

    expect(assignedCount).toBe(1);
  });
});
