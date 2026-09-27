import type { PrismaClient } from "../../app/generated/prisma/client";
import { normalizeLoginEmail } from "../../server/auth/verify-credentials";
import { saveEmployeeAccessActionSchema } from "../../features/employees/schemas/employee-schemas";
import { ManagerCommandError, type ManagerPrompts } from "./manager-command";

// Corrige uniquement les deux comptes responsables déjà créés, dans une transaction.
export async function promoteManagers(db: PrismaClient, io: ManagerPrompts) {
  const salons = await db.salon.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  if (!salons.length) throw new ManagerCommandError("Aucun salon actif.");
  for (const salon of salons)
    io.write(`${salon.id} — ${JSON.stringify(salon.name)}`);
  const salonId = (await io.ask("ID exact du salon : ")).trim();
  const salon = salons.find((item) => item.id === salonId);
  if (!salon)
    throw new ManagerCommandError(
      "Salon inconnu ou inactif. Aucun compte modifié.",
    );
  const emails = [
    normalizeLoginEmail(
      await io.ask("Email de la première gérante existante : "),
    ),
    normalizeLoginEmail(
      await io.ask("Email de la deuxième gérante existante : "),
    ),
  ];
  if (
    emails[0] === emails[1] ||
    emails.some(
      (email) =>
        !saveEmployeeAccessActionSchema.shape.email.safeParse(email).success,
    )
  ) {
    throw new ManagerCommandError(
      "Deux emails valides et distincts sont requis.",
    );
  }
  const lookup = {
    OR: emails.map((email) => ({
      email: { equals: email, mode: "insensitive" as const },
    })),
  };
  const select = {
    id: true,
    salonId: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true,
    canManageSalon: true,
    isActive: true,
  } as const;
  const candidates = await db.user.findMany({ where: lookup, select });
  const accounts = emails.map((email) => {
    const matches = candidates.filter(
      (user) => normalizeLoginEmail(user.email) === email,
    );
    if (matches.length !== 1)
      throw new ManagerCommandError(
        "Email introuvable ou ambigu entre plusieurs comptes. Aucun compte modifié.",
      );
    const user = matches[0];
    if (
      user.salonId !== salon.id ||
      !user.isActive ||
      !user.canManageSalon ||
      (user.role !== "EMPLOYEE" && user.role !== "ADMIN")
    ) {
      throw new ManagerCommandError(
        "Chaque compte doit être actif, rattaché au salon choisi et déjà responsable (canManageSalon=true) ou administratrice.",
      );
    }
    return user;
  });
  io.write(`Salon : ${JSON.stringify(salon.name)} (${salon.id})`);
  for (const user of accounts) {
    io.write(
      `${JSON.stringify([user.firstName, user.lastName].filter(Boolean).join(" "))} — ${JSON.stringify(user.email)} — ${user.id} : ${user.role} → ADMIN`,
    );
  }
  io.write(
    "Les deux gérantes auront les droits ADMIN dans ce salon. Mots de passe et autres comptes conservés.",
  );
  if (
    (
      await io.ask("Tapez PROMOUVOIR pour confirmer (sinon annulation) : ")
    ).trim() !== "PROMOUVOIR"
  ) {
    io.write("Annulé. Aucun compte modifié.");
    return;
  }
  await db.$transaction(
    async (tx) => {
      if (
        !(await tx.salon.findFirst({
          where: { id: salon.id, isActive: true },
          select: { id: true },
        }))
      ) {
        throw new ManagerCommandError(
          "Le salon n'est plus actif. Aucun compte modifié.",
        );
      }
      const current = await tx.user.findMany({ where: lookup, select });
      if (
        current.length !== 2 ||
        accounts.some(
          (user) =>
            !current.some(
              (item) =>
                item.id === user.id &&
                item.salonId === salon.id &&
                item.email === user.email &&
                item.role === user.role &&
                item.canManageSalon &&
                item.isActive,
            ),
        )
      ) {
        throw new ManagerCommandError(
          "Les comptes ont changé pendant la confirmation. Relancez la commande ; aucune modification appliquée.",
        );
      }
      for (const user of accounts) {
        if (user.role === "ADMIN") continue;
        const result = await tx.user.updateMany({
          where: {
            id: user.id,
            salonId: salon.id,
            email: user.email,
            role: "EMPLOYEE",
            canManageSalon: true,
            isActive: true,
          },
          data: { role: "ADMIN" },
        });
        if (result.count !== 1)
          throw new ManagerCommandError(
            "Un compte a changé. La transaction est annulée pour les deux comptes.",
          );
      }
    },
    { isolationLevel: "Serializable" },
  );
  io.write(
    "Vérifié : les deux gérantes sont ADMIN dans le salon choisi. Déconnectez puis reconnectez leurs sessions.",
  );
}
