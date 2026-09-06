import type { CurrentUser } from "@/server/permissions";
import { requirePermission } from "@/server/permissions";
import { prisma } from "@/server/db/prisma";

import { BusinessRuleError } from "@/server/services/errors";

export type CreateClientInput = {
  name: string;
  phone: string;
};

export async function createClient(
  currentUser: CurrentUser,
  input: CreateClientInput,
) {
  // En V1, les mêmes personnes qui peuvent créer un rendez-vous
  // peuvent créer une fiche cliente pendant la prise de rendez-vous.
  requirePermission(currentUser, "appointments:create");

  const salonId = currentUser.salonId;

  return prisma.$transaction(async (tx) => {
    const existingClient = await tx.client.findUnique({
      where: {
        salonId_phone: {
          salonId,
          phone: input.phone,
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        isActive: true,
      },
    });

    if (existingClient && !existingClient.isActive) {
      throw new BusinessRuleError(
        "Une fiche cliente avec ce numéro existe mais elle est inactive.",
      );
    }

    // Upsert : la contrainte @@unique([salonId, phone]) reste la
    // protection finale contre deux créations concurrentes du même numéro.
    // Si la fiche existe déjà, nous ne remplaçons jamais silencieusement son nom.
    const client = await tx.client.upsert({
      where: {
        salonId_phone: {
          salonId,
          phone: input.phone,
        },
      },
      update: {},
      create: {
        salonId,
        name: input.name,
        phone: input.phone,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        isActive: true,
      },
    });

    if (!client.isActive) {
      throw new BusinessRuleError(
        "Une fiche cliente avec ce numéro existe mais elle est inactive.",
      );
    }

    await tx.activityLog.create({
      data: {
        salonId,
        userId: currentUser.id,
        action: existingClient ? "CLIENT_REUSED" : "CLIENT_CREATED",
        entityType: "Client",
        entityId: client.id,
        metadata: {
          source: "NEW_APPOINTMENT",
        },
      },
    });

    return {
      id: client.id,
      name: client.name?.trim() || input.name,
      phone: client.phone,
      alreadyExisted: Boolean(existingClient),
    };
  });
}
