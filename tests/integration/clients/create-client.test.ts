import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";
import { createClient } from "@/server/services/clients/create-client";

import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

async function createSalonContext(
  options: { canManageSalon?: boolean; role?: "ADMIN" | "EMPLOYEE" } = {},
) {
  const salon = await testPrisma.salon.create({
    data: {
      name: `Salon ${crypto.randomUUID()}`,
    },
  });

  const role = options.role ?? "ADMIN";
  const canManageSalon = options.canManageSalon ?? role === "ADMIN";

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

  const currentUser: CurrentUser = {
    id: user.id,
    salonId: salon.id,
    role,
    canManageSalon,
    isActive: true,
  };

  return { salon, user, currentUser };
}

describe("createClient", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("creates the client inside the authenticated salon", async () => {
    const context = await createSalonContext();

    const client = await createClient(context.currentUser, {
      name: "Sara Test",
      phone: "+212612345678",
    });

    expect(client.name).toBe("Sara Test");
    expect(client.phone).toBe("+212612345678");
    expect(client.alreadyExisted).toBe(false);

    const persisted = await testPrisma.client.findUniqueOrThrow({
      where: { id: client.id },
    });

    expect(persisted.salonId).toBe(context.salon.id);
  });

  it("reuses an existing active client instead of creating a duplicate", async () => {
    const context = await createSalonContext();

    const existing = await testPrisma.client.create({
      data: {
        salonId: context.salon.id,
        name: "Nom existant",
        phone: "+212612345678",
      },
    });

    const result = await createClient(context.currentUser, {
      name: "Nouveau nom saisi",
      phone: "+212612345678",
    });

    expect(result.id).toBe(existing.id);
    expect(result.name).toBe("Nom existant");
    expect(result.alreadyExisted).toBe(true);

    expect(
      await testPrisma.client.count({
        where: {
          salonId: context.salon.id,
          phone: "+212612345678",
        },
      }),
    ).toBe(1);
  });

  it("allows the same phone in two different salons without leaking data", async () => {
    const contextA = await createSalonContext();
    const contextB = await createSalonContext();

    const clientA = await createClient(contextA.currentUser, {
      name: "Cliente A",
      phone: "+212612345678",
    });

    const clientB = await createClient(contextB.currentUser, {
      name: "Cliente B",
      phone: "+212612345678",
    });

    expect(clientA.id).not.toBe(clientB.id);

    const rows = await testPrisma.client.findMany({
      where: { phone: "+212612345678" },
      orderBy: { name: "asc" },
    });

    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.salonId))).toEqual(
      new Set([contextA.salon.id, contextB.salon.id]),
    );
  });

  it("rejects a standard employee without salon management rights", async () => {
    const context = await createSalonContext({
      role: "EMPLOYEE",
      canManageSalon: false,
    });

    await expect(
      createClient(context.currentUser, {
        name: "Cliente interdite",
        phone: "+212612345678",
      }),
    ).rejects.toThrow();
  });
});
