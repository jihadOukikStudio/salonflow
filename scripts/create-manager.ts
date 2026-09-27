import "dotenv/config";

// Les imports liés à Prisma restent différés pour traiter proprement une configuration absente.
async function main() {
  if (process.argv.length > 2) {
    console.error(
      "Cette commande n'accepte aucun argument. Saisissez les informations dans le terminal.",
    );
    process.exitCode = 1;
    return;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error(
      "Un terminal interactif est obligatoire ; les entrées redirigées sont refusées.",
    );
    process.exitCode = 1;
    return;
  }
  if (!process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL manque. Configurez la connexion au salon pilote avant de relancer.",
    );
    process.exitCode = 1;
    return;
  }
  const { prisma } = await import("../server/db/prisma");
  let commandOwnsConnection = false;
  try {
    const { runManagerCommand } = await import("./lib/manager-command");
    const { createManagerPrompts } = await import("./lib/manager-prompts");
    const prompts = createManagerPrompts();
    commandOwnsConnection = true;
    process.exitCode = await runManagerCommand(prisma, prompts);
  } finally {
    if (!commandOwnsConnection) await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error(
    "Impossible de terminer la commande. Vérifiez DATABASE_URL, les dépendances et le client Prisma généré. Vérifiez l'existence du compte avant de réessayer.",
  );
  process.exitCode = 1;
});
