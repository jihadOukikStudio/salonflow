import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";

import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { PermissionDeniedError } from "@/server/permissions/errors";

import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

async function createContext(params?: {
  role?: "ADMIN" | "EMPLOYEE";
  canManageSalon?: boolean;
  userIsActive?: boolean;
  salonIsActive?: boolean;
}) {
  const salon = await testPrisma.salon.create({
    data: {
      name: `Salon ${crypto.randomUUID()}`,
      isActive: params?.salonIsActive ?? true,
    },
  });

  const user = await testPrisma.user.create({
    data: {
      salonId: salon.id,
      email: `${crypto.randomUUID()}@test.local`,
      passwordHash: "test-hash",
      firstName: "Utilisateur",
      role: params?.role ?? "EMPLOYEE",
      canManageSalon: params?.canManageSalon ?? false,
      isActive: params?.userIsActive ?? true,
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
    sessionUser,
  };
}

describe("getAuthoritativeCurrentUser", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("returns the current authoritative values from database", async () => {
    const context = await createContext({
      role: "EMPLOYEE",
      canManageSalon: true,
    });

    const result = await getAuthoritativeCurrentUser(context.sessionUser);

    expect(result).toEqual({
      id: context.user.id,
      salonId: context.salon.id,
      role: "EMPLOYEE",
      canManageSalon: true,
      isActive: true,
    });
  });

  it("does not trust a stale ADMIN role stored in the session", async () => {
    const context = await createContext({
      role: "EMPLOYEE",
      canManageSalon: false,
    });

    const manipulatedSession: CurrentUser = {
      ...context.sessionUser,
      role: "ADMIN",
      canManageSalon: true,
    };

    const result = await getAuthoritativeCurrentUser(manipulatedSession);

    expect(result.role).toBe("EMPLOYEE");
    expect(result.canManageSalon).toBe(false);
  });

  it("does not trust a manipulated salonId from the session", async () => {
    const context = await createContext();

    const otherSalon = await testPrisma.salon.create({
      data: {
        name: `Autre salon ${crypto.randomUUID()}`,
      },
    });

    const manipulatedSession: CurrentUser = {
      ...context.sessionUser,
      salonId: otherSalon.id,
    };

    const result = await getAuthoritativeCurrentUser(manipulatedSession);

    expect(result.salonId).toBe(context.salon.id);
    expect(result.salonId).not.toBe(otherSalon.id);
  });

  it("immediately applies a role downgrade made in database", async () => {
    const context = await createContext({
      role: "ADMIN",
      canManageSalon: true,
    });

    await testPrisma.user.update({
      where: {
        id: context.user.id,
      },
      data: {
        role: "EMPLOYEE",
        canManageSalon: false,
      },
    });

    const result = await getAuthoritativeCurrentUser(context.sessionUser);

    expect(result.role).toBe("EMPLOYEE");
    expect(result.canManageSalon).toBe(false);
  });

  it("rejects a user disabled after the session was issued", async () => {
    const context = await createContext();

    await testPrisma.user.update({
      where: {
        id: context.user.id,
      },
      data: {
        isActive: false,
      },
    });

    await expect(
      getAuthoritativeCurrentUser(context.sessionUser),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects an inactive salon", async () => {
    const context = await createContext();

    await testPrisma.salon.update({
      where: {
        id: context.salon.id,
      },
      data: {
        isActive: false,
      },
    });

    await expect(
      getAuthoritativeCurrentUser(context.sessionUser),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects a session already marked inactive", async () => {
    const context = await createContext();

    const inactiveSession: CurrentUser = {
      ...context.sessionUser,
      isActive: false,
    };

    await expect(
      getAuthoritativeCurrentUser(inactiveSession),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects an unknown user id", async () => {
    const context = await createContext();

    const unknownSession: CurrentUser = {
      ...context.sessionUser,
      id: crypto.randomUUID(),
    };

    await expect(
      getAuthoritativeCurrentUser(unknownSession),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
