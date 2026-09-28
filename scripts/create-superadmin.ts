import "dotenv/config";
import { hash } from "bcryptjs";
import { z } from "zod";
import { createManagerPrompts } from "./lib/manager-prompts";
import {
  ManagerCommandError,
  managerErrorMessage,
} from "./lib/manager-command";
import { prisma } from "../server/db/prisma";

async function main() {
  if (process.argv.length > 2)
    throw new ManagerCommandError(
      "Cette commande interactive n’accepte aucun argument.",
    );
  const io = createManagerPrompts();
  try {
    const firstName = z
      .string()
      .trim()
      .min(1)
      .max(100)
      .parse(await io.ask("Prénom : "));
    const email = z
      .string()
      .trim()
      .toLowerCase()
      .email()
      .max(320)
      .parse(await io.ask("Email distinct du compte salon : "));
    if (
      await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true },
      })
    )
      throw new ManagerCommandError(
        "Cet email est déjà utilisé. Aucun compte existant ne sera converti.",
      );
    let password = await io.ask(
      "Mot de passe (16 caractères minimum, saisie invisible) : ",
      true,
    );
    let confirmation = "";
    let passwordHash: string;
    try {
      if (password.length < 16 || Buffer.byteLength(password) > 72)
        throw new ManagerCommandError(
          "Choisissez 16 caractères minimum et 72 octets UTF-8 maximum.",
        );
      confirmation = await io.ask("Confirmez le mot de passe : ", true);
      if (password !== confirmation)
        throw new ManagerCommandError("Les mots de passe diffèrent.");
      io.write(
        `Compte plateforme : ${firstName} — ${email}\nRôle : SUPER_ADMIN ; aucun salon rattaché.\nCe compte donnera accès à tous les salons. MFA non configuré dans cette version.`,
      );
      if (
        (await io.ask("Tapez CREER SUPERADMIN pour confirmer : ")).trim() !==
        "CREER SUPERADMIN"
      ) {
        io.write("Annulé.");
        return;
      }
      passwordHash = await hash(password, 12);
    } finally {
      password = "";
      confirmation = "";
    }
    await prisma.$transaction(
      async (tx) => {
        if (
          await tx.user.findFirst({
            where: { email: { equals: email, mode: "insensitive" } },
            select: { id: true },
          })
        )
          throw new ManagerCommandError("Email déjà utilisé.");
        const user = await tx.user.create({
          data: {
            firstName,
            email,
            passwordHash,
            role: "SUPER_ADMIN",
            salonId: null,
            canManageSalon: false,
            isActive: true,
          },
          select: { id: true },
        });
        await tx.platformAuditLog.create({
          data: {
            actorId: user.id,
            action: "SUPER_ADMIN_CREATED",
            entityId: user.id,
            details: { email, source: "CLI" },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
    io.write(
      "Superadmin créé. Connectez-vous sur /login : vous serez dirigé vers /superadmin.",
    );
  } finally {
    io.close();
  }
}
main()
  .catch((error) => {
    console.error(
      error instanceof z.ZodError
        ? "Prénom ou email invalide."
        : managerErrorMessage(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
