import "dotenv/config";
import { createHash } from "node:crypto";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "../server/db/prisma";
import { createManagerPrompts } from "./lib/manager-prompts";

async function main() {
  if (process.argv.length > 2)
    throw new Error("Utilisez cette commande sans argument.");
  const io = createManagerPrompts();
  try {
    io.write(
      "Diagnostic en lecture seule sur la base configurée. Aucun compte ni mot de passe ne sera modifié.",
    );
    const email = z
      .string()
      .trim()
      .toLowerCase()
      .email()
      .max(320)
      .parse(await io.ask("Email du compte à vérifier : "));
    const users = await prisma.user.findMany({
      where: { email: { equals: email, mode: "insensitive" } },
      select: {
        id: true,
        role: true,
        isActive: true,
        salonId: true,
        passwordHash: true,
        salon: { select: { name: true, isActive: true, lifecycle: true } },
      },
      take: 2,
    });
    if (!users.length) {
      io.write(
        "Compte absent de cette base. Vérifiez que vous utilisez le même environnement que le site (local ou Railway).",
      );
      return;
    }
    if (users.length > 1) {
      io.write(
        "Email présent sur plusieurs comptes : la connexion est volontairement refusée pour éviter de choisir le mauvais salon. Chaque compte doit avoir un email distinct.",
      );
      return;
    }
    const user = users[0];
    io.write(
      `Compte ${user.isActive ? "actif" : "désactivé"} · rôle ${user.role}.`,
    );
    io.write(
      user.salon
        ? `Salon : ${user.salon.name} · ${user.salon.isActive ? "accès actif" : "accès désactivé"} (${user.salon.lifecycle}).`
        : "Aucun salon rattaché.",
    );
    const throttle = await prisma.loginThrottle.findUnique({
      where: { key: createHash("sha256").update(email).digest("hex") },
    });
    if (throttle && throttle.attempts >= 20 && throttle.expiresAt > new Date())
      io.write(
        `Limite de tentatives atteinte. Réessayez après ${throttle.expiresAt.toLocaleString("fr-FR")}, heure de ce terminal. Aucune limite n’a été réinitialisée.`,
      );
    if (
      (
        await io.ask(
          "Vérifier également le mot de passe sans le modifier ? Tapez OUI : ",
        )
      ).trim() === "OUI"
    ) {
      let password = await io.ask("Mot de passe (saisie invisible) : ", true);
      try {
        io.write(
          (await compare(password, user.passwordHash))
            ? "Le mot de passe correspond au compte dans cette base."
            : "Le mot de passe ne correspond pas au compte dans cette base.",
        );
      } finally {
        password = "";
      }
    }
    io.write(
      "Si compte, salon et mot de passe sont valides : essayez une fenêtre privée et vérifiez que le site utilise bien cette même base. Ce diagnostic ne vérifie pas les cookies ni la configuration du serveur web.",
    );
  } finally {
    io.close();
  }
}
main()
  .catch(() => {
    console.error(
      "Diagnostic impossible. Vérifiez l’email, la connexion à la base et les migrations. Aucun secret n’est affiché.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
