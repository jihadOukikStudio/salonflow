import { beforeEach, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/app/generated/prisma/client";
vi.mock("@/server/db/prisma", () => ({ prisma: {} }));
import { promoteManagers } from "@/scripts/lib/promote-managers";
const salon = { id: "salon-1", name: "Pilote" };
const users = ["one", "two"].map((id) => ({
  id,
  salonId: salon.id,
  email: `${id}@example.com`,
  firstName: id,
  lastName: null,
  role: "EMPLOYEE",
  isActive: true,
  canManageSalon: true,
}));
const tx = {
  salon: { findFirst: vi.fn() },
  user: { findMany: vi.fn(), updateMany: vi.fn() },
};
const db = {
  salon: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  $transaction: vi.fn(async (f: (client: typeof tx) => Promise<void>) => f(tx)),
};
function run(
  answers = [salon.id, " ONE@EXAMPLE.COM ", "two@example.com", "PROMOUVOIR"],
) {
  return promoteManagers(db as unknown as PrismaClient, {
    ask: vi.fn(async () => answers.shift()!),
    write: vi.fn(),
    close: vi.fn(),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  db.salon.findMany.mockResolvedValue([salon]);
  db.user.findMany.mockResolvedValue(users);
  tx.salon.findFirst.mockResolvedValue(salon);
  tx.user.findMany.mockResolvedValue(users);
  tx.user.updateMany.mockResolvedValue({ count: 1 });
});
it("ne modifie que le rôle des deux comptes exacts dans une transaction", async () => {
  await run();
  expect(tx.user.updateMany).toHaveBeenCalledTimes(2);
  users.forEach((user, index) =>
    expect(tx.user.updateMany.mock.calls[index][0]).toEqual({
      where: {
        id: user.id,
        salonId: salon.id,
        email: user.email,
        role: "EMPLOYEE",
        canManageSalon: true,
        isActive: true,
      },
      data: { role: "ADMIN" },
    }),
  );
  expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
    isolationLevel: "Serializable",
  });
});
it("ne réécrit pas un compte déjà ADMIN", async () => {
  const admins = users.map((user) => ({ ...user, role: "ADMIN" }));
  db.user.findMany.mockResolvedValue(admins);
  tx.user.findMany.mockResolvedValue(admins);
  await run();
  expect(tx.user.updateMany).not.toHaveBeenCalled();
});
it.each([
  ["", "one@example.com", "two@example.com", "PROMOUVOIR"],
  [salon.id, "one@example.com", "ONE@example.com", "PROMOUVOIR"],
  [salon.id, "invalid", "two@example.com", "PROMOUVOIR"],
])("refuse des entrées invalides %j", async (...answers) => {
  await expect(run(answers)).rejects.toThrow();
  expect(db.$transaction).not.toHaveBeenCalled();
});
it.each(
  [
    users.slice(0, 1),
    [...users, { ...users[0], id: "duplicate", salonId: "other" }],
    [{ ...users[0], salonId: "other" }, users[1]],
    [{ ...users[0], isActive: false }, users[1]],
    [{ ...users[0], canManageSalon: false }, users[1]],
  ].map((accounts) => [accounts]),
)(
  "refuse compte absent, ambigu, autre salon, inactif ou non responsable %j",
  async (accounts) => {
    db.user.findMany.mockResolvedValue(accounts);
    await expect(run()).rejects.toThrow();
    expect(db.$transaction).not.toHaveBeenCalled();
  },
);
it("annule sans confirmation", async () => {
  await run([salon.id, "one@example.com", "two@example.com", ""]);
  expect(db.$transaction).not.toHaveBeenCalled();
});
it("recontrôle les comptes après confirmation", async () => {
  tx.user.findMany.mockResolvedValue([
    { ...users[0], isActive: false },
    users[1],
  ]);
  await expect(run()).rejects.toThrow("changé");
  expect(tx.user.updateMany).not.toHaveBeenCalled();
});
it("recontrôle le salon après confirmation", async () => {
  tx.salon.findFirst.mockResolvedValue(null);
  await expect(run()).rejects.toThrow("salon");
  expect(tx.user.updateMany).not.toHaveBeenCalled();
});
it("lève une erreur dans la transaction si un compte ne peut être modifié", async () => {
  tx.user.updateMany
    .mockResolvedValueOnce({ count: 1 })
    .mockResolvedValueOnce({ count: 0 });
  await expect(run()).rejects.toThrow("transaction est annulée");
});
