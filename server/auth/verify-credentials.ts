import { compare } from "bcryptjs";

import { prisma } from "@/server/db/prisma";

/**
 * Hash bcrypt valide utilisé uniquement pour faire un compare() même
 * lorsqu'aucun compte n'existe, afin d'éviter une différence de temps
 * trop évidente entre "email inconnu" et "mot de passe incorrect".
 */
const DUMMY_BCRYPT_HASH =
  "$2b$12$C6UzMDM.H6dfI/f/IKcEe.3VYqPSEfHNnK5t5gkQ8M7QhM9O0A8oe";

export type VerifiedCredentialsUser = {
  id: string;
  email: string;
  name: string;
};

export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<VerifiedCredentialsUser | null> {
  const normalizedEmail = normalizeLoginEmail(email);

  if (
    normalizedEmail.length === 0 ||
    password.length === 0 ||
    password.length > 512
  ) {
    return null;
  }

  /**
   * Le schéma SalonFlow autorise actuellement le même email dans
   * plusieurs salons via @@unique([salonId, email]).
   *
   * Tant que l'écran de connexion ne demande pas explicitement un salon,
   * nous refusons les emails ambigus au lieu de choisir arbitrairement
   * un compte.
   */
  const candidates = await prisma.user.findMany({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
    },

    select: {
      id: true,
      email: true,
      passwordHash: true,
      firstName: true,
      lastName: true,
      isActive: true,

      salon: {
        select: {
          isActive: true,
        },
      },
    },

    take: 2,
  });

  if (candidates.length !== 1) {
    await compare(password, DUMMY_BCRYPT_HASH);
    return null;
  }

  const user = candidates[0];

  const passwordMatches = await compare(
    password,
    user?.passwordHash ?? DUMMY_BCRYPT_HASH,
  );

  if (!user || !passwordMatches || !user.isActive || !user.salon.isActive) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: [user.firstName, user.lastName].filter(Boolean).join(" "),
  };
}
