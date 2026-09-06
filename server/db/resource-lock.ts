import type { Prisma } from "@/app/generated/prisma/client";

/**
 * Verrou transactionnel PostgreSQL.
 *
 * pg_advisory_xact_lock retourne PostgreSQL "void".
 * Prisma ne sait pas désérialiser directement ce type.
 *
 * On utilise donc $executeRaw plutôt que $queryRaw :
 * on exécute la commande sans demander à Prisma
 * d'interpréter une colonne de résultat.
 *
 * Le verrou est automatiquement libéré au COMMIT
 * ou au ROLLBACK de la transaction.
 */
export async function lockResource(
  tx: Prisma.TransactionClient,
  key: string,
): Promise<void> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${key}, 0)
    )
  `;
}

/**
 * Verrouille plusieurs ressources dans un ordre stable.
 *
 * L'ordre déterministe réduit les risques de deadlock.
 */
export async function lockResources(
  tx: Prisma.TransactionClient,
  keys: string[],
): Promise<void> {
  const uniqueKeys = [...new Set(keys)].sort();

  for (const key of uniqueKeys) {
    await lockResource(tx, key);
  }
}
