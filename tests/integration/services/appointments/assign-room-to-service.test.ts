import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";
import { assignRoomToService } from "@/server/services/appointments/assign-room-to-service";
import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

import { cleanDatabase } from "../../helpers/database";
import { testPrisma } from "../../helpers/prisma";

async function createContext(params?: {
  role?: "ADMIN" | "EMPLOYEE";
  canManageSalon?: boolean;
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
      firstName: "User",
      role: params?.role ?? "ADMIN",
      canManageSalon: params?.canManageSalon ?? true,
    },
  });

  const client = await testPrisma.client.create({
    data: {
      salonId: salon.id,
      name: "Cliente",
      phone: `+212${crypto.randomUUID().replaceAll("-", "").slice(0, 9)}`,
    },
  });

  const room = await testPrisma.room.create({
    data: {
      salonId: salon.id,
      name: "Salle de soins 1",
      type: "TREATMENT_ROOM",
      capacity: 1,
    },
  });

  const hamamRoom = await testPrisma.room.create({
    data: {
      salonId: salon.id,
      name: "Hamam individuel",
      type: "HAMAM",
      capacity: 1,
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
          serviceNameSnapshot: "Massage",
          durationMinutes: 60,
          price: 350,
          requiredRoomTypeSnapshot:
            params?.requiredRoomType === undefined
              ? "TREATMENT_ROOM"
              : params.requiredRoomType,
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
    client,
    room,
    hamamRoom,
    appointment,
    appointmentService,
  };
}

describe("assignRoomToService", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("allows an admin to assign a room", async () => {
    const context = await createContext();

    const result = await assignRoomToService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
      roomId: context.room.id,
    });

    expect(result.roomId).toBe(context.room.id);
    expect(result.room?.id).toBe(context.room.id);
  });

  it("allows an employee with salon management access to assign a room", async () => {
    const context = await createContext({
      role: "EMPLOYEE",
      canManageSalon: true,
    });

    const result = await assignRoomToService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
      roomId: context.room.id,
    });

    expect(result.roomId).toBe(context.room.id);
  });

  it("allows a standard employee to assign a room operationally", async () => {
    const context = await createContext({
      role: "EMPLOYEE",
      canManageSalon: false,
    });

    const result = await assignRoomToService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
      roomId: context.room.id,
    });

    expect(result.roomId).toBe(context.room.id);
  });

  it("rejects a room belonging to another salon", async () => {
    const salonA = await createContext();
    const salonB = await createContext();

    await expect(
      assignRoomToService(salonA.currentUser, {
        appointmentServiceId: salonA.appointmentService.id,
        roomId: salonB.room.id,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    const service = await testPrisma.appointmentService.findUnique({
      where: {
        id: salonA.appointmentService.id,
      },
    });

    expect(service?.roomId).toBeNull();
  });

  it("rejects an appointment service belonging to another salon", async () => {
    const salonA = await createContext();
    const salonB = await createContext();

    await expect(
      assignRoomToService(salonA.currentUser, {
        appointmentServiceId: salonB.appointmentService.id,
        roomId: salonA.room.id,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("rejects an inactive room", async () => {
    const context = await createContext();

    await testPrisma.room.update({
      where: {
        id: context.room.id,
      },
      data: {
        isActive: false,
      },
    });

    await expect(
      assignRoomToService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
        roomId: context.room.id,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    const service = await testPrisma.appointmentService.findUnique({
      where: {
        id: context.appointmentService.id,
      },
    });

    expect(service?.roomId).toBeNull();
  });

  it("rejects a room with an incompatible type", async () => {
    const context = await createContext({
      requiredRoomType: "TREATMENT_ROOM",
    });

    await expect(
      assignRoomToService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
        roomId: context.hamamRoom.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);

    const service = await testPrisma.appointmentService.findUnique({
      where: {
        id: context.appointmentService.id,
      },
    });

    expect(service?.roomId).toBeNull();
  });

  it("allows assigning a room when the service has no required room type", async () => {
    const context = await createContext({
      requiredRoomType: null,
    });

    const result = await assignRoomToService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
      roomId: context.hamamRoom.id,
    });

    expect(result.roomId).toBe(context.hamamRoom.id);
  });

  it("rejects assignment when the room is unavailable", async () => {
    const context = await createContext();

    await testPrisma.roomUnavailability.create({
      data: {
        roomId: context.room.id,
        startAt: new Date("2026-09-10T09:30:00.000Z"),
        endAt: new Date("2026-09-10T10:30:00.000Z"),
        reason: "Maintenance",
        createdByUserId: context.user.id,
      },
    });

    await expect(
      assignRoomToService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
        roomId: context.room.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);

    const service = await testPrisma.appointmentService.findUnique({
      where: {
        id: context.appointmentService.id,
      },
    });

    expect(service?.roomId).toBeNull();
  });

  it("allows assignment when room unavailability starts exactly when appointment ends", async () => {
    const context = await createContext();

    await testPrisma.roomUnavailability.create({
      data: {
        roomId: context.room.id,
        startAt: new Date("2026-09-10T11:00:00.000Z"),
        endAt: new Date("2026-09-10T12:00:00.000Z"),
        reason: "Maintenance",
        createdByUserId: context.user.id,
      },
    });

    const result = await assignRoomToService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
      roomId: context.room.id,
    });

    expect(result.roomId).toBe(context.room.id);
  });

  it("rejects assignment when the room is already used by an overlapping appointment", async () => {
    const context = await createContext();

    const otherClient = await testPrisma.client.create({
      data: {
        salonId: context.salon.id,
        name: "Autre cliente",
        phone: "+212600000201",
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
            serviceNameSnapshot: "Soin visage",
            durationMinutes: 60,
            price: 500,
            requiredRoomTypeSnapshot: "TREATMENT_ROOM",
            roomId: context.room.id,
          },
        },
      },
    });

    await expect(
      assignRoomToService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
        roomId: context.room.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);

    const service = await testPrisma.appointmentService.findUnique({
      where: {
        id: context.appointmentService.id,
      },
    });

    expect(service?.roomId).toBeNull();
  });

  it("allows adjacent appointments without room overlap", async () => {
    const context = await createContext();

    const otherClient = await testPrisma.client.create({
      data: {
        salonId: context.salon.id,
        name: "Autre cliente",
        phone: "+212600000202",
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
            serviceNameSnapshot: "Soin visage",
            durationMinutes: 60,
            price: 500,
            requiredRoomTypeSnapshot: "TREATMENT_ROOM",
            roomId: context.room.id,
          },
        },
      },
    });

    const result = await assignRoomToService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
      roomId: context.room.id,
    });

    expect(result.roomId).toBe(context.room.id);
  });

  it("ignores room conflicts from cancelled appointments", async () => {
    const context = await createContext();

    const otherClient = await testPrisma.client.create({
      data: {
        salonId: context.salon.id,
        name: "Autre cliente",
        phone: "+212600000203",
      },
    });

    await testPrisma.appointment.create({
      data: {
        salonId: context.salon.id,
        clientId: otherClient.id,
        scheduledStart: new Date("2026-09-10T10:30:00.000Z"),
        estimatedDurationMinutes: 60,
        status: "CANCELLED",
        createdByUserId: context.user.id,

        services: {
          create: {
            serviceNameSnapshot: "Soin visage",
            durationMinutes: 60,
            price: 500,
            requiredRoomTypeSnapshot: "TREATMENT_ROOM",
            roomId: context.room.id,
          },
        },
      },
    });

    const result = await assignRoomToService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
      roomId: context.room.id,
    });

    expect(result.roomId).toBe(context.room.id);
  });

  it("ignores room conflicts from closed appointments", async () => {
    const context = await createContext();

    const otherClient = await testPrisma.client.create({
      data: {
        salonId: context.salon.id,
        name: "Autre cliente",
        phone: "+212600000204",
      },
    });

    await testPrisma.appointment.create({
      data: {
        salonId: context.salon.id,
        clientId: otherClient.id,
        scheduledStart: new Date("2026-09-10T10:30:00.000Z"),
        estimatedDurationMinutes: 60,
        status: "CLOSED",
        createdByUserId: context.user.id,

        services: {
          create: {
            serviceNameSnapshot: "Soin visage",
            durationMinutes: 60,
            price: 500,
            requiredRoomTypeSnapshot: "TREATMENT_ROOM",
            roomId: context.room.id,
          },
        },
      },
    });

    const result = await assignRoomToService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
      roomId: context.room.id,
    });

    expect(result.roomId).toBe(context.room.id);
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
      assignRoomToService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
        roomId: context.room.id,
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
      assignRoomToService(context.currentUser, {
        appointmentServiceId: context.appointmentService.id,
        roomId: context.room.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("creates an activity log when assigning a room", async () => {
    const context = await createContext();

    await assignRoomToService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
      roomId: context.room.id,
    });

    const log = await testPrisma.activityLog.findFirst({
      where: {
        salonId: context.salon.id,
        entityId: context.appointmentService.id,
      },
    });

    expect(log?.action).toBe("APPOINTMENT_SERVICE_ROOM_ASSIGNED");
    expect(log?.userId).toBe(context.user.id);
  });

  it("traces a room reassignment", async () => {
    const context = await createContext();

    const secondRoom = await testPrisma.room.create({
      data: {
        salonId: context.salon.id,
        name: "Salle de soins 2",
        type: "TREATMENT_ROOM",
        capacity: 1,
      },
    });

    await assignRoomToService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
      roomId: context.room.id,
    });

    await assignRoomToService(context.currentUser, {
      appointmentServiceId: context.appointmentService.id,
      roomId: secondRoom.id,
    });

    const service = await testPrisma.appointmentService.findUnique({
      where: {
        id: context.appointmentService.id,
      },
    });

    expect(service?.roomId).toBe(secondRoom.id);

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

    expect(logs[0]?.action).toBe("APPOINTMENT_SERVICE_ROOM_ASSIGNED");

    expect(logs[1]?.action).toBe("APPOINTMENT_SERVICE_ROOM_REASSIGNED");
  });
});
