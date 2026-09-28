import { describe, it, expect } from "vitest";
import { platformCommandSchema } from "@/server/platform/schemas";
import { supportSchema } from "@/server/platform/support";
import { isSessionCurrent } from "@/server/auth/session-version";
import { hasPermission } from "@/server/permissions";
import { vi } from "vitest";
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/db/prisma", () => ({ prisma: {} }));
const id = "11111111-1111-4111-8111-111111111111";
const manager = {
  kind: "createManager",
  salonId: id,
  firstName: " Amina ",
  lastName: " ",
  email: " AMINA@EXAMPLE.COM ",
  password: "Strong-Password-2026",
  confirmation: "Strong-Password-2026",
};
describe("platform validation", () => {
  it("normalizes manager identity without allowing an injected role", () => {
    const parsed = platformCommandSchema.parse({
      ...manager,
      role: "SUPER_ADMIN",
    });
    expect(parsed).toMatchObject({
      firstName: "Amina",
      lastName: null,
      email: "amina@example.com",
    });
    expect(parsed).not.toHaveProperty("role");
  });
  it.each([
    { password: "short" },
    { confirmation: "mismatch" },
    { password: "é".repeat(37), confirmation: "é".repeat(37) },
    { salonId: "invalid" },
    { email: "invalid" },
  ])("rejects invalid account input %j", (override) => {
    expect(
      platformCommandSchema.safeParse({ ...manager, ...override }).success,
    ).toBe(false);
  });
  it.each(["false", "true", "DELETED", "SUPER_ADMIN"])(
    "rejects invalid salon lifecycle %s",
    (lifecycle) => {
      expect(
        platformCommandSchema.safeParse({
          kind: "salonStatus",
          salonId: id,
          lifecycle,
          reason: "test",
          confirmation: "salon",
        }).success,
      ).toBe(false);
    },
  );
  it("requires resolution to close an incident", () => {
    expect(
      platformCommandSchema.safeParse({
        kind: "incidentStatus",
        incidentId: id,
        status: "RESOLVED",
        resolution: " ",
      }).success,
    ).toBe(false);
  });
  const payment = {
    kind: "recordPayment",
    salonId: id,
    amount: "250.00",
    currency: "MAD",
    paidAt: "2026-09-28",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    method: "Virement",
    reference: "",
  };
  it.each([
    { amount: "-1" },
    { amount: "0" },
    { amount: "1.001" },
    { amount: "NaN" },
    { currency: "XXX" },
    { periodEnd: "2026-08-30" },
    { paidAt: "2026-02-30" },
  ])("rejects invalid payment %j", (override) => {
    expect(
      platformCommandSchema.safeParse({ ...payment, ...override }).success,
    ).toBe(false);
  });
  it("removes forged salon and internal visibility from a salon support request", () => {
    const parsed = supportSchema.parse({
      kind: "supportReply",
      incidentId: id,
      body: "Bonjour",
      salonId: "other",
      internal: true,
    });
    expect(parsed).not.toHaveProperty("salonId");
    expect(parsed).not.toHaveProperty("internal");
  });
  it("does not give operational salon rights to SUPER_ADMIN", () => {
    expect(
      hasPermission(
        {
          id,
          salonId: "forged",
          role: "SUPER_ADMIN",
          canManageSalon: true,
          isActive: true,
        },
        "appointments:create",
      ),
    ).toBe(false);
  });
  it("accepts legacy version zero and rejects revoked sessions", () => {
    expect(isSessionCurrent(0, undefined)).toBe(true);
    expect(isSessionCurrent(1, 0)).toBe(false);
    expect(isSessionCurrent(2, 2)).toBe(true);
  });
});
