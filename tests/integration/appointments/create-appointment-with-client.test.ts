import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";
import { createAppointmentWithClient } from "@/server/services/appointments/create-appointment-with-client";

import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

async function createSalonContext() {
  const salon = await testPrisma.salon.create({
    data: { name: `Salon ${crypto.randomUUID()}` },
  });

  const user = await testPrisma.user.create({
    data: {
      salonId: salon.id,
      email: `${crypto.randomUUID()}@test.local`,
      passwordHash: "test-hash",
      firstName: "Test",
      role: "ADMIN",
      canManageSalon: true,
    },
  });

  /*
   * La création de RDV vérifie maintenant la capacité réelle du salon.
   * Une employée active est donc une précondition normale des scénarios
   * de création qui doivent réussir.
   */
  const employee = await testPrisma.employee.create({
    data: {
      salonId: salon.id,
      firstName: "Amina",
      isActive: true,
    },
  });

  const category = await testPrisma.serviceCategory.create({
    data: {
      salonId: salon.id,
      name: `Catégorie ${crypto.randomUUID()}`,
      displayOrder: 0,
    },
  });

  const currentUser: CurrentUser = {
    id: user.id,
    salonId: salon.id,
    role: "ADMIN",
    canManageSalon: true,
    isActive: true,
  };

  return { salon, employee, category, currentUser };
}

async function createService(
  salonId: string,
  categoryId: string,
  durationMinutes: number | null,
) {
  return testPrisma.service.create({
    data: {
      salonId,
      categoryId,
      name: `Prestation ${crypto.randomUUID()}`,
      defaultPrice: 150,
      defaultDurationMinutes: durationMinutes,
    },
  });
}

describe("createAppointmentWithClient", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("creates a new client and appointment atomically", async () => {
    const context = await createSalonContext();
    const service = await createService(
      context.salon.id,
      context.category.id,
      45,
    );

    const result = await createAppointmentWithClient(context.currentUser, {
      client: {
        type: "new",
        name: "Sara Test",
        phone: "+212612345678",
      },
      scheduledStart: new Date(Date.now() + 60 * 60 * 1000),
      services: [{ serviceId: service.id }],
      internalNote: "Test",
    });

    expect(result.clientWasCreated).toBe(true);
    expect(result.appointment.clientId).toBe(result.clientId);
    expect(result.appointment.services).toHaveLength(1);
    expect(result.appointment.services[0]?.durationMinutes).toBe(45);
    expect(Number(result.appointment.services[0]?.price)).toBe(150);
  });

  it("reuses an exact existing phone instead of duplicating the client", async () => {
    const context = await createSalonContext();
    const service = await createService(
      context.salon.id,
      context.category.id,
      30,
    );
    const existing = await testPrisma.client.create({
      data: {
        salonId: context.salon.id,
        name: "Nom existant",
        phone: "+212612345678",
      },
    });

    const result = await createAppointmentWithClient(context.currentUser, {
      client: {
        type: "new",
        name: "Nom saisi",
        phone: "+212612345678",
      },
      scheduledStart: new Date(Date.now() + 60 * 60 * 1000),
      services: [{ serviceId: service.id }],
    });

    expect(result.clientId).toBe(existing.id);
    expect(result.clientWasCreated).toBe(false);
    expect(
      await testPrisma.client.count({
        where: {
          salonId: context.salon.id,
          phone: "+212612345678",
        },
      }),
    ).toBe(1);
  });

  it("rolls back the new client if the appointment cannot be created", async () => {
    const context = await createSalonContext();
    const service = await createService(
      context.salon.id,
      context.category.id,
      null,
    );

    await expect(
      createAppointmentWithClient(context.currentUser, {
        client: {
          type: "new",
          name: "Cliente rollback",
          phone: "+212698765432",
        },
        scheduledStart: new Date(Date.now() + 60 * 60 * 1000),
        services: [{ serviceId: service.id }],
      }),
    ).rejects.toThrow("configurée");

    expect(
      await testPrisma.client.count({
        where: {
          salonId: context.salon.id,
          phone: "+212698765432",
        },
      }),
    ).toBe(0);
  });

  it("rejects a past slot before writing anything", async () => {
    const context = await createSalonContext();
    const service = await createService(
      context.salon.id,
      context.category.id,
      30,
    );

    await expect(
      createAppointmentWithClient(context.currentUser, {
        client: {
          type: "new",
          name: "Cliente passée",
          phone: "+212611111111",
        },
        scheduledStart: new Date(Date.now() - 60 * 1000),
        services: [{ serviceId: service.id }],
      }),
    ).rejects.toThrow("passé");

    expect(
      await testPrisma.client.count({
        where: { salonId: context.salon.id },
      }),
    ).toBe(0);
  });
});
