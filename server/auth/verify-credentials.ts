import { compare } from "bcryptjs";

import {
  normalizeLoginEmail,
  normalizeLoginIdentifier,
} from "@/lib/login-identifier";
import { prisma } from "@/server/db/prisma";

/**
 * Hash bcrypt valide utilisé uniquement pour faire un compare() même
 * lorsqu'aucun compte n'existe, afin d'éviter une différence de temps
 * trop évidente entre "identifiant inconnu" et "mot de passe incorrect".
 */
const DUMMY_BCRYPT_HASH =
  "$2b$12$C6UzMDM.H6dfI/f/IKcEe.3VYqPSEfHNnK5t5gkQ8M7QhM9O0A8oe";

export type VerifiedCredentialsUser = {
  id: string;
  email: string | null;
  name: string;
  sessionVersion: number;
};

export { normalizeLoginEmail, normalizeLoginIdentifier };

export async function verifyCredentials(
  identifier: string,
  password: string,
): Promise<VerifiedCredentialsUser | null> {
  const normalizedIdentifier = normalizeLoginIdentifier(identifier);

  if (!normalizedIdentifier || password.length === 0 || password.length > 512) {
    return null;
  }

  /**
   * L'écran de connexion ne demande pas le salon. Un même email/téléphone
   * peut donc exister dans plusieurs salons : dans ce cas, on refuse
   * volontairement l'identifiant ambigu plutôt que de choisir un compte.
   */
  const candidates = await prisma.user.findMany({
    where:
      normalizedIdentifier.kind === "email"
        ? {
            email: {
              equals: normalizedIdentifier.value,
              mode: "insensitive",
            },
          }
        : { phone: normalizedIdentifier.value },

    select: {
      id: true,
      email: true,
      phone: true,
      passwordHash: true,
      firstName: true,
      lastName: true,
      isActive: true,
      sessionVersion: true,

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
    sessionVersion: user.sessionVersion,
  };
}
