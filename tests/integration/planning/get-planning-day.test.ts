import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";
import { getPlanningDay } from "@/features/planning/server/get-planning-day";

import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

async function createSalonContext() {
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

  const currentUser: CurrentUser = {
    id: user.id,
    salonId: salon.id,
    role: "ADMIN",
    canManageSalon: true,
    isActive: true,
  };

  const client = await testPrisma.client.create({
    data: {
      salonId: salon.id,
      name: "Cliente Test",
      phone: `+212${crypto.randomUUID().replaceAll("-", "").slice(0, 9)}`,
    },
  });

  return {
    salon,
    user,
    currentUser,
    client,
  };
}

describe("getPlanningDay", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("returns only appointments from the current salon", async () => {
    const contextA = await createSalonContext();
    const contextB = await createSalonContext();

    await testPrisma.appointment.create({
      data: {
        salonId: contextA.salon.id,
        clientId: contextA.client.id,
        scheduledStart: new Date("2026-09-05T09:00:00.000Z"),
        estimatedDurationMinutes: 60,
        createdByUserId: contextA.user.id,

        services: {
          create: {
            serviceNameSnapshot: "Brushing",
            durationMinutes: 60,
            price: 150,
          },
        },
      },
    });

    await testPrisma.appointment.create({
      data: {
        salonId: contextB.salon.id,
        clientId: contextB.client.id,
        scheduledStart: new Date("2026-09-05T09:00:00.000Z"),
        estimatedDurationMinutes: 60,
        createdByUserId: contextB.user.id,

        services: {
          create: {
            serviceNameSnapshot: "Massage",
            durationMinutes: 60,
            price: 300,
          },
        },
      },
    });

    const planning = await getPlanningDay(contextA.currentUser, "2026-09-05");

    expect(planning.appointments).toHaveLength(1);
    expect(planning.appointments[0]?.client.name).toBe("Cliente Test");
    expect(planning.appointments[0]?.services[0]?.name).toBe("Brushing");
  });

  it("excludes cancelled appointments", async () => {
    const context = await createSalonContext();

    await testPrisma.appointment.create({
      data: {
        salonId: context.salon.id,
        clientId: context.client.id,
        scheduledStart: new Date("2026-09-05T10:00:00.000Z"),
        estimatedDurationMinutes: 60,
        status: "CANCELLED",
        createdByUserId: context.user.id,
        cancelledByUserId: context.user.id,
        cancelledAt: new Date(),

        services: {
          create: {
            serviceNameSnapshot: "Annulée",
            durationMinutes: 60,
            price: 100,
          },
        },
      },
    });

    const planning = await getPlanningDay(context.currentUser, "2026-09-05");

    expect(planning.appointments).toHaveLength(0);
  });

  it("counts services that still need employee or required room assignment", async () => {
    const context = await createSalonContext();

    await testPrisma.appointment.create({
      data: {
        salonId: context.salon.id,
        clientId: context.client.id,
        scheduledStart: new Date("2026-09-05T11:00:00.000Z"),
        estimatedDurationMinutes: 60,
        createdByUserId: context.user.id,

        services: {
          create: {
            serviceNameSnapshot: "Soin visage",
            durationMinutes: 60,
            price: 250,
            requiredRoomTypeSnapshot: "TREATMENT_ROOM",
          },
        },
      },
    });

    const planning = await getPlanningDay(context.currentUser, "2026-09-05");

    expect(planning.appointmentCount).toBe(1);
    expect(planning.organizationIssues).toBe(1);
    expect(planning.appointments[0]?.services[0]?.needsOrganization).toBe(true);
  });

  it("serializes Decimal prices into plain numbers", async () => {
    const context = await createSalonContext();

    await testPrisma.appointment.create({
      data: {
        salonId: context.salon.id,
        clientId: context.client.id,
        scheduledStart: new Date("2026-09-05T12:00:00.000Z"),
        estimatedDurationMinutes: 30,
        createdByUserId: context.user.id,

        services: {
          create: {
            serviceNameSnapshot: "Manucure",
            durationMinutes: 30,
            price: "125.50",
          },
        },
      },
    });

    const planning = await getPlanningDay(context.currentUser, "2026-09-05");

    expect(planning.appointments[0]?.services[0]?.price).toBe(125.5);
    expect(planning.appointments[0]?.totalAmount).toBe(125.5);
  });
});
