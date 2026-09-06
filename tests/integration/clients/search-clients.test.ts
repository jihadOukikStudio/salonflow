import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";
import { searchClients } from "@/server/services/clients/search-clients";

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

  const currentUser: CurrentUser = {
    id: user.id,
    salonId: salon.id,
    role: "ADMIN",
    canManageSalon: true,
    isActive: true,
  };

  return { salon, currentUser };
}

describe("searchClients", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("returns nothing before 4 phone digits", async () => {
    const context = await createSalonContext();
    const result = await searchClients(context.currentUser, {
      phoneDigits: "061",
      name: "",
    });

    expect(result).toEqual([]);
  });

  it("searches by phone and can refine by name", async () => {
    const context = await createSalonContext();

    await testPrisma.client.createMany({
      data: [
        {
          salonId: context.salon.id,
          name: "Sara Amrani",
          phone: "+212612345678",
        },
        {
          salonId: context.salon.id,
          name: "Salma Test",
          phone: "+212612399999",
        },
      ],
    });

    const result = await searchClients(context.currentUser, {
      phoneDigits: "0612",
      name: "Sara",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Sara Amrani");
  });

  it("never leaks clients from another salon", async () => {
    const contextA = await createSalonContext();
    const contextB = await createSalonContext();

    await testPrisma.client.create({
      data: {
        salonId: contextB.salon.id,
        name: "Cliente B",
        phone: "+212612345678",
      },
    });

    const result = await searchClients(contextA.currentUser, {
      phoneDigits: "6123",
      name: "",
    });

    expect(result).toEqual([]);
  });
});
