import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { hash } from "bcryptjs";

import {
  normalizeLoginEmail,
  verifyCredentials,
} from "@/server/auth/verify-credentials";

import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

async function createAccount(params?: {
  email?: string;
  password?: string;
  userIsActive?: boolean;
  salonIsActive?: boolean;
  salonId?: string;
}) {
  const salon = params?.salonId
    ? await testPrisma.salon.findUniqueOrThrow({
        where: {
          id: params.salonId,
        },
      })
    : await testPrisma.salon.create({
        data: {
          name: `Salon ${crypto.randomUUID()}`,
          isActive: params?.salonIsActive ?? true,
        },
      });

  const password = params?.password ?? "SalonFlow-Test-123!";

  const user = await testPrisma.user.create({
    data: {
      salonId: salon.id,
      email: params?.email ?? `${crypto.randomUUID()}@test.local`,
      passwordHash: await hash(password, 4),
      firstName: "Amina",
      lastName: "Test",
      role: "EMPLOYEE",
      canManageSalon: false,
      isActive: params?.userIsActive ?? true,
    },
  });

  return {
    salon,
    user,
    password,
  };
}

describe("verifyCredentials", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("normalizes login email", () => {
    expect(normalizeLoginEmail("  ADMIN@SalonFlow.Ma ")).toBe(
      "admin@salonflow.ma",
    );
  });

  it("authenticates valid credentials", async () => {
    const context = await createAccount({
      email: "amina@salonflow.ma",
    });

    const result = await verifyCredentials(
      "AMINA@SALONFLOW.MA",
      context.password,
    );

    expect(result).toEqual({
      id: context.user.id,
      email: context.user.email,
      name: "Amina Test",
    });
  });

  it("rejects a wrong password", async () => {
    const context = await createAccount();

    await expect(
      verifyCredentials(context.user.email, "wrong-password"),
    ).resolves.toBeNull();
  });

  it("rejects an unknown email", async () => {
    await expect(
      verifyCredentials("unknown@salonflow.ma", "wrong-password"),
    ).resolves.toBeNull();
  });

  it("rejects an inactive user", async () => {
    const context = await createAccount({
      userIsActive: false,
    });

    await expect(
      verifyCredentials(context.user.email, context.password),
    ).resolves.toBeNull();
  });

  it("rejects an inactive salon", async () => {
    const context = await createAccount({
      salonIsActive: false,
    });

    await expect(
      verifyCredentials(context.user.email, context.password),
    ).resolves.toBeNull();
  });

  it("rejects an ambiguous email shared by two salons", async () => {
    const email = "shared@salonflow.ma";

    const accountA = await createAccount({
      email,
      password: "Password-A!",
    });

    await createAccount({
      email,
      password: "Password-B!",
    });

    await expect(
      verifyCredentials(email, accountA.password),
    ).resolves.toBeNull();
  });

  it("rejects an empty password", async () => {
    const context = await createAccount();

    await expect(verifyCredentials(context.user.email, "")).resolves.toBeNull();
  });
});
