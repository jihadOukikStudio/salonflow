import type { CurrentUser } from "@/server/permissions";

import { auth } from "@/auth";
import { prisma } from "@/server/db/prisma";
import { PermissionDeniedError } from "@/server/permissions/errors";
import { AuthenticationRequiredError } from "@/server/auth/authentication-error";

/**
 * Source d'identité pour les Server Components, Server Actions et Route Handlers.
 *
 * La session ne fournit que l'id. Tous les droits sont relus en base.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    throw new AuthenticationRequiredError();
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      id: true,
      salonId: true,
      role: true,
      canManageSalon: true,
      isActive: true,

      salon: {
        select: {
          isActive: true,
        },
      },
    },
  });

  if (!user || !user.isActive || !user.salon.isActive) {
    throw new PermissionDeniedError(
      "Votre compte n'est plus autorisé à accéder au salon.",
    );
  }

  return {
    id: user.id,
    salonId: user.salonId,
    role: user.role,
    canManageSalon: user.canManageSalon,
    isActive: user.isActive,
  };
}

export async function getOptionalCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      id: true,
      salonId: true,
      role: true,
      canManageSalon: true,
      isActive: true,

      salon: {
        select: {
          isActive: true,
        },
      },
    },
  });

  if (!user || !user.isActive || !user.salon.isActive) {
    return null;
  }

  return {
    id: user.id,
    salonId: user.salonId,
    role: user.role,
    canManageSalon: user.canManageSalon,
    isActive: user.isActive,
  };
}
