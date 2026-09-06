import type { CurrentUser } from "@/server/permissions";
import { requirePermission } from "@/server/permissions";

import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { prisma } from "@/server/db/prisma";
import { BusinessRuleError } from "@/server/services/errors";
import {
  createAppointmentInTransaction,
  type CreateAppointmentServiceInput,
} from "@/server/services/appointments/create-appointment";

export type AppointmentClientChoice =
  | {
      type: "existing";
      clientId: string;
    }
  | {
      type: "new";
      name: string;
      phone: string;
    };

export type CreateAppointmentWithClientInput = {
  client: AppointmentClientChoice;
  scheduledStart: Date;
  internalNote?: string | null;
  services: Array<Pick<CreateAppointmentServiceInput, "serviceId">>;
};

export async function createAppointmentWithClient(
  currentUser: CurrentUser,
  input: CreateAppointmentWithClientInput,
) {
  const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);
  requirePermission(authoritativeUser, "appointments:create");

  const salonId = authoritativeUser.salonId;

  if (
    Number.isNaN(input.scheduledStart.getTime()) ||
    input.scheduledStart.getTime() <= Date.now()
  ) {
    throw new BusinessRuleError(
      "Impossible de créer un rendez-vous dans le passé. Choisissez un créneau à venir.",
    );
  }

  return prisma.$transaction(async (tx) => {
    let clientId: string;
    let clientWasCreated = false;

    if (input.client.type === "existing") {
      clientId = input.client.clientId;
    } else {
      const existingClient = await tx.client.findUnique({
        where: {
          salonId_phone: {
            salonId,
            phone: input.client.phone,
          },
        },
        select: {
          id: true,
          isActive: true,
        },
      });

      if (existingClient && !existingClient.isActive) {
        throw new BusinessRuleError(
          "Une fiche cliente avec ce numéro existe mais elle est inactive.",
        );
      }

      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const client = await tx.client.upsert({
          where: {
            salonId_phone: {
              salonId,
              phone: input.client.phone,
            },
          },
          update: {},
          create: {
            salonId,
            name: input.client.name,
            phone: input.client.phone,
            isActive: true,
          },
          select: {
            id: true,
            isActive: true,
          },
        });

        if (!client.isActive) {
          throw new BusinessRuleError(
            "Une fiche cliente avec ce numéro existe mais elle est inactive.",
          );
        }

        clientId = client.id;
        clientWasCreated = true;

        await tx.activityLog.create({
          data: {
            salonId,
            userId: authoritativeUser.id,
            action: "CLIENT_CREATED",
            entityType: "Client",
            entityId: client.id,
            metadata: {
              source: "NEW_APPOINTMENT",
            },
          },
        });
      }
    }

    const appointment = await createAppointmentInTransaction(
      tx,
      authoritativeUser,
      {
        clientId,
        scheduledStart: input.scheduledStart,
        internalNote: input.internalNote,
        services: input.services,
      },
    );

    return {
      appointment,
      clientId,
      clientWasCreated,
    };
  });
}
