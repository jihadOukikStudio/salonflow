import type { CurrentUser } from "@/server/permissions";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { prisma } from "@/server/db/prisma";
import { PermissionDeniedError } from "@/server/permissions/errors";
import { ResourceNotFoundError } from "@/server/services/errors";

export type UpdateServiceDefaultsInput = {
  serviceId: string;
  defaultDurationMinutes: number;
  defaultPrice: number;
  isStartingPrice: boolean;
};

export async function updateServiceDefaults(
  currentUser: CurrentUser,
  input: UpdateServiceDefaultsInput,
) {
  const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);

  if (authoritativeUser.role !== "ADMIN") {
    throw new PermissionDeniedError(
      "Seule la gérante peut modifier les paramètres du catalogue.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const service = await tx.service.findFirst({
      where: {
        id: input.serviceId,
        salonId: authoritativeUser.salonId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!service) {
      throw new ResourceNotFoundError("Prestation introuvable.");
    }

    const updated = await tx.service.update({
      where: {
        id: service.id,
      },
      data: {
        defaultDurationMinutes: input.defaultDurationMinutes,
        defaultPrice: input.defaultPrice,
        isStartingPrice: input.isStartingPrice,
      },
      select: {
        id: true,
        name: true,
        defaultDurationMinutes: true,
        defaultPrice: true,
        isStartingPrice: true,
      },
    });

    await tx.activityLog.create({
      data: {
        salonId: authoritativeUser.salonId,
        userId: authoritativeUser.id,
        action: "SERVICE_DEFAULTS_UPDATED",
        entityType: "Service",
        entityId: updated.id,
        metadata: {
          defaultDurationMinutes: updated.defaultDurationMinutes,
          defaultPrice: Number(updated.defaultPrice),
          isStartingPrice: updated.isStartingPrice,
        },
      },
    });

    return updated;
  });
}
