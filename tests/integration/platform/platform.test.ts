import { beforeEach, afterAll, expect, it, vi } from "vitest";
import { hash } from "bcryptjs";
const session = vi.hoisted(() => ({ id: "", authVersion: 0 }));
vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({ user: { ...session } })),
}));
import { testPrisma as db } from "../helpers/prisma";
import { cleanDatabase } from "../helpers/database";
import { executePlatformCommand } from "@/server/platform/commands";
import { requirePlatformAdmin } from "@/server/platform/auth";
import {
  executeSupportCommand,
  getSalonSupport,
} from "@/server/platform/support";
import { getCurrentUser } from "@/server/auth/get-current-user";
import { verifyCredentials } from "@/server/auth/verify-credentials";
import {
  allowLoginAttempt,
  LOGIN_ATTEMPT_LIMIT,
} from "@/server/auth/login-throttle";
let salonId: string, managerId: string, platformId: string;
const password = "Platform-Test-2026!";
beforeEach(async () => {
  await cleanDatabase();
  session.authVersion = 0;
  const platform = await db.user.create({
    data: {
      email: "platform@test.local",
      firstName: "Platform",
      passwordHash: await hash(password, 4),
      role: "SUPER_ADMIN",
      salonId: null,
    },
  });
  const salon = await db.salon.create({ data: { name: "Salon pilote" } });
  const manager = await db.user.create({
    data: {
      email: "manager@test.local",
      firstName: "Manager",
      passwordHash: await hash(password, 4),
      salonId: salon.id,
      role: "ADMIN",
      canManageSalon: true,
    },
  });
  salonId = salon.id;
  managerId = manager.id;
  platformId = platform.id;
  session.id = platform.id;
});
afterAll(async () => {
  await cleanDatabase();
  await db.$disconnect();
});
it("authenticates a platform account without a salon", async () => {
  expect(
    await verifyCredentials("platform@test.local", password),
  ).toMatchObject({ id: platformId, authVersion: 0 });
});
it("rejects a salon manager from platform operations", async () => {
  session.id = managerId;
  await expect(
    executePlatformCommand({
      kind: "createSalon",
      name: "Forbidden",
      phone: "",
      address: "",
    }),
  ).rejects.toThrow();
  expect(await db.salon.count()).toBe(1);
});
it("creates a salon in preparation and a trial subscription atomically", async () => {
  const result = await executePlatformCommand({
    kind: "createSalon",
    name: "Nouveau",
    phone: "",
    address: "",
  });
  expect(
    await db.salon.findUnique({ where: { id: result.salonId! } }),
  ).toMatchObject({ isActive: false, lifecycle: "PREPARING" });
  expect(await db.salonSubscription.count()).toBe(1);
  expect(await db.platformAuditLog.count()).toBe(1);
});
it("requires an active manager before opening a salon", async () => {
  const draft = await db.salon.create({
    data: { name: "Draft", isActive: false, lifecycle: "PREPARING" },
  });
  await expect(
    executePlatformCommand({
      kind: "salonStatus",
      salonId: draft.id,
      lifecycle: "ACTIVE",
      reason: "Opening",
      confirmation: "Draft",
    }),
  ).rejects.toThrow("gérante");
});
it("suspends the salon, revokes existing sessions and leaves platform access available", async () => {
  await executePlatformCommand({
    kind: "salonStatus",
    salonId,
    lifecycle: "SUSPENDED",
    reason: "Test",
    confirmation: "Salon pilote",
  });
  expect(await db.user.findUnique({ where: { id: managerId } })).toMatchObject({
    authVersion: 1,
  });
  expect(await verifyCredentials("manager@test.local", password)).toBeNull();
  expect(await requirePlatformAdmin()).toMatchObject({ id: platformId });
  await executePlatformCommand({
    kind: "salonStatus",
    salonId,
    lifecycle: "ACTIVE",
    reason: "Resolved",
    confirmation: "Salon pilote",
  });
  session.id = managerId;
  await expect(getCurrentUser()).rejects.toThrow("Session expirée");
  session.authVersion = 1;
  expect(await getCurrentUser()).toMatchObject({ id: managerId });
});
it("requires exact salon confirmation and records no partial change", async () => {
  await expect(
    executePlatformCommand({
      kind: "salonStatus",
      salonId,
      lifecycle: "SUSPENDED",
      reason: "Test",
      confirmation: "wrong",
    }),
  ).rejects.toThrow();
  expect(
    (await db.salon.findUniqueOrThrow({ where: { id: salonId } })).isActive,
  ).toBe(true);
  expect(await db.platformAuditLog.count()).toBe(0);
});
it("creates only ADMIN salon accounts and excludes passwords from the audit", async () => {
  await executePlatformCommand({
    kind: "createManager",
    salonId,
    firstName: "Amina",
    lastName: "",
    email: " NEW@TEST.LOCAL ",
    password,
    confirmation: password,
    role: "SUPER_ADMIN",
  });
  const user = await db.user.findFirstOrThrow({
    where: { email: "new@test.local" },
  });
  expect(user).toMatchObject({ role: "ADMIN", salonId, canManageSalon: true });
  expect(JSON.stringify(await db.platformAuditLog.findMany())).not.toContain(
    password,
  );
  expect(await verifyCredentials("new@test.local", password)).toMatchObject({
    id: user.id,
  });
});
it("blocks duplicate email across salons and platform accounts", async () => {
  await expect(
    executePlatformCommand({
      kind: "createManager",
      salonId,
      firstName: "Amina",
      lastName: "",
      email: "PLATFORM@TEST.LOCAL",
      password,
      confirmation: password,
    }),
  ).rejects.toThrow("déjà");
});
it("protects the last manager and refuses cross-salon account targeting", async () => {
  await expect(
    executePlatformCommand({
      kind: "managerStatus",
      salonId,
      userId: managerId,
      isActive: "false",
      reason: "Test",
    }),
  ).rejects.toThrow("au moins");
  const other = await db.salon.create({ data: { name: "Other" } });
  await expect(
    executePlatformCommand({
      kind: "managerStatus",
      salonId: other.id,
      userId: managerId,
      isActive: "false",
      reason: "Test",
    }),
  ).rejects.toThrow("introuvable");
});
it("keeps payment records after correction and does not suspend automatically", async () => {
  await executePlatformCommand({
    kind: "subscription",
    salonId,
    planName: "Standard",
    status: "PAST_DUE",
    monthlyPrice: "250",
    currency: "MAD",
    periodEnd: "2026-09-30",
    note: "",
  });
  await executePlatformCommand({
    kind: "recordPayment",
    salonId,
    amount: "250",
    currency: "MAD",
    paidAt: "2026-09-28",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    method: "Virement",
    reference: "TEST",
  });
  const payment = await db.subscriptionPayment.findFirstOrThrow();
  await executePlatformCommand({
    kind: "voidPayment",
    paymentId: payment.id,
    reason: "Correction",
  });
  expect(await db.subscriptionPayment.count()).toBe(1);
  expect(
    (
      await db.subscriptionPayment.findUniqueOrThrow({
        where: { id: payment.id },
      })
    ).voidReason,
  ).toBe("Correction");
  expect(
    (await db.salon.findUniqueOrThrow({ where: { id: salonId } })).isActive,
  ).toBe(true);
});
it("isolates support requests and hides internal messages", async () => {
  session.id = managerId;
  await executeSupportCommand({
    kind: "supportCreate",
    title: "Help",
    description: "Problem",
    priority: "NORMAL",
    salonId: "forged",
  });
  const incident = await db.platformIncident.findFirstOrThrow();
  expect(incident.salonId).toBe(salonId);
  session.id = platformId;
  await executePlatformCommand({
    kind: "incidentMessage",
    incidentId: incident.id,
    body: "Secret internal",
    internal: "true",
  });
  await executePlatformCommand({
    kind: "incidentMessage",
    incidentId: incident.id,
    body: "Public answer",
    internal: "false",
  });
  session.id = managerId;
  const tickets = await getSalonSupport();
  expect(JSON.stringify(tickets)).not.toContain("Secret internal");
  expect(JSON.stringify(tickets)).toContain("Public answer");
  const other = await db.salon.create({ data: { name: "Other" } });
  const foreign = await db.platformIncident.create({
    data: {
      salonId: other.id,
      reportedById: managerId,
      title: "Other",
      description: "Other",
    },
  });
  await expect(
    executeSupportCommand({
      kind: "supportReply",
      incidentId: foreign.id,
      body: "Attack",
    }),
  ).rejects.toThrow("introuvable");
});
it("resolves and reopens incidents without retaining a false resolution timestamp", async () => {
  await executePlatformCommand({
    kind: "createIncident",
    salonId,
    title: "Issue",
    description: "Details",
    priority: "HIGH",
  });
  const incident = await db.platformIncident.findFirstOrThrow();
  await executePlatformCommand({
    kind: "incidentStatus",
    incidentId: incident.id,
    status: "RESOLVED",
    resolution: "Fixed",
  });
  expect(
    (
      await db.platformIncident.findUniqueOrThrow({
        where: { id: incident.id },
      })
    ).resolvedAt,
  ).not.toBeNull();
  await executePlatformCommand({
    kind: "incidentStatus",
    incidentId: incident.id,
    status: "OPEN",
    resolution: "",
  });
  expect(
    (
      await db.platformIncident.findUniqueOrThrow({
        where: { id: incident.id },
      })
    ).resolvedAt,
  ).toBeNull();
});
it("revokes the platform session immediately", async () => {
  await executePlatformCommand({
    kind: "revokeSessions",
    userId: platformId,
    reason: "Lost device",
  });
  await expect(requirePlatformAdmin()).rejects.toThrow();
});
it("database rejects a SUPER_ADMIN attached to a salon", async () => {
  await expect(
    db.user.create({
      data: {
        firstName: "Bad",
        email: "bad@test.local",
        passwordHash: "hash",
        role: "SUPER_ADMIN",
        salonId,
      },
    }),
  ).rejects.toThrow();
});
it("persists login limits and permits a fresh window after expiry", async () => {
  for (let i = 0; i < LOGIN_ATTEMPT_LIMIT; i++)
    expect(await allowLoginAttempt("throttle@test.local")).toBe(true);
  expect(await allowLoginAttempt("THROTTLE@test.local")).toBe(false);
  await db.loginThrottle.updateMany({ data: { expiresAt: new Date(0) } });
  expect(await allowLoginAttempt("throttle@test.local")).toBe(true);
});

it("authenticates the new salon manager only after activation with no catalogue required", async () => {
  const draft = await executePlatformCommand({
    kind: "createSalon",
    name: "Second salon",
    phone: "",
    address: "",
  });
  await executePlatformCommand({
    kind: "createManager",
    salonId: draft.salonId,
    firstName: "Second",
    lastName: "",
    email: "SECOND@test.local",
    password,
    confirmation: password,
  });
  expect(await verifyCredentials("second@test.local", password)).toBeNull();
  await executePlatformCommand({
    kind: "salonStatus",
    salonId: draft.salonId,
    lifecycle: "ACTIVE",
    reason: "Opening",
    confirmation: "Second salon",
  });
  expect(
    await verifyCredentials(" second@test.local ", password),
  ).toMatchObject({ email: "second@test.local" });
});
it("matches a due once and reopens it when its payment is voided", async () => {
  await executePlatformCommand({
    kind: "createDue",
    salonId,
    title: "October",
    dueAt: "2026-10-05",
    amount: "250",
    currency: "MAD",
    note: "",
  });
  const due = await db.subscriptionDue.findFirstOrThrow();
  await executePlatformCommand({
    kind: "recordPayment",
    salonId,
    amount: "250",
    currency: "MAD",
    paidAt: "2026-09-28",
    periodStart: "2026-10-01",
    periodEnd: "2026-10-31",
    method: "Virement",
    reference: "",
  });
  const payment = await db.subscriptionPayment.findFirstOrThrow();
  await executePlatformCommand({
    kind: "settleDue",
    dueId: due.id,
    paymentId: payment.id,
  });
  expect(
    (await db.subscriptionDue.findUniqueOrThrow({ where: { id: due.id } }))
      .paymentId,
  ).toBe(payment.id);
  await expect(
    executePlatformCommand({
      kind: "settleDue",
      dueId: due.id,
      paymentId: payment.id,
    }),
  ).rejects.toThrow();
  await executePlatformCommand({
    kind: "voidPayment",
    paymentId: payment.id,
    reason: "Correction",
  });
  expect(
    await db.subscriptionDue.findUniqueOrThrow({ where: { id: due.id } }),
  ).toMatchObject({ paymentId: null, processedAt: null });
  expect(
    await db.platformAuditLog.count({ where: { action: "DUE_REOPENED" } }),
  ).toBe(1);
});
it("rejects mismatched payment tenant, amount, currency and cancelled dues", async () => {
  await executePlatformCommand({
    kind: "createDue",
    salonId,
    title: "October",
    dueAt: "2026-10-05",
    amount: "250",
    currency: "MAD",
    note: "",
  });
  const due = await db.subscriptionDue.findFirstOrThrow();
  const other = await db.salon.create({ data: { name: "Other" } });
  for (const patch of [
    { salonId: other.id },
    { amount: "249" },
    { currency: "EUR" },
  ]) {
    const payment = await db.subscriptionPayment.create({
      data: {
        salonId,
        amount: "250",
        currency: "MAD",
        paidAt: new Date(),
        periodStart: new Date(),
        periodEnd: new Date(),
        method: "Virement",
        recordedById: platformId,
        ...patch,
      },
    });
    await expect(
      executePlatformCommand({
        kind: "settleDue",
        dueId: due.id,
        paymentId: payment.id,
      }),
    ).rejects.toThrow("même salon");
  }
  await executePlatformCommand({
    kind: "cancelDue",
    dueId: due.id,
    reason: "Annulé",
  });
  expect(
    (await db.subscriptionDue.findUniqueOrThrow({ where: { id: due.id } }))
      .cancelledAt,
  ).not.toBeNull();
});
it("calculates received revenue separately by currency, date and void status", async () => {
  const { getPlatformRevenue } = await import("@/server/platform/revenue");
  await db.salonSubscription.create({
    data: {
      salonId,
      planName: "Standard",
      status: "ACTIVE",
      monthlyPrice: "500",
      currency: "MAD",
    },
  });
  for (const patch of [
    { amount: "100.10", currency: "MAD", paidAt: new Date("2026-09-01Z") },
    { amount: "0.20", currency: "MAD", paidAt: new Date("2026-09-30Z") },
    { amount: "20", currency: "EUR", paidAt: new Date("2026-09-28Z") },
    { amount: "900", currency: "MAD", paidAt: new Date("2026-10-01Z") },
    {
      amount: "800",
      currency: "MAD",
      paidAt: new Date("2026-09-20Z"),
      voidedAt: new Date(),
    },
  ]) {
    await db.subscriptionPayment.create({
      data: {
        salonId,
        periodStart: new Date("2026-01-01Z"),
        periodEnd: new Date("2026-12-31Z"),
        method: "Virement",
        recordedById: platformId,
        ...patch,
      },
    });
  }
  const result = await getPlatformRevenue("2026-09");
  expect(
    result.received.find((r) => r.currency === "MAD")?._sum.amount?.toString(),
  ).toBe("100.3");
  expect(
    result.received.find((r) => r.currency === "EUR")?._sum.amount?.toString(),
  ).toBe("20");
  expect(result.recurring[0]._sum.monthlyPrice?.toString()).toBe("500");
  expect(
    result.history.find((r) => r.month === "2026-09" && r.currency === "MAD")
      ?.amount,
  ).toBe("100.30");
});

it("scopes revenue totals, graph and payment history to the selected salon", async () => {
  const { getPlatformRevenue, getRevenueDetails } =
    await import("@/server/platform/revenue");
  const other = await db.salon.create({
    data: { name: "Other revenue salon" },
  });
  for (const id of [salonId, other.id]) {
    await db.salonSubscription.create({
      data: {
        salonId: id,
        planName: "Standard",
        status: "ACTIVE",
        monthlyPrice: id === salonId ? "250" : "900",
        currency: "MAD",
      },
    });
    await db.subscriptionPayment.create({
      data: {
        salonId: id,
        amount: id === salonId ? "100" : "900",
        currency: "MAD",
        paidAt: new Date("2026-09-15Z"),
        periodStart: new Date("2026-09-01Z"),
        periodEnd: new Date("2026-09-30Z"),
        method: "Virement",
        recordedById: platformId,
      },
    });
  }
  await db.subscriptionDue.create({
    data: {
      salonId,
      title: "Next",
      amount: "250",
      currency: "MAD",
      dueAt: new Date("2026-10-01Z"),
    },
  });
  const result = await getPlatformRevenue("2026-09", salonId);
  expect(result.received[0]._sum.amount?.toString()).toBe("100");
  expect(result.recurring[0]._sum.monthlyPrice?.toString()).toBe("250");
  expect(result.bySalon.map((row) => row.salonId)).toEqual([salonId]);
  expect(result.history).toEqual([
    { month: "2026-09", currency: "MAD", amount: "100.00" },
  ]);
  const details = await getRevenueDetails("2026-09", salonId);
  expect(details.total).toBe(1);
  expect(details.paymentTotal).toBe(1);
  expect(details.payments[0].salonId).toBe(salonId);
  expect(details.salons[0].subscriptionDues[0].title).toBe("Next");
  session.id = managerId;
  await expect(getRevenueDetails("2026-09", salonId)).rejects.toThrow();
});
