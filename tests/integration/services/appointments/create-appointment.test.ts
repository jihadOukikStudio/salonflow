import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";
import { PermissionDeniedError } from "@/server/permissions";
import { createAppointment } from "@/server/services/appointments/create-appointment";
import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

import { cleanDatabase } from "../../helpers/database";
import { testPrisma } from "../../helpers/prisma";

async function createContext(params?: {
  salonName?: string;
  role?: "ADMIN" | "EMPLOYEE";
  canManageSalon?: boolean;
  isActive?: boolean;
}) {
  const salon = await testPrisma.salon.create({
    data: {
      name: params?.salonName ?? "Salon A",
    },
  });

  const user = await testPrisma.user.create({
    data: {
      salonId: salon.id,
      email: `${crypto.randomUUID()}@test.local`,
      passwordHash: "test-hash",
      firstName: "Test",
      role: params?.role ?? "ADMIN",
      canManageSalon: params?.canManageSalon ?? true,
      isActive: params?.isActive ?? true,
    },
  });

  /*
   * Depuis l'anti-surbooking, un rendez-vous ne peut être créé que si le
   * salon dispose d'au moins une employée active. Cette employée représente
   * la capacité opérationnelle du salon ; elle n'a pas besoin d'être liée au
   * compte qui crée le rendez-vous.
   */
  const employee = await testPrisma.employee.create({
    data: {
      salonId: salon.id,
      firstName: "Amina",
      isActive: true,
    },
  });

  const client = await testPrisma.client.create({
    data: {
      salonId: salon.id,
      phone: `+212${crypto.randomUUID().replaceAll("-", "").slice(0, 9)}`,
      name: "Cliente",
    },
  });

  const category = await testPrisma.serviceCategory.create({
    data: {
      salonId: salon.id,
      name: `Catégorie ${crypto.randomUUID()}`,
    },
  });

  const service = await testPrisma.service.create({
    data: {
      salonId: salon.id,
      categoryId: category.id,
      name: "Brushing",
      defaultDurationMinutes: 60,
      defaultPrice: 100,
    },
  });

  const currentUser: CurrentUser = {
    id: user.id,
    salonId: salon.id,
    role: user.role,
    canManageSalon: user.canManageSalon,
    isActive: user.isActive,
  };

  return {
    salon,
    user,
    employee,
    currentUser,
    client,
    category,
    service,
  };
}

describe("createAppointment", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("creates an appointment with immutable service snapshots", async () => {
    const context = await createContext();

    const appointment = await createAppointment(context.currentUser, {
      clientId: context.client.id,
      scheduledStart: new Date("2026-09-10T10:00:00.000Z"),
      services: [
        {
          serviceId: context.service.id,
        },
      ],
    });

    expect(appointment.salonId).toBe(context.salon.id);
    expect(appointment.clientId).toBe(context.client.id);
    expect(appointment.createdByUserId).toBe(context.user.id);
    expect(appointment.estimatedDurationMinutes).toBe(60);

    expect(appointment.services).toHaveLength(1);
    expect(appointment.services[0]?.serviceNameSnapshot).toBe("Brushing");
    expect(appointment.services[0]?.durationMinutes).toBe(60);
    expect(appointment.services[0]?.price.toNumber()).toBe(100);
  });

  it("allows an appointment-specific duration and price override", async () => {
    const context = await createContext();

    const appointment = await createAppointment(context.currentUser, {
      clientId: context.client.id,
      scheduledStart: new Date("2026-09-10T10:00:00.000Z"),
      services: [
        {
          serviceId: context.service.id,
          durationMinutes: 90,
          price: 150,
        },
      ],
    });

    expect(appointment.estimatedDurationMinutes).toBe(90);
    expect(appointment.services[0]?.durationMinutes).toBe(90);
    expect(appointment.services[0]?.price.toNumber()).toBe(150);
  });

  it("creates an activity log", async () => {
    const context = await createContext();

    const appointment = await createAppointment(context.currentUser, {
      clientId: context.client.id,
      scheduledStart: new Date("2026-09-10T10:00:00.000Z"),
      services: [
        {
          serviceId: context.service.id,
        },
      ],
    });

    const logs = await testPrisma.activityLog.findMany({
      where: {
        salonId: context.salon.id,
        entityId: appointment.id,
      },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe("APPOINTMENT_CREATED");
    expect(logs[0]?.userId).toBe(context.user.id);
  });

  it("allows an employee with salon management permission", async () => {
    const context = await createContext({
      role: "EMPLOYEE",
      canManageSalon: true,
    });

    const appointment = await createAppointment(context.currentUser, {
      clientId: context.client.id,
      scheduledStart: new Date("2026-09-10T10:00:00.000Z"),
      services: [
        {
          serviceId: context.service.id,
        },
      ],
    });

    expect(appointment.id).toBeDefined();
  });

  it("rejects a standard employee", async () => {
    const context = await createContext({
      role: "EMPLOYEE",
      canManageSalon: false,
    });

    await expect(
      createAppointment(context.currentUser, {
        clientId: context.client.id,
        scheduledStart: new Date("2026-09-10T10:00:00.000Z"),
        services: [
          {
            serviceId: context.service.id,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);

    expect(await testPrisma.appointment.count()).toBe(0);
  });

  it("rejects an inactive user", async () => {
    const context = await createContext({
      isActive: false,
    });

    await expect(
      createAppointment(context.currentUser, {
        clientId: context.client.id,
        scheduledStart: new Date("2026-09-10T10:00:00.000Z"),
        services: [
          {
            serviceId: context.service.id,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);

    expect(await testPrisma.appointment.count()).toBe(0);
  });

  it("rejects a client belonging to another salon", async () => {
    const salonA = await createContext({
      salonName: "Salon A",
    });

    const salonB = await createContext({
      salonName: "Salon B",
    });

    await expect(
      createAppointment(salonA.currentUser, {
        clientId: salonB.client.id,
        scheduledStart: new Date("2026-09-10T10:00:00.000Z"),
        services: [
          {
            serviceId: salonA.service.id,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    expect(await testPrisma.appointment.count()).toBe(0);
  });

  it("rejects a service belonging to another salon", async () => {
    const salonA = await createContext({
      salonName: "Salon A",
    });

    const salonB = await createContext({
      salonName: "Salon B",
    });

    await expect(
      createAppointment(salonA.currentUser, {
        clientId: salonA.client.id,
        scheduledStart: new Date("2026-09-10T10:00:00.000Z"),
        services: [
          {
            serviceId: salonB.service.id,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    expect(await testPrisma.appointment.count()).toBe(0);
  });

  it("rejects an inactive service", async () => {
    const context = await createContext();

    await testPrisma.service.update({
      where: {
        id: context.service.id,
      },
      data: {
        isActive: false,
      },
    });

    await expect(
      createAppointment(context.currentUser, {
        clientId: context.client.id,
        scheduledStart: new Date("2026-09-10T10:00:00.000Z"),
        services: [
          {
            serviceId: context.service.id,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    expect(await testPrisma.appointment.count()).toBe(0);
  });

  it("requires a usable service duration", async () => {
    const context = await createContext();

    await testPrisma.service.update({
      where: {
        id: context.service.id,
      },
      data: {
        defaultDurationMinutes: null,
      },
    });

    await expect(
      createAppointment(context.currentUser, {
        clientId: context.client.id,
        scheduledStart: new Date("2026-09-10T10:00:00.000Z"),
        services: [
          {
            serviceId: context.service.id,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);

    expect(await testPrisma.appointment.count()).toBe(0);
  });

  it("rejects an appointment without services", async () => {
    const context = await createContext();

    await expect(
      createAppointment(context.currentUser, {
        clientId: context.client.id,
        scheduledStart: new Date("2026-09-10T10:00:00.000Z"),
        services: [],
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);

    expect(await testPrisma.appointment.count()).toBe(0);
  });

  it("rolls back everything when creation fails", async () => {
    const context = await createContext();

    await testPrisma.service.update({
      where: {
        id: context.service.id,
      },
      data: {
        defaultDurationMinutes: null,
      },
    });

    await expect(
      createAppointment(context.currentUser, {
        clientId: context.client.id,
        scheduledStart: new Date("2026-09-10T10:00:00.000Z"),
        services: [
          {
            serviceId: context.service.id,
          },
        ],
      }),
    ).rejects.toThrow();

    expect(await testPrisma.appointment.count()).toBe(0);
    expect(await testPrisma.appointmentService.count()).toBe(0);
    expect(await testPrisma.activityLog.count()).toBe(0);
  });
});
