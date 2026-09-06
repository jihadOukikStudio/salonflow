import type { CurrentUser } from "@/server/permissions";
import { requirePermission } from "@/server/permissions";

import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";

import { prisma } from "@/server/db/prisma";
import { lockResources } from "@/server/db/resource-lock";

import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

type CancelAppointmentInput = {
  appointmentId: string;
};

export async function cancelAppointment(
  currentUser: CurrentUser,
  input: CancelAppointmentInput,
) {
  const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);

  requirePermission(authoritativeUser, "appointments:cancel");

  const salonId = authoritativeUser.salonId;

  return prisma.$transaction(async (tx) => {
    const initialAppointment = await tx.appointment.findFirst({
      where: {
        id: input.appointmentId,
        salonId,
      },

      select: {
        id: true,

        services: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!initialAppointment) {
      throw new ResourceNotFoundError(
        "Le rendez-vous demandé est introuvable.",
      );
    }

    /*
     * Le lock du RDV protège son statut.
     * Les locks des prestations empêchent une affectation,
     * un démarrage ou une modification structurelle simultanée.
     */
    await lockResources(tx, [
      `salonflow:appointment:${salonId}:${initialAppointment.id}`,

      ...initialAppointment.services.map(
        (service) => `salonflow:appointment-service:${salonId}:${service.id}`,
      ),
    ]);

    const appointment = await tx.appointment.findFirst({
      where: {
        id: initialAppointment.id,
        salonId,
      },

      include: {
        services: true,
        payment: true,
      },
    });

    if (!appointment) {
      throw new ResourceNotFoundError(
        "Le rendez-vous demandé est introuvable.",
      );
    }

    if (appointment.status === "CANCELLED") {
      throw new BusinessRuleError("Ce rendez-vous est déjà annulé.");
    }

    if (appointment.status === "IN_PROGRESS") {
      throw new BusinessRuleError(
        "Un rendez-vous déjà commencé ne peut pas être annulé.",
      );
    }

    if (appointment.status === "COMPLETED") {
      throw new BusinessRuleError(
        "Un rendez-vous terminé ne peut pas être annulé.",
      );
    }

    if (appointment.status === "CLOSED") {
      throw new BusinessRuleError(
        "Un rendez-vous clôturé ne peut pas être annulé.",
      );
    }

    if (appointment.status !== "PLANNED") {
      throw new BusinessRuleError("Ce rendez-vous ne peut pas être annulé.");
    }

    const cancelledAt = new Date();

    const updateResult = await tx.appointment.updateMany({
      where: {
        id: appointment.id,
        salonId,
        status: "PLANNED",
      },

      data: {
        status: "CANCELLED",
        cancelledAt,
        cancelledByUserId: authoritativeUser.id,
      },
    });

    if (updateResult.count !== 1) {
      throw new BusinessRuleError("Le rendez-vous ne peut plus être annulé.");
    }

    await tx.activityLog.create({
      data: {
        salonId,
        userId: authoritativeUser.id,

        action: "APPOINTMENT_CANCELLED",
        entityType: "APPOINTMENT",
        entityId: appointment.id,

        metadata: {
          previousStatus: "PLANNED",
          status: "CANCELLED",
          cancelledAt: cancelledAt.toISOString(),
        },
      },
    });

    const result = await tx.appointment.findFirst({
      where: {
        id: appointment.id,
        salonId,
      },

      include: {
        services: true,
        payment: true,
      },
    });

    if (!result) {
      throw new ResourceNotFoundError("Le rendez-vous annulé est introuvable.");
    }

    return result;
  });
}
