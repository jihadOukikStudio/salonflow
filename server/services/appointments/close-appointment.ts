import type { CurrentUser } from "@/server/permissions";
import { requirePermission } from "@/server/permissions";

import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";

import { prisma } from "@/server/db/prisma";
import { lockResource } from "@/server/db/resource-lock";

import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

type CloseAppointmentInput = {
  appointmentId: string;
};

/**
 * Clôture définitivement un rendez-vous.
 *
 * Conditions :
 * - permission appointments:close ;
 * - rendez-vous du salon courant uniquement ;
 * - statut COMPLETED ;
 * - toutes les prestations DONE ;
 * - paiement PAID ;
 * - une seule clôture possible ;
 * - verrou transactionnel sur le rendez-vous ;
 * - activité tracée.
 */
export async function closeAppointment(
  currentUser: CurrentUser,
  input: CloseAppointmentInput,
) {
  const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);

  requirePermission(authoritativeUser, "appointments:close");

  const salonId = authoritativeUser.salonId;

  return prisma.$transaction(async (tx) => {
    const initialAppointment = await tx.appointment.findFirst({
      where: {
        id: input.appointmentId,
        salonId,
      },
      select: {
        id: true,
      },
    });

    if (!initialAppointment) {
      throw new ResourceNotFoundError(
        "Le rendez-vous demandé est introuvable.",
      );
    }

    await lockResource(
      tx,
      `salonflow:appointment:${salonId}:${initialAppointment.id}`,
    );

    /*
     * Toujours relire après le verrou.
     */
    const appointment = await tx.appointment.findFirst({
      where: {
        id: initialAppointment.id,
        salonId,
      },
      select: {
        id: true,
        status: true,

        payment: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new ResourceNotFoundError(
        "Le rendez-vous demandé est introuvable.",
      );
    }

    if (appointment.status === "CANCELLED") {
      throw new BusinessRuleError(
        "Un rendez-vous annulé ne peut pas être clôturé.",
      );
    }

    if (appointment.status === "CLOSED") {
      throw new BusinessRuleError("Ce rendez-vous est déjà clôturé.");
    }

    if (appointment.status !== "COMPLETED") {
      throw new BusinessRuleError(
        "Le rendez-vous doit être terminé avant de pouvoir être clôturé.",
      );
    }

    /*
     * Protection supplémentaire :
     *
     * Même si le statut du rendez-vous indique COMPLETED,
     * on vérifie réellement l'état de ses prestations.
     */
    const unfinishedServices = await tx.appointmentService.count({
      where: {
        appointmentId: appointment.id,

        appointment: {
          salonId,
        },

        status: {
          not: "DONE",
        },
      },
    });

    if (unfinishedServices > 0) {
      throw new BusinessRuleError(
        "Toutes les prestations doivent être terminées avant la clôture.",
      );
    }

    if (!appointment.payment || appointment.payment.status !== "PAID") {
      throw new BusinessRuleError(
        "Le rendez-vous doit être payé avant de pouvoir être clôturé.",
      );
    }

    /*
     * updateMany permet d'ajouter une condition métier dans l'UPDATE.
     * Ainsi même si le statut changeait de manière inattendue,
     * on ne ferait pas une transition aveugle.
     */
    const updateResult = await tx.appointment.updateMany({
      where: {
        id: appointment.id,
        salonId,
        status: "COMPLETED",
      },
      data: {
        status: "CLOSED",
      },
    });

    if (updateResult.count !== 1) {
      throw new BusinessRuleError("Le rendez-vous ne peut plus être clôturé.");
    }

    await tx.activityLog.create({
      data: {
        salonId,
        userId: authoritativeUser.id,
        action: "APPOINTMENT_CLOSED",
        entityType: "APPOINTMENT",
        entityId: appointment.id,

        metadata: {
          paymentId: appointment.payment.id,
        },
      },
    });

    const closedAppointment = await tx.appointment.findFirst({
      where: {
        id: appointment.id,
        salonId,
      },

      include: {
        services: true,
        payment: true,
      },
    });

    if (!closedAppointment) {
      throw new ResourceNotFoundError(
        "Le rendez-vous clôturé est introuvable.",
      );
    }

    return closedAppointment;
  });
}
