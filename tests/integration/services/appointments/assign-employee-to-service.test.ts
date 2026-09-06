import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";
import { assignEmployeeToService } from "@/server/services/appointments/assign-employee-to-service";
import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

import { cleanDatabase } from "../../helpers/database";
import { testPrisma } from "../../helpers/prisma";

async function createContext(params?: {
  role?: "ADMIN" | "EMPLOYEE";
  canManageSalon?: boolean;
}) {
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
      firstName: "User",
      role: params?.role ?? "ADMIN",
      canManageSalon: params?.canManageSalon ?? true,
    },
  });

  const employee = await testPrisma.employee.create({
    data: {
      salonId: salon.id,
      firstName: "Amina",
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
      scheduledStart: new Date("2026-09-10T10:00:00.000Z"),
      estimatedDurationMinutes: 60,
      createdByUserId: user.id,

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

  const currentUser: CurrentUser = {
    id: user.id,
    salonId: salon.id,
    role: user.role,
    canManageSalon: user.canManageSalon,
    isActive: user.isActive,
  };

  const appointmentService = appointment.services[0];

  if (!appointmentService) {
    throw new Error("Appointment service was not created.");
  }

  return {
    salon,
    user,
    currentUser,
    employee,
    client,
    appointment,
    appointmentService,
  };
}

describe("assignEmployeeToService", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("allows an admin to assign an employee", async () => {
    const context = await createContext();

    const result = await assignEmployeeToService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
      employeeId: context.employee.id,
    });

    expect(result.assignedEmployeeId).toBe(context.employee.id);
    expect(result.assignedEmployee?.id).toBe(context.employee.id);
  });

  it("allows an employee with salon management access to assign", async () => {
    const context = await createContext({
      role: "EMPLOYEE",
      canManageSalon: true,
    });

    const result = await assignEmployeeToService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
      employeeId: context.employee.id,
    });

    expect(result.assignedEmployeeId).toBe(context.employee.id);
  });

  it("allows a standard employee to assign operationally", async () => {
    const context = await createContext({
      role: "EMPLOYEE",
      canManageSalon: false,
    });

    const result = await assignEmployeeToService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
      employeeId: context.employee.id,
    });

    expect(result.assignedEmployeeId).toBe(context.employee.id);
  });

  it("rejects an employee belonging to another salon", async () => {
    const salonA = await createContext();
    const salonB = await createContext();

    await expect(
      assignEmployeeToService(salonA.currentUser, {
        appointmentServiceId: salonA.appointmentService.id,
        employeeId: salonB.employee.id,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    const service = await testPrisma.appointmentService.findUnique({
      where: {
        id: salonA.appointmentService.id,
      },
    });

    expect(service?.assignedEmployeeId).toBeNull();
  });

  it("rejects an appointment service belonging to another salon", async () => {
    const salonA = await createContext();
    const salonB = await createContext();

    await expect(
      assignEmployeeToService(salonA.currentUser, {
        appointmentServiceId: salonB.appointmentService.id,
        employeeId: salonA.employee.id,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
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
      assignEmployeeToService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
        employeeId: context.employee.id,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("rejects assignment when the employee is unavailable", async () => {
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
      assignEmployeeToService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
        employeeId: context.employee.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);

    const service = await testPrisma.appointmentService.findUnique({
      where: {
        id: context.appointmentService.id,
      },
    });

    expect(service?.assignedEmployeeId).toBeNull();
  });

  it("allows assignment when unavailability starts exactly when appointment ends", async () => {
    const context = await createContext();

    await testPrisma.employeeUnavailability.create({
      data: {
        employeeId: context.employee.id,
        type: "ABSENCE",
        startAt: new Date("2026-09-10T11:00:00.000Z"),
        endAt: new Date("2026-09-10T12:00:00.000Z"),
        createdByUserId: context.user.id,
      },
    });

    const result = await assignEmployeeToService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
      employeeId: context.employee.id,
    });

    expect(result.assignedEmployeeId).toBe(context.employee.id);
  });

  it("rejects assignment when employee already has an overlapping appointment", async () => {
    const context = await createContext();

    const otherClient = await testPrisma.client.create({
      data: {
        salonId: context.salon.id,
        name: "Autre cliente",
        phone: "+212600000099",
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
      assignEmployeeToService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
        employeeId: context.employee.id,
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
        phone: "+212600000098",
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

    const result = await assignEmployeeToService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
      employeeId: context.employee.id,
    });

    expect(result.assignedEmployeeId).toBe(context.employee.id);
  });

  it("rejects assignment on a cancelled appointment", async () => {
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
      assignEmployeeToService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
        employeeId: context.employee.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects assignment on a closed appointment", async () => {
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
      assignEmployeeToService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
        employeeId: context.employee.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("creates an activity log when assigning", async () => {
    const context = await createContext();

    await assignEmployeeToService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
      employeeId: context.employee.id,
    });

    const log = await testPrisma.activityLog.findFirst({
      where: {
        salonId: context.salon.id,
        entityId: context.appointmentService.id,
      },
    });

    expect(log?.action).toBe("APPOINTMENT_SERVICE_ASSIGNED");
    expect(log?.userId).toBe(context.user.id);
  });

  it("traces a reassignment", async () => {
    const context = await createContext();

    const secondEmployee = await testPrisma.employee.create({
      data: {
        salonId: context.salon.id,
        firstName: "Sara",
      },
    });

    await assignEmployeeToService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
      employeeId: context.employee.id,
    });

    await assignEmployeeToService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
      employeeId: secondEmployee.id,
    });

    const logs = await testPrisma.activityLog.findMany({
      where: {
        salonId: context.salon.id,
        entityId: context.appointmentService.id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    expect(logs).toHaveLength(2);
    expect(logs[0]?.action).toBe("APPOINTMENT_SERVICE_ASSIGNED");
    expect(logs[1]?.action).toBe("APPOINTMENT_SERVICE_REASSIGNED");
  });
});
