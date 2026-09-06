import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";
import { addAppointmentService } from "@/server/services/appointments/add-appointment-service";
import { BusinessRuleError } from "@/server/services/errors";

import { cleanDatabase } from "../../helpers/database";
import { testPrisma } from "../../helpers/prisma";

async function createContext(params?: {
  requiredRoomType?: "HAMAM" | "TREATMENT_ROOM" | null;
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
      firstName: "Admin",
      role: "ADMIN",
      canManageSalon: true,
    },
  });

  const employeeA = await testPrisma.employee.create({
    data: {
      salonId: salon.id,
      firstName: "Amina",
    },
  });

  const employeeB = await testPrisma.employee.create({
    data: {
      salonId: salon.id,
      firstName: "Sara",
    },
  });

  const roomA = await testPrisma.room.create({
    data: {
      salonId: salon.id,
      name: "Salle de soins 1",
      type: "TREATMENT_ROOM",
      capacity: 1,
    },
  });

  const roomB = await testPrisma.room.create({
    data: {
      salonId: salon.id,
      name: "Salle de soins 2",
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

  const addedService = await testPrisma.service.create({
    data: {
      salonId: salon.id,
      categoryId: category.id,
      name: `Soin ${crypto.randomUUID()}`,
      defaultDurationMinutes: 30,
      defaultPrice: 150,
      requiredRoomType:
        params?.requiredRoomType === undefined
          ? "TREATMENT_ROOM"
          : params.requiredRoomType,
    },
  });

  const appointment = await testPrisma.appointment.create({
    data: {
      salonId: salon.id,
      clientId: client.id,
      scheduledStart: new Date("2026-09-10T10:00:00.000Z"),
      estimatedDurationMinutes: 60,
      status: "IN_PROGRESS",
      createdByUserId: user.id,
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
    currentUser,
    employeeA,
    employeeB,
    roomA,
    roomB,
    client,
    category,
    firstService,
    addedService,
    appointment,
  };
}

describe("addAppointmentService — atomic resources", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("adds the service, employee and room atomically", async () => {
    const context = await createContext();

    const result = await addAppointmentService(context.currentUser, {
      appointmentId: context.appointment.id,
      serviceId: context.addedService.id,
      employeeId: context.employeeB.id,
      roomId: context.roomB.id,
    });

    const added = result.services.find(
      (service) => service.serviceId === context.addedService.id,
    );

    expect(added).toBeDefined();
    expect(added?.assignedEmployeeId).toBe(context.employeeB.id);
    expect(added?.roomId).toBe(context.roomB.id);
    expect(result.estimatedDurationMinutes).toBe(90);

    const logs = await testPrisma.activityLog.findMany({
      where: {
        salonId: context.salon.id,
        entityId: added?.id,
      },
    });

    expect(logs.map((log) => log.action)).toEqual(
      expect.arrayContaining([
        "APPOINTMENT_SERVICE_ADDED",
        "APPOINTMENT_SERVICE_ASSIGNED",
        "APPOINTMENT_SERVICE_ROOM_ASSIGNED",
      ]),
    );
  });

  it("keeps the service unassigned when no resource is selected", async () => {
    const context = await createContext({
      requiredRoomType: null,
    });

    const result = await addAppointmentService(context.currentUser, {
      appointmentId: context.appointment.id,
      serviceId: context.addedService.id,
    });

    const added = result.services.find(
      (service) => service.serviceId === context.addedService.id,
    );

    expect(added?.assignedEmployeeId).toBeNull();
    expect(added?.roomId).toBeNull();
  });

  it("rolls everything back when the selected employee became unavailable", async () => {
    const context = await createContext();

    await testPrisma.employeeUnavailability.create({
      data: {
        employeeId: context.employeeB.id,
        type: "ABSENCE",
        startAt: new Date("2026-09-10T10:15:00.000Z"),
        endAt: new Date("2026-09-10T12:00:00.000Z"),
        createdByUserId: context.user.id,
      },
    });

    await expect(
      addAppointmentService(context.currentUser, {
        appointmentId: context.appointment.id,
        serviceId: context.addedService.id,
        employeeId: context.employeeB.id,
        roomId: context.roomB.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);

    const stored = await testPrisma.appointment.findUnique({
      where: {
        id: context.appointment.id,
      },
      include: {
        services: true,
      },
    });

    expect(stored?.services).toHaveLength(1);
    expect(stored?.estimatedDurationMinutes).toBe(60);

    expect(
      await testPrisma.activityLog.count({
        where: {
          salonId: context.salon.id,
          action: "APPOINTMENT_SERVICE_ADDED",
        },
      }),
    ).toBe(0);
  });

  it("rolls everything back when the selected room became unavailable", async () => {
    const context = await createContext();

    await testPrisma.roomUnavailability.create({
      data: {
        roomId: context.roomB.id,
        startAt: new Date("2026-09-10T10:15:00.000Z"),
        endAt: new Date("2026-09-10T12:00:00.000Z"),
        reason: "Maintenance",
        createdByUserId: context.user.id,
      },
    });

    await expect(
      addAppointmentService(context.currentUser, {
        appointmentId: context.appointment.id,
        serviceId: context.addedService.id,
        employeeId: context.employeeB.id,
        roomId: context.roomB.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);

    const stored = await testPrisma.appointment.findUnique({
      where: {
        id: context.appointment.id,
      },
      include: {
        services: true,
      },
    });

    expect(stored?.services).toHaveLength(1);
    expect(stored?.estimatedDurationMinutes).toBe(60);
  });

  it("rejects an incompatible selected room without partial writes", async () => {
    const context = await createContext();

    const hamam = await testPrisma.room.create({
      data: {
        salonId: context.salon.id,
        name: "Hamam individuel",
        type: "HAMAM",
        capacity: 1,
      },
    });

    await expect(
      addAppointmentService(context.currentUser, {
        appointmentId: context.appointment.id,
        serviceId: context.addedService.id,
        employeeId: context.employeeB.id,
        roomId: hamam.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);

    const stored = await testPrisma.appointment.findUnique({
      where: {
        id: context.appointment.id,
      },
      include: {
        services: true,
      },
    });

    expect(stored?.services).toHaveLength(1);
    expect(stored?.estimatedDurationMinutes).toBe(60);
  });
});
