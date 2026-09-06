import type { CurrentUser } from "@/server/permissions";

import { prisma } from "@/server/db/prisma";
import { PermissionDeniedError } from "@/server/permissions/errors";

/**
 * Revalide l'utilisateur courant à partir de la base de données.
 *
 * Principe de sécurité :
 * - seul l'identifiant utilisateur provenant de la session sert à retrouver
 *   l'utilisateur ;
 * - salonId, role, canManageSalon et isActive sont relus en BDD ;
 * - un utilisateur supprimé/désactivé est refusé immédiatement ;
 * - un salon désactivé est refusé immédiatement ;
 * - une session déjà marquée inactive reste refusée.
 *
 * Cela empêche notamment une ancienne session de conserver :
 * - un rôle ADMIN retiré ;
 * - canManageSalon après révocation ;
 * - l'accès après désactivation ;
 * - un salonId manipulé/stale.
 */
export async function getAuthoritativeCurrentUser(
  sessionUser: CurrentUser,
): Promise<CurrentUser> {
  if (!sessionUser.isActive) {
    throw new PermissionDeniedError(
      "Votre compte n'est plus autorisé à effectuer cette action.",
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      id: sessionUser.id,
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
      "Votre compte n'est plus autorisé à effectuer cette action.",
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
