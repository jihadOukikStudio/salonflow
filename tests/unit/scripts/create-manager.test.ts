import { beforeEach, describe, expect, it, vi } from "vitest";
import { compare, getRounds } from "bcryptjs";
import { PassThrough } from "node:stream";
import type { PrismaClient } from "@/app/generated/prisma/client";

vi.mock("@/server/db/prisma", () => ({ prisma: {} }));
import {
  managerErrorMessage,
  runManagerCommand,
} from "@/scripts/lib/manager-command";
import { createManagerPrompts } from "@/scripts/lib/manager-prompts";

const salon = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Salon pilote",
  isActive: true,
};
const password = "Secret-pilote-2026!";
const tx = {
  salon: { findFirst: vi.fn() },
  user: { findFirst: vi.fn(), create: vi.fn() },
};
const db = {
  salon: { findMany: vi.fn() },
  user: { findFirst: vi.fn() },
  $transaction: vi.fn(
    async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  ),
  $disconnect: vi.fn(),
};
function prompts(overrides: Record<number, string> = {}) {
  const answers = [
    salon.id,
    "  Fatima  ",
    "  Zahra  ",
    "  GERANTE@EXAMPLE.COM  ",
    password,
    password,
    "CREER",
  ];
  for (const [index, value] of Object.entries(overrides))
    answers[Number(index)] = value;
  return {
    ask: vi.fn(async () => answers.shift()!),
    write: vi.fn(),
    close: vi.fn(),
  };
}
async function run(io = prompts()) {
  return runManagerCommand(db as unknown as PrismaClient, io);
}
beforeEach(() => {
  vi.clearAllMocks();
  db.salon.findMany.mockResolvedValue([salon]);
  db.user.findFirst.mockResolvedValue(null);
  db.$disconnect.mockResolvedValue(undefined);
  tx.salon.findFirst.mockResolvedValue({ id: salon.id });
  tx.user.findFirst.mockResolvedValue(null);
  tx.user.create.mockResolvedValue({ id: "created-id" });
});

describe("création gérante", () => {
  it("normalise l'identité, utilise bcrypt 12 et crée uniquement le compte autorisé", async () => {
    const io = prompts();
    expect(await run(io)).toBe(0);
    const { data, select } = tx.user.create.mock.calls[0][0];
    expect(data).toEqual({
      salonId: salon.id,
      firstName: "Fatima",
      lastName: "Zahra",
      email: "gerante@example.com",
      passwordHash: expect.any(String),
      role: "EMPLOYEE",
      canManageSalon: true,
      isActive: true,
    });
    expect(select).toEqual({ id: true });
    expect(getRounds(data.passwordHash)).toBe(12);
    expect(await compare(password, data.passwordHash)).toBe(true);
    expect(db.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: "gerante@example.com", mode: "insensitive" } },
      select: { id: true },
    });
    expect(tx.user.findFirst).toHaveBeenCalledWith(
      db.user.findFirst.mock.calls[0][0],
    );
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(io.ask.mock.calls[4]).toEqual([expect.any(String), true]);
    expect(io.ask.mock.calls[5]).toEqual([expect.any(String), true]);
    expect(JSON.stringify(io.write.mock.calls)).not.toContain(password);
    expect(JSON.stringify(io.write.mock.calls)).not.toContain(
      data.passwordHash,
    );
    expect(io.close).toHaveBeenCalledOnce();
    expect(db.$disconnect).toHaveBeenCalledOnce();
  });
  it("accepte un nom absent", async () => {
    expect(await run(prompts({ 2: " " }))).toBe(0);
    expect(tx.user.create.mock.calls[0][0].data.lastName).toBeNull();
  });
  it("sélectionne explicitement le second salon", async () => {
    const second = { ...salon, id: "22222222-2222-4222-8222-222222222222" };
    db.salon.findMany.mockResolvedValue([salon, second]);
    expect(await run(prompts({ 0: second.id }))).toBe(0);
    expect(tx.user.create.mock.calls[0][0].data.salonId).toBe(second.id);
  });
  it.each([
    [0, "", "choix vide même avec un seul salon"],
    [0, "inconnu", "salon inconnu"],
    [1, " ", "prénom vide"],
    [3, "invalide", "email invalide"],
    [4, "court", "mot de passe court"],
    [4, "é".repeat(37), "limite bcrypt en octets"],
    [5, "autre", "confirmation différente"],
  ])("refuse %s / %s (%s)", async (index, value) => {
    expect(await run(prompts({ [index]: value }))).toBe(1);
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(db.$disconnect).toHaveBeenCalledOnce();
  });
  it.each([[[]], [[{ ...salon, isActive: false }]]])(
    "refuse sans salon actif : %j",
    async (salons) => {
      db.salon.findMany.mockResolvedValue(salons);
      expect(await run()).toBe(1);
      expect(tx.user.create).not.toHaveBeenCalled();
    },
  );
  it("refuse de sélectionner un salon inactif parmi plusieurs salons", async () => {
    db.salon.findMany.mockResolvedValue([
      { ...salon, isActive: false },
      { ...salon, id: "other" },
    ]);
    expect(await run()).toBe(1);
    expect(tx.user.create).not.toHaveBeenCalled();
  });
  it("refuse un email existant avant toute saisie de mot de passe", async () => {
    db.user.findFirst.mockResolvedValue({ id: "existing" });
    const io = prompts();
    expect(await run(io)).toBe(1);
    expect(io.ask).toHaveBeenCalledTimes(4);
    expect(tx.user.create).not.toHaveBeenCalled();
  });
  it("annule par défaut après récapitulatif", async () => {
    const io = prompts({ 6: "" });
    expect(await run(io)).toBe(0);
    expect(
      io.write.mock.calls.some(([message]) =>
        message.includes("Récapitulatif"),
      ),
    ).toBe(true);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("recontrôle les doublons dans la transaction", async () => {
    tx.user.findFirst.mockResolvedValue({ id: "concurrent" });
    expect(await run()).toBe(1);
    expect(tx.user.create).not.toHaveBeenCalled();
  });
  it("recontrôle le salon dans la transaction", async () => {
    tx.salon.findFirst.mockResolvedValue(null);
    expect(await run()).toBe(1);
    expect(tx.user.create).not.toHaveBeenCalled();
  });
  it("ferme Prisma après une interruption de saisie", async () => {
    const io = prompts();
    io.ask.mockRejectedValueOnce(new Error("interruption"));
    expect(await run(io)).toBe(1);
    expect(io.close).toHaveBeenCalledOnce();
    expect(db.$disconnect).toHaveBeenCalledOnce();
    expect(tx.user.create).not.toHaveBeenCalled();
  });
  it.each(["P2002", "P2034", "P1000", "P1001", "ECONNREFUSED", "unknown"])(
    "masque les données sensibles de l'erreur %s",
    async (code) => {
      tx.user.create.mockRejectedValueOnce(
        Object.assign(new Error(password), { code }),
      );
      const io = prompts();
      expect(await run(io)).toBe(1);
      expect(JSON.stringify(io.write.mock.calls)).not.toContain(password);
      expect(db.$disconnect).toHaveBeenCalledOnce();
      expect(managerErrorMessage({ code, message: password })).not.toContain(
        password,
      );
    },
  );
});

describe("terminal sécurisé", () => {
  function terminal() {
    const input = Object.assign(new PassThrough(), { isTTY: true });
    const output = Object.assign(new PassThrough(), { isTTY: true });
    let text = "";
    output.on("data", (chunk) => {
      text += chunk.toString();
    });
    const io = createManagerPrompts(
      input as unknown as NodeJS.ReadStream,
      output as unknown as NodeJS.WriteStream,
    );
    return { input, io, text: () => text };
  }
  it("n'affiche jamais le secret et restaure la saisie normale", async () => {
    const t = terminal();
    try {
      const answer = t.io.ask("Secret : ", true);
      t.input.write(`${password}\r`);
      expect(await answer).toBe(password);
      expect(t.text()).not.toContain(password);
      const normal = t.io.ask("Suite : ");
      t.input.write("visible\r");
      expect(await normal).toBe("visible");
      expect(t.text()).toContain("visible");
    } finally {
      t.io.close();
    }
  });
  it("annule Ctrl-C pendant la saisie secrète", async () => {
    const t = terminal();
    try {
      const answer = t.io.ask("Secret : ", true);
      t.input.write(`${password}\u0003`);
      await expect(answer).rejects.toThrow("interrompue");
      expect(t.text()).not.toContain(password);
    } finally {
      t.io.close();
    }
  });
  it("refuse un flux non interactif", () => {
    expect(() =>
      createManagerPrompts(new PassThrough() as unknown as NodeJS.ReadStream),
    ).toThrow("terminal interactif");
  });
});
