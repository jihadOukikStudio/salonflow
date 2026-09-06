import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";

import { createAppointment } from "@/server/services/appointments/create-appointment";
import { PermissionDeniedError } from "@/server/permissions/errors";

import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

async function createContext() {
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
      firstName: "Employée",
      role: "EMPLOYEE",
      canManageSalon: false,
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

  const service = await testPrisma.service.create({
    data: {
      salonId: salon.id,
      categoryId: category.id,
      name: `Prestation ${crypto.randomUUID()}`,
      defaultDurationMinutes: 60,
      defaultPrice: 100,
    },
  });

  const sessionUser: CurrentUser = {
    id: user.id,
    salonId: user.salonId,
    role: user.role,
    canManageSalon: user.canManageSalon,
    isActive: user.isActive,
  };

  return {
    salon,
    user,
    client,
    service,
    sessionUser,
  };
}

describe("authoritative permissions in appointment services", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("rejects privilege escalation by manipulating session role", async () => {
    const context = await createContext();

    const forgedAdminSession: CurrentUser = {
      ...context.sessionUser,
      role: "ADMIN",
      canManageSalon: true,
    };

    await expect(
      createAppointment(forgedAdminSession, {
        clientId: context.client.id,
        scheduledStart: new Date("2026-09-10T10:00:00.000Z"),
        services: [
          {
            serviceId: context.service.id,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);

    expect(
      await testPrisma.appointment.count({
        where: {
          salonId: context.salon.id,
        },
      }),
    ).toBe(0);
  });

  it("rejects a request immediately after database account deactivation", async () => {
    const context = await createContext();

    await testPrisma.user.update({
      where: {
        id: context.user.id,
      },
      data: {
        isActive: false,
      },
    });

    const forgedAdminSession: CurrentUser = {
      ...context.sessionUser,
      role: "ADMIN",
      canManageSalon: true,
      isActive: true,
    };

    await expect(
      createAppointment(forgedAdminSession, {
        clientId: context.client.id,
        scheduledStart: new Date("2026-09-10T10:00:00.000Z"),
        services: [
          {
            serviceId: context.service.id,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
