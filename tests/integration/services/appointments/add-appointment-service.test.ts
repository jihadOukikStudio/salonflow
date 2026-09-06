import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";

import { addAppointmentService } from "@/server/services/appointments/add-appointment-service";

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

  return { user, currentUser };
}

async function createContext(params?: {
  status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CLOSED" | "CANCELLED";
}) {
  const salon = await testPrisma.salon.create({
    data: {
      name: `Salon ${crypto.randomUUID()}`,
    },
  });

  const admin = await createUser(salon.id, {
    role: "ADMIN",
    canManageSalon: true,
  });

  const employeeAccount = await createUser(salon.id);

  const employee = await testPrisma.employee.create({
    data: {
      salonId: salon.id,
      userId: employeeAccount.user.id,
      firstName: "Amina",
    },
  });

  const client = await testPrisma.client.create({
    data: {
      salonId: salon.id,
      phone: `+212${crypto.randomUUID().replaceAll("-", "").slice(0, 9)}`,
    },
  });

  const category = await testPrisma.serviceCategory.create({
    data: {
      salonId: salon.id,
      name: `Catégorie ${crypto.randomUUID()}`,
    },
  });

  const firstService = await testPrisma.service.create({
    data: {
      salonId: salon.id,
      categoryId: category.id,
      name: `Brushing ${crypto.randomUUID()}`,
      defaultDurationMinutes: 60,
      defaultPrice: 100,
    },
  });

  const secondService = await testPrisma.service.create({
    data: {
      salonId: salon.id,
      categoryId: category.id,
      name: `Manucure ${crypto.randomUUID()}`,
      defaultDurationMinutes: 30,
      defaultPrice: 150,
    },
  });

  const appointment = await testPrisma.appointment.create({
    data: {
      salonId: salon.id,
      clientId: client.id,

      scheduledStart: new Date("2026-09-10T10:00:00.000Z"),

      estimatedDurationMinutes: 60,

      status: params?.status ?? "PLANNED",

      createdByUserId: admin.user.id,

      services: {
        create: {
          serviceId: firstService.id,
          serviceNameSnapshot: firstService.name,
          durationMinutes: 60,
          price: 100,
        },
      },
    },
  });

  return {
    salon,
    admin,
    employeeAccount,
    employee,
    client,
    category,
    firstService,
    secondService,
    appointment,
  };
}

async function createBlockingAppointment(params: {
  salonId: string;
  createdByUserId: string;
  employeeId?: string;
  start: Date;
  durationMinutes: number;
  requiredRoomType?: "HAMAM" | "TREATMENT_ROOM";
  roomId?: string;
}) {
  const client = await testPrisma.client.create({
    data: {
      salonId: params.salonId,
      phone: `+212${crypto.randomUUID().replaceAll("-", "").slice(0, 9)}`,
    },
  });

  return testPrisma.appointment.create({
    data: {
      salonId: params.salonId,
      clientId: client.id,
      scheduledStart: params.start,
      estimatedDurationMinutes: params.durationMinutes,
      createdByUserId: params.createdByUserId,
      services: {
        create: {
          serviceNameSnapshot: `Blocage ${crypto.randomUUID()}`,
          durationMinutes: params.durationMinutes,
          price: 100,
          assignedEmployeeId: params.employeeId,
          requiredRoomTypeSnapshot: params.requiredRoomType,
          roomId: params.roomId,
        },
      },
    },
  });
}

describe("addAppointmentService", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("adds a service and recalculates appointment duration", async () => {
    const context = await createContext();

    const result = await addAppointmentService(context.admin.currentUser, {
      appointmentId: context.appointment.id,
      serviceId: context.secondService.id,
    });

    expect(result.services).toHaveLength(2);

    expect(result.estimatedDurationMinutes).toBe(90);

    const added = result.services.find(
      (service) => service.serviceId === context.secondService.id,
    );

    expect(added).toBeDefined();
    expect(added?.durationMinutes).toBe(30);
    expect(added?.price.toNumber()).toBe(150);
    expect(added?.status).toBe("TODO");
  });

  it("allows duration and price overrides", async () => {
    const context = await createContext();

    const result = await addAppointmentService(context.admin.currentUser, {
      appointmentId: context.appointment.id,
      serviceId: context.secondService.id,
      durationMinutes: 45,
      price: 175,
    });

    expect(result.estimatedDurationMinutes).toBe(105);

    const added = result.services.find(
      (service) => service.serviceId === context.secondService.id,
    );

    expect(added?.durationMinutes).toBe(45);
    expect(added?.price.toNumber()).toBe(175);
  });

  it("allows a responsible employee", async () => {
    const context = await createContext();

    const responsible = await createUser(context.salon.id, {
      role: "EMPLOYEE",
      canManageSalon: true,
    });

    const result = await addAppointmentService(responsible.currentUser, {
      appointmentId: context.appointment.id,
      serviceId: context.secondService.id,
    });

    expect(result.services).toHaveLength(2);
  });

  it("rejects a standard employee", async () => {
    const context = await createContext();

    await expect(
      addAppointmentService(context.employeeAccount.currentUser, {
        appointmentId: context.appointment.id,
        serviceId: context.secondService.id,
      }),
    ).rejects.toThrow();
  });

  it("does not expose another salon appointment", async () => {
    const contextA = await createContext();
    const contextB = await createContext();

    await expect(
      addAppointmentService(contextA.admin.currentUser, {
        appointmentId: contextB.appointment.id,
        serviceId: contextA.secondService.id,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("does not expose another salon service", async () => {
    const contextA = await createContext();
    const contextB = await createContext();

    await expect(
      addAppointmentService(contextA.admin.currentUser, {
        appointmentId: contextA.appointment.id,
        serviceId: contextB.secondService.id,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("rejects duplicate service", async () => {
    const context = await createContext();

    await expect(
      addAppointmentService(context.admin.currentUser, {
        appointmentId: context.appointment.id,
        serviceId: context.firstService.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects a service without usable duration", async () => {
    const context = await createContext();

    const service = await testPrisma.service.create({
      data: {
        salonId: context.salon.id,
        categoryId: context.category.id,
        name: `Sans durée ${crypto.randomUUID()}`,
        defaultDurationMinutes: null,
        defaultPrice: 200,
      },
    });

    await expect(
      addAppointmentService(context.admin.currentUser, {
        appointmentId: context.appointment.id,
        serviceId: service.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("allows adding to an unpaid COMPLETED appointment and reopens it", async () => {
    const context = await createContext({
      status: "COMPLETED",
    });

    const result = await addAppointmentService(context.admin.currentUser, {
      appointmentId: context.appointment.id,
      serviceId: context.secondService.id,
    });

    expect(result.status).toBe("IN_PROGRESS");
    expect(result.services).toHaveLength(2);
    expect(result.estimatedDurationMinutes).toBe(90);

    const added = result.services.find(
      (service) => service.serviceId === context.secondService.id,
    );

    expect(added?.status).toBe("TODO");
  });

  it("rejects adding to a paid COMPLETED appointment", async () => {
    const context = await createContext({
      status: "COMPLETED",
    });

    await testPrisma.payment.create({
      data: {
        appointmentId: context.appointment.id,
        amount: 100,
        method: "CASH",
        status: "PAID",
        paidAt: new Date(),
        recordedByUserId: context.admin.user.id,
      },
    });

    await expect(
      addAppointmentService(context.admin.currentUser, {
        appointmentId: context.appointment.id,
        serviceId: context.secondService.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it.each(["CLOSED", "CANCELLED"] as const)(
    "rejects appointment status %s",
    async (status) => {
      const context = await createContext({
        status,
      });

      await expect(
        addAppointmentService(context.admin.currentUser, {
          appointmentId: context.appointment.id,
          serviceId: context.secondService.id,
        }),
      ).rejects.toBeInstanceOf(BusinessRuleError);
    },
  );

  it("allows adding a service while appointment is in progress", async () => {
    const context = await createContext({
      status: "IN_PROGRESS",
    });

    const result = await addAppointmentService(context.admin.currentUser, {
      appointmentId: context.appointment.id,
      serviceId: context.secondService.id,
    });

    expect(result.services).toHaveLength(2);
  });

  it("creates an activity log", async () => {
    const context = await createContext();

    const result = await addAppointmentService(context.admin.currentUser, {
      appointmentId: context.appointment.id,
      serviceId: context.secondService.id,
    });

    const added = result.services.find(
      (service) => service.serviceId === context.secondService.id,
    );

    const log = await testPrisma.activityLog.findFirst({
      where: {
        salonId: context.salon.id,
        action: "APPOINTMENT_SERVICE_ADDED",
        entityId: added?.id,
      },
    });

    expect(log).not.toBeNull();
  });

  it("blocks a direct backend add when no employee capacity remains", async () => {
    const context = await createContext();

    await createBlockingAppointment({
      salonId: context.salon.id,
      createdByUserId: context.admin.user.id,
      employeeId: context.employee.id,
      start: new Date("2026-09-10T10:30:00.000Z"),
      durationMinutes: 60,
    });

    await expect(
      addAppointmentService(context.admin.currentUser, {
        appointmentId: context.appointment.id,
        serviceId: context.secondService.id,
      }),
    ).rejects.toThrow("capacité employée");

    const stored = await testPrisma.appointment.findUnique({
      where: { id: context.appointment.id },
      include: { services: true },
    });

    expect(stored?.services).toHaveLength(1);
    expect(stored?.estimatedDurationMinutes).toBe(60);
  });

  it("blocks a direct backend add when a required room has no capacity", async () => {
    const context = await createContext();

    await testPrisma.service.update({
      where: {
        id: context.secondService.id,
      },
      data: {
        requiredRoomType: "TREATMENT_ROOM",
      },
    });

    await expect(
      addAppointmentService(context.admin.currentUser, {
        appointmentId: context.appointment.id,
        serviceId: context.secondService.id,
      }),
    ).rejects.toThrow("salle de soins");

    const stored = await testPrisma.appointment.findUnique({
      where: { id: context.appointment.id },
      include: { services: true },
    });

    expect(stored?.services).toHaveLength(1);
    expect(stored?.estimatedDurationMinutes).toBe(60);
  });

  it("uses the effective duration override in the final capacity barrier", async () => {
    const context = await createContext();

    await createBlockingAppointment({
      salonId: context.salon.id,
      createdByUserId: context.admin.user.id,
      employeeId: context.employee.id,
      start: new Date("2026-09-10T11:40:00.000Z"),
      durationMinutes: 30,
    });

    /*
     * Avec la durée catalogue (30 min), le RDV finirait à 11:30 et passerait.
     * Avec l'override réel (45 min), il finit à 11:45 et doit être bloqué.
     */
    await expect(
      addAppointmentService(context.admin.currentUser, {
        appointmentId: context.appointment.id,
        serviceId: context.secondService.id,
        durationMinutes: 45,
      }),
    ).rejects.toThrow("capacité employée");

    const stored = await testPrisma.appointment.findUnique({
      where: { id: context.appointment.id },
      include: { services: true },
    });

    expect(stored?.services).toHaveLength(1);
    expect(stored?.estimatedDurationMinutes).toBe(60);
  });

  it("does not write a service, duration or log when the final barrier fails", async () => {
    const context = await createContext();

    await createBlockingAppointment({
      salonId: context.salon.id,
      createdByUserId: context.admin.user.id,
      employeeId: context.employee.id,
      start: new Date("2026-09-10T10:30:00.000Z"),
      durationMinutes: 60,
    });

    const logsBefore = await testPrisma.activityLog.count({
      where: {
        salonId: context.salon.id,
        action: "APPOINTMENT_SERVICE_ADDED",
      },
    });

    await expect(
      addAppointmentService(context.admin.currentUser, {
        appointmentId: context.appointment.id,
        serviceId: context.secondService.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);

    const [stored, logsAfter] = await Promise.all([
      testPrisma.appointment.findUnique({
        where: {
          id: context.appointment.id,
        },
        include: {
          services: true,
        },
      }),
      testPrisma.activityLog.count({
        where: {
          salonId: context.salon.id,
          action: "APPOINTMENT_SERVICE_ADDED",
        },
      }),
    ]);

    expect(stored?.services).toHaveLength(1);
    expect(stored?.estimatedDurationMinutes).toBe(60);
    expect(logsAfter).toBe(logsBefore);
  });

  it("serializes two concurrent additions of the same service", async () => {
    const context = await createContext();

    const results = await Promise.allSettled([
      addAppointmentService(context.admin.currentUser, {
        appointmentId: context.appointment.id,
        serviceId: context.secondService.id,
      }),

      addAppointmentService(context.admin.currentUser, {
        appointmentId: context.appointment.id,
        serviceId: context.secondService.id,
      }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);

    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);

    const stored = await testPrisma.appointment.findUnique({
      where: {
        id: context.appointment.id,
      },

      include: {
        services: true,
      },
    });

    expect(stored?.services).toHaveLength(2);
    expect(stored?.estimatedDurationMinutes).toBe(90);
  });
});
