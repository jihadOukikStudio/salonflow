import { createHash } from "node:crypto";

import { compare, hash } from "bcryptjs";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  requestPasswordReset,
  resetPasswordWithToken,
} from "@/server/auth/password-reset";
import { BusinessRuleError } from "@/server/services/errors";

import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

const ORIGINAL_PASSWORD = "AncienMotDePasse!";
const NEW_PASSWORD = "NouveauMotDePasse!";

async function createUser(
  overrides: { email?: string; isActive?: boolean } = {},
) {
  const salon = await testPrisma.salon.create({
    data: { name: `Salon ${crypto.randomUUID()}`, isActive: true },
  });
  const user = await testPrisma.user.create({
    data: {
      salonId: salon.id,
      email: overrides.email ?? `${crypto.randomUUID()}@test.local`,
      passwordHash: await hash(ORIGINAL_PASSWORD, 4),
      firstName: "Amina",
      role: "ADMIN",
      canManageSalon: true,
      isActive: overrides.isActive ?? true,
    },
  });
  return { salon, user };
}

function tokenHash(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

describe("password reset", () => {
  beforeEach(async () => {
    await cleanDatabase();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("creates a one-use reset link and changes the password", async () => {
    const { user } = await createUser({ email: "gerante@test.local" });
    let resetUrl = "";

    await requestPasswordReset(" GERANTE@test.local ", {
      sendEmail: async (input) => {
        resetUrl = input.resetUrl;
      },
      now: new Date("2026-09-08T12:00:00.000Z"),
    });

    const rawToken = decodeURIComponent(resetUrl.split("/").at(-1) ?? "");
    expect(rawToken.length).toBeGreaterThan(32);

    const stored = await testPrisma.passwordResetToken.findUnique({
      where: { tokenHash: tokenHash(rawToken) },
    });
    expect(stored?.userId).toBe(user.id);
    expect(stored?.usedAt).toBeNull();

    await resetPasswordWithToken({
      token: rawToken,
      password: NEW_PASSWORD,
      now: new Date("2026-09-08T12:10:00.000Z"),
    });

    const updated = await testPrisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(await compare(NEW_PASSWORD, updated.passwordHash)).toBe(true);
    expect(updated.sessionVersion).toBe(1);

    await expect(
      resetPasswordWithToken({
        token: rawToken,
        password: "EncoreUnNouveauMot!",
        now: new Date("2026-09-08T12:11:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("does not reveal or create tokens for an unknown email", async () => {
    const sender = vi.fn();
    await requestPasswordReset("unknown@test.local", { sendEmail: sender });

    expect(sender).not.toHaveBeenCalled();
    expect(await testPrisma.passwordResetToken.count()).toBe(0);
  });

  it("treats a duplicated email across salons as ambiguous", async () => {
    await createUser({ email: "shared@test.local" });
    await createUser({ email: "shared@test.local" });
    const sender = vi.fn();

    await requestPasswordReset("shared@test.local", { sendEmail: sender });

    expect(sender).not.toHaveBeenCalled();
    expect(await testPrisma.passwordResetToken.count()).toBe(0);
  });

  it("rate-limits repeated reset requests for the same account", async () => {
    await createUser({ email: "gerante@test.local" });
    const sender = vi.fn(async () => undefined);
    const now = new Date("2026-09-08T12:00:00.000Z");

    await requestPasswordReset("gerante@test.local", {
      sendEmail: sender,
      now,
    });
    await requestPasswordReset("gerante@test.local", {
      sendEmail: sender,
      now: new Date(now.getTime() + 30_000),
    });

    expect(sender).toHaveBeenCalledTimes(1);
    expect(await testPrisma.passwordResetToken.count()).toBe(1);
  });

  it("rejects an expired reset token", async () => {
    const { user } = await createUser();
    const rawToken = "expired-token-" + "x".repeat(40);
    await testPrisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: tokenHash(rawToken),
        expiresAt: new Date("2026-09-08T12:00:00.000Z"),
      },
    });

    await expect(
      resetPasswordWithToken({
        token: rawToken,
        password: NEW_PASSWORD,
        now: new Date("2026-09-08T12:01:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects a reset token when the account has been disabled", async () => {
    const { user } = await createUser({ isActive: false });
    const rawToken = "inactive-token-" + "x".repeat(40);
    await testPrisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: tokenHash(rawToken),
        expiresAt: new Date("2026-09-08T13:00:00.000Z"),
      },
    });

    await expect(
      resetPasswordWithToken({
        token: rawToken,
        password: NEW_PASSWORD,
        now: new Date("2026-09-08T12:01:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("keeps the generic flow when the email provider fails", async () => {
    await createUser({ email: "gerante@test.local" });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      requestPasswordReset("gerante@test.local", {
        sendEmail: async () => {
          throw new Error("provider unavailable");
        },
      }),
    ).resolves.toBeUndefined();

    expect(await testPrisma.passwordResetToken.count()).toBe(1);
  });
});
