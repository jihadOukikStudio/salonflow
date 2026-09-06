import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";
import { updateServiceDefaults } from "@/server/services/catalog/update-service-defaults";

import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

async function createSalonContext(
  role: "ADMIN" | "EMPLOYEE" = "ADMIN",
  canManageSalon = role === "ADMIN",
) {
  const salon = await testPrisma.salon.create({
    data: { name: `Salon ${crypto.randomUUID()}` },
  });

  const user = await testPrisma.user.create({
    data: {
      salonId: salon.id,
      email: `${crypto.randomUUID()}@test.local`,
      passwordHash: "test-hash",
      firstName: "Test",
      role,
      canManageSalon,
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
    role,
    canManageSalon,
    isActive: true,
  };

  return { salon, category, currentUser };
}

describe("updateServiceDefaults", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("lets the admin configure duration and catalogue price", async () => {
    const context = await createSalonContext();
    const service = await testPrisma.service.create({
      data: {
        salonId: context.salon.id,
        categoryId: context.category.id,
        name: "Brushing test",
        defaultPrice: 60,
        defaultDurationMinutes: null,
      },
    });

    const result = await updateServiceDefaults(context.currentUser, {
      serviceId: service.id,
      defaultDurationMinutes: 40,
      defaultPrice: 70,
      isStartingPrice: true,
    });

    expect(result.defaultDurationMinutes).toBe(40);
    expect(Number(result.defaultPrice)).toBe(70);
    expect(result.isStartingPrice).toBe(true);
  });

  it("rejects an employee even with salon management rights", async () => {
    const context = await createSalonContext("EMPLOYEE", true);
    const service = await testPrisma.service.create({
      data: {
        salonId: context.salon.id,
        categoryId: context.category.id,
        name: "Service interdit",
        defaultPrice: 100,
        defaultDurationMinutes: 30,
      },
    });

    await expect(
      updateServiceDefaults(context.currentUser, {
        serviceId: service.id,
        defaultDurationMinutes: 45,
        defaultPrice: 120,
        isStartingPrice: false,
      }),
    ).rejects.toThrow();
  });

  it("cannot update a service from another salon", async () => {
    const contextA = await createSalonContext();
    const contextB = await createSalonContext();
    const serviceB = await testPrisma.service.create({
      data: {
        salonId: contextB.salon.id,
        categoryId: contextB.category.id,
        name: "Service B",
        defaultPrice: 100,
        defaultDurationMinutes: 30,
      },
    });

    await expect(
      updateServiceDefaults(contextA.currentUser, {
        serviceId: serviceB.id,
        defaultDurationMinutes: 45,
        defaultPrice: 120,
        isStartingPrice: false,
      }),
    ).rejects.toThrow("introuvable");
  });
});
