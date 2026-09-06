import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";

import { createEmployeeUnavailability } from "@/server/services/employees/create-employee-unavailability";

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

async function createContext() {
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

  return {
    salon,
    admin,
    employeeAccount,
    employee,
  };
}

describe("createEmployeeUnavailability", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("allows an employee to create her own unavailability", async () => {
    const context = await createContext();

    const startAt = new Date("2026-09-10T10:00:00.000Z");

    const endAt = new Date("2026-09-10T12:00:00.000Z");

    const result = await createEmployeeUnavailability(
      context.employeeAccount.currentUser,
      {
        employeeId: context.employee.id,
        type: "ABSENCE",
        startAt,
        endAt,
        note: "Rendez-vous personnel",
      },
    );

    expect(result.employeeId).toBe(context.employee.id);

    expect(result.type).toBe("ABSENCE");
    expect(result.startAt).toEqual(startAt);
    expect(result.endAt).toEqual(endAt);
  });

  it("allows an admin to create an unavailability for an employee", async () => {
    const context = await createContext();

    const result = await createEmployeeUnavailability(
      context.admin.currentUser,
      {
        employeeId: context.employee.id,
        type: "LEAVE",
        startAt: new Date("2026-09-10T10:00:00.000Z"),
        endAt: new Date("2026-09-10T12:00:00.000Z"),
      },
    );

    expect(result.type).toBe("LEAVE");
  });

  it("allows a responsible employee to manage another employee unavailability", async () => {
    const context = await createContext();

    const responsible = await createUser(context.salon.id, {
      role: "EMPLOYEE",
      canManageSalon: true,
      firstName: "Responsable",
    });

    const result = await createEmployeeUnavailability(responsible.currentUser, {
      employeeId: context.employee.id,
      type: "UNAVAILABLE",
      startAt: new Date("2026-09-10T10:00:00.000Z"),
      endAt: new Date("2026-09-10T11:00:00.000Z"),
    });

    expect(result.employeeId).toBe(context.employee.id);
  });

  it("rejects a standard employee trying to create an unavailability for another employee", async () => {
    const context = await createContext();

    const otherAccount = await createUser(context.salon.id);

    const otherEmployee = await testPrisma.employee.create({
      data: {
        salonId: context.salon.id,
        userId: otherAccount.user.id,
        firstName: "Sara",
      },
    });

    await expect(
      createEmployeeUnavailability(context.employeeAccount.currentUser, {
        employeeId: otherEmployee.id,
        type: "ABSENCE",
        startAt: new Date("2026-09-10T10:00:00.000Z"),
        endAt: new Date("2026-09-10T11:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("does not expose an employee from another salon", async () => {
    const contextA = await createContext();
    const contextB = await createContext();

    await expect(
      createEmployeeUnavailability(contextA.admin.currentUser, {
        employeeId: contextB.employee.id,
        type: "ABSENCE",
        startAt: new Date("2026-09-10T10:00:00.000Z"),
        endAt: new Date("2026-09-10T11:00:00.000Z"),
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
      createEmployeeUnavailability(context.admin.currentUser, {
        employeeId: context.employee.id,
        type: "ABSENCE",
        startAt: new Date("2026-09-10T10:00:00.000Z"),
        endAt: new Date("2026-09-10T11:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects an invalid time range", async () => {
    const context = await createContext();

    await expect(
      createEmployeeUnavailability(context.admin.currentUser, {
        employeeId: context.employee.id,
        type: "ABSENCE",
        startAt: new Date("2026-09-10T12:00:00.000Z"),
        endAt: new Date("2026-09-10T10:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects an overlapping employee unavailability", async () => {
    const context = await createContext();

    await createEmployeeUnavailability(context.admin.currentUser, {
      employeeId: context.employee.id,
      type: "BREAK",
      startAt: new Date("2026-09-10T10:00:00.000Z"),
      endAt: new Date("2026-09-10T12:00:00.000Z"),
    });

    await expect(
      createEmployeeUnavailability(context.admin.currentUser, {
        employeeId: context.employee.id,
        type: "ABSENCE",
        startAt: new Date("2026-09-10T11:00:00.000Z"),
        endAt: new Date("2026-09-10T13:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("allows adjacent unavailabilities", async () => {
    const context = await createContext();

    await createEmployeeUnavailability(context.admin.currentUser, {
      employeeId: context.employee.id,
      type: "BREAK",
      startAt: new Date("2026-09-10T10:00:00.000Z"),
      endAt: new Date("2026-09-10T11:00:00.000Z"),
    });

    const result = await createEmployeeUnavailability(
      context.admin.currentUser,
      {
        employeeId: context.employee.id,
        type: "ABSENCE",
        startAt: new Date("2026-09-10T11:00:00.000Z"),
        endAt: new Date("2026-09-10T12:00:00.000Z"),
      },
    );

    expect(result.id).toBeDefined();
  });

  it("rejects an unavailability overlapping an assigned appointment", async () => {
    const context = await createContext();

    const client = await testPrisma.client.create({
      data: {
        salonId: context.salon.id,
        phone: `+212${crypto.randomUUID().replaceAll("-", "").slice(0, 9)}`,
      },
    });

    await testPrisma.appointment.create({
      data: {
        salonId: context.salon.id,
        clientId: client.id,
        scheduledStart: new Date("2026-09-10T10:00:00.000Z"),
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
      createEmployeeUnavailability(context.admin.currentUser, {
        employeeId: context.employee.id,
        type: "ABSENCE",
        startAt: new Date("2026-09-10T10:30:00.000Z"),
        endAt: new Date("2026-09-10T11:30:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("creates an activity log", async () => {
    const context = await createContext();

    const result = await createEmployeeUnavailability(
      context.admin.currentUser,
      {
        employeeId: context.employee.id,
        type: "ABSENCE",
        startAt: new Date("2026-09-10T10:00:00.000Z"),
        endAt: new Date("2026-09-10T11:00:00.000Z"),
      },
    );

    const log = await testPrisma.activityLog.findFirst({
      where: {
        salonId: context.salon.id,
        entityId: result.id,
        action: "EMPLOYEE_UNAVAILABILITY_CREATED",
      },
    });

    expect(log).not.toBeNull();
  });
});
