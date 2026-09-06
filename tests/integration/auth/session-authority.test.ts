import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";

import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { PermissionDeniedError } from "@/server/permissions/errors";

import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

async function createUser() {
  const salon = await testPrisma.salon.create({
    data: {
      name: `Salon ${crypto.randomUUID()}`,
    },
  });

  const user = await testPrisma.user.create({
    data: {
      salonId: salon.id,
      email: `${crypto.randomUUID()}@test.local`,
      passwordHash: "not-used-here",
      firstName: "Amina",
      role: "ADMIN",
      canManageSalon: true,
    },
  });

  const currentUser: CurrentUser = {
    id: user.id,
    salonId: user.salonId,
    role: user.role,
    canManageSalon: user.canManageSalon,
    isActive: true,
  };

  return {
    salon,
    user,
    currentUser,
  };
}

describe("session authority regression", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("applies a permissions downgrade immediately", async () => {
    const context = await createUser();

    await testPrisma.user.update({
      where: {
        id: context.user.id,
      },
      data: {
        role: "EMPLOYEE",
        canManageSalon: false,
      },
    });

    const current = await getAuthoritativeCurrentUser(context.currentUser);

    expect(current.role).toBe("EMPLOYEE");
    expect(current.canManageSalon).toBe(false);
  });

  it("blocks a disabled account even with a previously valid identity", async () => {
    const context = await createUser();

    await testPrisma.user.update({
      where: {
        id: context.user.id,
      },
      data: {
        isActive: false,
      },
    });

    await expect(
      getAuthoritativeCurrentUser(context.currentUser),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
