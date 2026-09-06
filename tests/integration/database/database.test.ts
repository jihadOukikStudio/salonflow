import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

describe("database integration", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("persists and reads a salon", async () => {
    const createdSalon = await testPrisma.salon.create({
      data: {
        name: "Salon Test",
      },
    });

    const salon = await testPrisma.salon.findUnique({
      where: {
        id: createdSalon.id,
      },
    });

    expect(salon).not.toBeNull();
    expect(salon?.name).toBe("Salon Test");
    expect(salon?.isActive).toBe(true);
  });

  it("enforces unique client phone numbers inside the same salon", async () => {
    const salon = await testPrisma.salon.create({
      data: {
        name: "Salon Test",
      },
    });

    await testPrisma.client.create({
      data: {
        salonId: salon.id,
        phone: "+212600000001",
      },
    });

    await expect(
      testPrisma.client.create({
        data: {
          salonId: salon.id,
          phone: "+212600000001",
        },
      }),
    ).rejects.toThrow();
  });

  it("allows the same client phone number in different salons", async () => {
    const salonA = await testPrisma.salon.create({
      data: {
        name: "Salon A",
      },
    });

    const salonB = await testPrisma.salon.create({
      data: {
        name: "Salon B",
      },
    });

    await testPrisma.client.create({
      data: {
        salonId: salonA.id,
        phone: "+212600000001",
      },
    });

    await expect(
      testPrisma.client.create({
        data: {
          salonId: salonB.id,
          phone: "+212600000001",
        },
      }),
    ).resolves.toBeDefined();
  });
});
