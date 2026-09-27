import "dotenv/config";

async function main() {
  if (
    process.argv.length > 2 ||
    !process.stdin.isTTY ||
    !process.stdout.isTTY
  ) {
    console.error(
      "Utilisez un terminal interactif, sans argument ni entrée redirigée.",
    );
    process.exitCode = 1;
    return;
  }
  if (!process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL manque. Configurez la connexion au salon pilote.",
    );
    process.exitCode = 1;
    return;
  }
  const { prisma } = await import("../server/db/prisma");
  let prompts: { close(): void } | undefined;
  try {
    const { createManagerPrompts } = await import("./lib/manager-prompts");
    const { promoteManagers } = await import("./lib/promote-managers");
    const io = createManagerPrompts();
    prompts = io;
    await promoteManagers(prisma, io);
  } catch (error) {
    const { ManagerCommandError } = await import("./lib/manager-command");
    console.error(
      error instanceof ManagerCommandError
        ? error.message
        : "Correction non confirmée. Vérifiez la connexion et relancez pour vérifier les deux comptes. Aucun détail sensible n'est affiché.",
    );
    process.exitCode = 1;
  } finally {
    prompts?.close();
    await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error(
    "Impossible de terminer la commande. Vérifiez DATABASE_URL et le client Prisma. Relancez pour vérifier les comptes avant toute autre intervention.",
  );
  process.exitCode = 1;
});
