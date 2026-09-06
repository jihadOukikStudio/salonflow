import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";

import { createRoomUnavailability } from "@/server/services/rooms/create-room-unavailability";

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
  });

  const room = await testPrisma.room.create({
    data: {
      salonId: salon.id,
      name: `Salle ${crypto.randomUUID()}`,
      type: "TREATMENT_ROOM",
      capacity: 1,
    },
  });

  return {
    salon,
    admin,
    room,
  };
}

describe("createRoomUnavailability", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("allows an admin to create a room unavailability", async () => {
    const context = await createContext();

    const result = await createRoomUnavailability(context.admin.currentUser, {
      roomId: context.room.id,
      startAt: new Date("2026-09-10T10:00:00.000Z"),
      endAt: new Date("2026-09-10T12:00:00.000Z"),
      reason: "Maintenance",
    });

    expect(result.roomId).toBe(context.room.id);

    expect(result.reason).toBe("Maintenance");
  });

  it("allows a responsible employee to create a room unavailability", async () => {
    const context = await createContext();

    const responsible = await createUser(context.salon.id, {
      role: "EMPLOYEE",
      canManageSalon: true,
    });

    const result = await createRoomUnavailability(responsible.currentUser, {
      roomId: context.room.id,
      startAt: new Date("2026-09-10T10:00:00.000Z"),
      endAt: new Date("2026-09-10T11:00:00.000Z"),
    });

    expect(result.id).toBeDefined();
  });

  it("rejects a standard employee", async () => {
    const context = await createContext();

    const employee = await createUser(context.salon.id, {
      role: "EMPLOYEE",
      canManageSalon: false,
    });

    await expect(
      createRoomUnavailability(employee.currentUser, {
        roomId: context.room.id,
        startAt: new Date("2026-09-10T10:00:00.000Z"),
        endAt: new Date("2026-09-10T11:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it("does not expose a room from another salon", async () => {
    const contextA = await createContext();
    const contextB = await createContext();

    await expect(
      createRoomUnavailability(contextA.admin.currentUser, {
        roomId: contextB.room.id,
        startAt: new Date("2026-09-10T10:00:00.000Z"),
        endAt: new Date("2026-09-10T11:00:00.000Z"),
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
      createRoomUnavailability(context.admin.currentUser, {
        roomId: context.room.id,
        startAt: new Date("2026-09-10T10:00:00.000Z"),
        endAt: new Date("2026-09-10T11:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects an invalid time range", async () => {
    const context = await createContext();

    await expect(
      createRoomUnavailability(context.admin.currentUser, {
        roomId: context.room.id,
        startAt: new Date("2026-09-10T12:00:00.000Z"),
        endAt: new Date("2026-09-10T10:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects overlapping room unavailability", async () => {
    const context = await createContext();

    await createRoomUnavailability(context.admin.currentUser, {
      roomId: context.room.id,
      startAt: new Date("2026-09-10T10:00:00.000Z"),
      endAt: new Date("2026-09-10T12:00:00.000Z"),
    });

    await expect(
      createRoomUnavailability(context.admin.currentUser, {
        roomId: context.room.id,
        startAt: new Date("2026-09-10T11:00:00.000Z"),
        endAt: new Date("2026-09-10T13:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("allows adjacent room unavailabilities", async () => {
    const context = await createContext();

    await createRoomUnavailability(context.admin.currentUser, {
      roomId: context.room.id,
      startAt: new Date("2026-09-10T10:00:00.000Z"),
      endAt: new Date("2026-09-10T11:00:00.000Z"),
    });

    const result = await createRoomUnavailability(context.admin.currentUser, {
      roomId: context.room.id,
      startAt: new Date("2026-09-10T11:00:00.000Z"),
      endAt: new Date("2026-09-10T12:00:00.000Z"),
    });

    expect(result.id).toBeDefined();
  });

  it("rejects an unavailability overlapping a room assignment", async () => {
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
            serviceNameSnapshot: "Soin visage",
            durationMinutes: 60,
            price: 250,
            requiredRoomTypeSnapshot: "TREATMENT_ROOM",
            roomId: context.room.id,
          },
        },
      },
    });

    await expect(
      createRoomUnavailability(context.admin.currentUser, {
        roomId: context.room.id,

        startAt: new Date("2026-09-10T10:30:00.000Z"),

        endAt: new Date("2026-09-10T11:30:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("creates an activity log", async () => {
    const context = await createContext();

    const result = await createRoomUnavailability(context.admin.currentUser, {
      roomId: context.room.id,
      startAt: new Date("2026-09-10T10:00:00.000Z"),
      endAt: new Date("2026-09-10T11:00:00.000Z"),
    });

    const log = await testPrisma.activityLog.findFirst({
      where: {
        salonId: context.salon.id,
        entityId: result.id,
        action: "ROOM_UNAVAILABILITY_CREATED",
      },
    });

    expect(log).not.toBeNull();
  });
});
