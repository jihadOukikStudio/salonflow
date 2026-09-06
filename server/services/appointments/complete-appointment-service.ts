import type { CurrentUser } from "@/server/permissions";
import { requirePermission } from "@/server/permissions";

import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";

import { prisma } from "@/server/db/prisma";
import { lockResources } from "@/server/db/resource-lock";

import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

type CompleteAppointmentServiceInput = {
  appointmentServiceId: string;
};

/**
 * Termine réellement une prestation.
 *
 * Point important :
 * le rendez-vous ET la prestation sont verrouillés.
 *
 * Cela empêche deux prestations terminées simultanément
 * de laisser par erreur le rendez-vous en IN_PROGRESS.
 */
export async function completeAppointmentService(
  currentUser: CurrentUser,
  input: CompleteAppointmentServiceInput,
) {
  const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);

  requirePermission(
    authoritativeUser,
    "appointments:update-own-service-status",
  );

  const salonId = authoritativeUser.salonId;

  return prisma.$transaction(async (tx) => {
    const initialService = await tx.appointmentService.findFirst({
      where: {
        id: input.appointmentServiceId,

        appointment: {
          salonId,
        },
      },

      select: {
        id: true,
        appointmentId: true,
      },
    });

    if (!initialService) {
      throw new ResourceNotFoundError(
        "La prestation demandée est introuvable.",
      );
    }

    /*
     * Les clés sont triées par lockResources().
     *
     * Les deux appels concurrentiels sur deux prestations
     * différentes du même rendez-vous partageront donc
     * nécessairement le verrou appointment.
     */
    await lockResources(tx, [
      `salonflow:appointment:${salonId}:${initialService.appointmentId}`,
      `salonflow:appointment-service:${salonId}:${initialService.id}`,
    ]);

    const appointmentService = await tx.appointmentService.findFirst({
      where: {
        id: initialService.id,

        appointment: {
          salonId,
        },
      },

      include: {
        appointment: true,

        assignedEmployee: {
          select: {
            id: true,
            userId: true,
            isActive: true,
          },
        },

        performedByEmployee: {
          select: {
            id: true,
            userId: true,
            isActive: true,
          },
        },
      },
    });

    if (!appointmentService) {
      throw new ResourceNotFoundError(
        "La prestation demandée est introuvable.",
      );
    }

    const appointment = appointmentService.appointment;

    if (appointment.status === "CANCELLED") {
      throw new BusinessRuleError(
        "Une prestation d'un rendez-vous annulé ne peut pas être terminée.",
      );
    }

    if (appointment.status === "CLOSED") {
      throw new BusinessRuleError(
        "Une prestation d'un rendez-vous clôturé ne peut pas être terminée.",
      );
    }

    if (appointmentService.status !== "IN_PROGRESS") {
      throw new BusinessRuleError(
        "Seule une prestation en cours peut être terminée.",
      );
    }

    if (
      !appointmentService.performedByEmployeeId ||
      !appointmentService.performedByEmployee
    ) {
      throw new BusinessRuleError(
        "Aucune employée réalisant cette prestation n'est enregistrée.",
      );
    }

    const canManageAppointment =
      authoritativeUser.role === "ADMIN" ||
      (authoritativeUser.role === "EMPLOYEE" &&
        authoritativeUser.canManageSalon);

    /*
     * L'employée standard ne termine que la prestation
     * qu'elle est enregistrée comme ayant réellement réalisée.
     */
    if (
      !canManageAppointment &&
      appointmentService.performedByEmployee.userId !== authoritativeUser.id
    ) {
      throw new BusinessRuleError(
        "Vous ne pouvez terminer que les prestations que vous réalisez.",
      );
    }

    const finishedAt = new Date();

    const updateResult = await tx.appointmentService.updateMany({
      where: {
        id: appointmentService.id,
        status: "IN_PROGRESS",
      },

      data: {
        status: "DONE",
        actualFinishedAt: finishedAt,
      },
    });

    if (updateResult.count !== 1) {
      throw new BusinessRuleError(
        "Cette prestation ne peut plus être terminée.",
      );
    }

    /*
     * Grâce au verrou du rendez-vous, cette vérification
     * est maintenant sûre même lorsque deux prestations
     * différentes sont terminées simultanément.
     */
    const remainingService = await tx.appointmentService.findFirst({
      where: {
        appointmentId: appointment.id,

        id: {
          not: appointmentService.id,
        },

        status: {
          not: "DONE",
        },
      },

      select: {
        id: true,
      },
    });

    if (!remainingService) {
      await tx.appointment.updateMany({
        where: {
          id: appointment.id,
          salonId,

          status: {
            in: ["PLANNED", "IN_PROGRESS"],
          },
        },

        data: {
          status: "COMPLETED",
        },
      });
    }

    await tx.activityLog.create({
      data: {
        salonId,
        userId: authoritativeUser.id,

        action: "APPOINTMENT_SERVICE_COMPLETED",
        entityType: "APPOINTMENT_SERVICE",
        entityId: appointmentService.id,

        metadata: {
          appointmentId: appointment.id,
          performedByEmployeeId: appointmentService.performedByEmployeeId,
          finishedAt: finishedAt.toISOString(),
        },
      },
    });

    const result = await tx.appointmentService.findFirst({
      where: {
        id: appointmentService.id,

        appointment: {
          salonId,
        },
      },

      include: {
        assignedEmployee: true,
        performedByEmployee: true,
        appointment: true,
      },
    });

    if (!result) {
      throw new ResourceNotFoundError(
        "La prestation terminée est introuvable.",
      );
    }

    return result;
  });
}
