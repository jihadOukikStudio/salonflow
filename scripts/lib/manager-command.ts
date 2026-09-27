import { hash } from "bcryptjs";
import type { PrismaClient } from "../../app/generated/prisma/client";
import { normalizeLoginEmail } from "../../server/auth/verify-credentials";
import {
  createEmployeeActionSchema,
  saveEmployeeAccessActionSchema,
} from "../../features/employees/schemas/employee-schemas";

export class ManagerCommandError extends Error {}

export interface ManagerPrompts {
  ask(label: string, secret?: boolean): Promise<string>;
  write(message: string): void;
  close(): void;
}

export function managerErrorMessage(error: unknown): string {
  if (error instanceof ManagerCommandError) return error.message;
  const code =
    error && typeof error === "object" && "code" in error ? error.code : null;
  if (code === "P2002")
    return "Cet email existe déjà. Aucun compte existant n'a été modifié.";
  if (code === "P2034")
    return "Création concurrente détectée. Relancez la commande et vérifiez l'email.";
  if (code === "P1000")
    return "Connexion refusée : vérifiez les identifiants de DATABASE_URL.";
  if (code === "P1001" || code === "ECONNREFUSED")
    return "Base inaccessible : vérifiez DATABASE_URL et la disponibilité de PostgreSQL.";
  // Ne jamais afficher une erreur Prisma brute : elle peut contenir les données d'entrée.
  return "Opération non confirmée. Vérifiez la connexion, le schéma de la base et l'existence du compte avant de réessayer.";
}

export async function createManager(db: PrismaClient, io: ManagerPrompts) {
  const salons = await db.salon.findMany({
    select: { id: true, name: true, isActive: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  if (!salons.some((salon) => salon.isActive)) {
    throw new ManagerCommandError(
      "Aucun salon actif. Aucune création effectuée.",
    );
  }
  io.write("Salons de la base configurée (vérifiez le salon pilote) :");
  for (const salon of salons) {
    io.write(
      `${salon.id} — ${JSON.stringify(salon.name)}${salon.isActive ? "" : " [INACTIF]"}`,
    );
  }
  const salonId = (await io.ask("ID exact du salon : ")).trim();
  const salon = salons.find((item) => item.id === salonId && item.isActive);
  if (!salon)
    throw new ManagerCommandError(
      "ID inconnu ou salon inactif. Aucune création effectuée.",
    );

  const identity = createEmployeeActionSchema.safeParse({
    firstName: await io.ask("Prénom : "),
    lastName: await io.ask("Nom (facultatif) : "),
  });
  if (!identity.success)
    throw new ManagerCommandError(
      "Prénom obligatoire ; prénom et nom limités à 100 caractères.",
    );
  const email = normalizeLoginEmail(await io.ask("Email : "));
  if (!saveEmployeeAccessActionSchema.shape.email.safeParse(email).success) {
    throw new ManagerCommandError("Email invalide. Aucune création effectuée.");
  }
  const emailWhere = { email: { equals: email, mode: "insensitive" as const } };
  if (await db.user.findFirst({ where: emailWhere, select: { id: true } })) {
    throw new ManagerCommandError(
      "Cet email existe déjà dans la base (y compris un compte inactif ou un autre salon). Utilisez un email distinct.",
    );
  }

  let password = await io.ask(
    "Mot de passe (12 caractères minimum, saisie invisible) : ",
    true,
  );
  let confirmation = "";
  let passwordHash: string;
  try {
    if (
      !saveEmployeeAccessActionSchema.shape.temporaryPassword.safeParse(
        password,
      ).success ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      throw new ManagerCommandError(
        "Mot de passe requis : 12 caractères minimum et 72 octets UTF-8 maximum (limite bcrypt).",
      );
    }
    confirmation = await io.ask(
      "Confirmez le mot de passe (saisie invisible) : ",
      true,
    );
    if (confirmation !== password)
      throw new ManagerCommandError(
        "Les mots de passe ne correspondent pas. Aucune création effectuée.",
      );
    io.write(
      [
        "Récapitulatif :",
        `Salon : ${JSON.stringify(salon.name)} (${salon.id})`,
        `Prénom : ${JSON.stringify(identity.data.firstName)}`,
        `Nom : ${JSON.stringify(identity.data.lastName || null)}`,
        `Email : ${email}`,
        "Compte : EMPLOYEE ; canManageSalon=true ; isActive=true",
        "Création d'un compte de gestion uniquement (sans fiche de praticienne).",
      ].join("\n"),
    );
    if (
      (
        await io.ask("Tapez CREER pour confirmer (sinon annulation) : ")
      ).trim() !== "CREER"
    ) {
      io.write("Création annulée. Aucun compte créé.");
      return;
    }
    passwordHash = await hash(password, 12);
  } finally {
    password = "";
    confirmation = "";
  }

  const user = await db.$transaction(
    async (tx) => {
      const activeSalon = await tx.salon.findFirst({
        where: { id: salon.id, isActive: true },
        select: { id: true },
      });
      if (!activeSalon)
        throw new ManagerCommandError(
          "Le salon n'est plus actif ou n'existe plus. Aucune création effectuée.",
        );
      if (
        await tx.user.findFirst({ where: emailWhere, select: { id: true } })
      ) {
        throw new ManagerCommandError(
          "Cet email vient d'être utilisé. Aucune création effectuée.",
        );
      }
      return tx.user.create({
        data: {
          salonId: salon.id,
          firstName: identity.data.firstName,
          lastName: identity.data.lastName || null,
          email,
          passwordHash,
          role: "EMPLOYEE",
          canManageSalon: true,
          isActive: true,
        },
        select: { id: true },
      });
    },
    { isolationLevel: "Serializable" },
  );
  io.write(`Gérante créée : ${email} — compte ${user.id} — salon ${salon.id}.`);
}

export async function runManagerCommand(
  db: PrismaClient,
  io: ManagerPrompts,
): Promise<number> {
  let status = 0;
  try {
    await createManager(db, io);
  } catch (error) {
    io.write(managerErrorMessage(error));
    status = 1;
  } finally {
    io.close();
    try {
      await db.$disconnect();
    } catch {
      io.write(
        "Impossible de confirmer la fermeture de Prisma. Vérifiez le résultat affiché avant de relancer.",
      );
      status = 1;
    }
  }
  return status;
}
