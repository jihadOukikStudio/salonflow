import type { CurrentUser } from "@/server/permissions";
import { requirePermission } from "@/server/permissions";

import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";

import { prisma } from "@/server/db/prisma";
import { lockResources } from "@/server/db/resource-lock";

import { calculateAppointmentDuration } from "@/server/services/appointments/calculate-appointment-duration";

import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

type RemoveAppointmentServiceInput = {
  appointmentServiceId: string;
};

export async function removeAppointmentService(
  currentUser: CurrentUser,
  input: RemoveAppointmentServiceInput,
) {
  const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);

  requirePermission(authoritativeUser, "appointments:update");

  const salonId = authoritativeUser.salonId;

  return prisma.$transaction(async (tx) => {
    /*
     * Première lecture :
     * - isolation stricte par salon ;
     * - récupération du RDV ;
     * - récupération des ressources liées.
     */
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
        assignedEmployeeId: true,
        roomId: true,
      },
    });

    if (!initialService) {
      throw new ResourceNotFoundError(
        "La prestation demandée est introuvable.",
      );
    }

    /*
     * Verrouillage :
     * - RDV ;
     * - prestation ;
     * - employée ;
     * - salle.
     */
    await lockResources(tx, [
      `salonflow:appointment:${salonId}:${initialService.appointmentId}`,

      `salonflow:appointment-service:${salonId}:${initialService.id}`,

      ...(initialService.assignedEmployeeId
        ? [`salonflow:employee:${salonId}:${initialService.assignedEmployeeId}`]
        : []),

      ...(initialService.roomId
        ? [`salonflow:room:${salonId}:${initialService.roomId}`]
        : []),
    ]);

    /*
     * Relire après acquisition des verrous.
     */
    const appointmentService = await tx.appointmentService.findFirst({
      where: {
        id: initialService.id,

        appointment: {
          salonId,
        },
      },

      include: {
        appointment: {
          include: {
            services: {
              select: {
                id: true,
                durationMinutes: true,

                parallelGroupLinks: {
                  select: {
                    parallelGroupId: true,
                  },
                },
              },
            },
          },
        },

        /*
         * ParallelGroupService ne possède PAS de champ id.
         *
         * Sa clé est composée de :
         * parallelGroupId + appointmentServiceId.
         */
        parallelGroupLinks: {
          select: {
            parallelGroupId: true,
            appointmentServiceId: true,
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

    /*
     * Retrait possible sur :
     * - PLANNED ;
     * - IN_PROGRESS si cette prestation précise
     *   n'a pas encore commencé.
     */
    if (
      appointment.status !== "PLANNED" &&
      appointment.status !== "IN_PROGRESS"
    ) {
      throw new BusinessRuleError(
        "Il n'est plus possible de retirer une prestation de ce rendez-vous.",
      );
    }

    /*
     * Une prestation commencée ou terminée est un fait
     * opérationnel et ne doit jamais être supprimée.
     */
    if (appointmentService.status !== "TODO") {
      throw new BusinessRuleError(
        "Une prestation déjà commencée ou terminée ne peut pas être retirée du rendez-vous.",
      );
    }

    /*
     * Un RDV doit toujours conserver au moins
     * une prestation.
     */
    if (appointment.services.length <= 1) {
      throw new BusinessRuleError(
        "Un rendez-vous doit conserver au moins une prestation.",
      );
    }

    /*
     * On ne retire pas directement une prestation appartenant
     * à un groupe parallèle.
     *
     * Il faut d'abord supprimer le groupe.
     *
     * Cela évite de modifier implicitement la configuration
     * de parallélisme.
     */
    if (appointmentService.parallelGroupLinks.length > 0) {
      throw new BusinessRuleError(
        "Cette prestation appartient à un groupe de prestations parallèles. Modifiez d'abord ce groupe avant de retirer la prestation.",
      );
    }

    /*
     * Recalcul centralisé de la durée restante.
     *
     * Les autres groupes parallèles du rendez-vous
     * restent donc correctement pris en compte.
     */
    const remainingServices = appointment.services.filter(
      (service) => service.id !== appointmentService.id,
    );

    const remainingDuration = calculateAppointmentDuration(remainingServices);

    if (remainingDuration <= 0) {
      throw new BusinessRuleError(
        "La durée restante du rendez-vous est invalide.",
      );
    }

    /*
     * Suppression conditionnelle.
     */
    const deleteResult = await tx.appointmentService.deleteMany({
      where: {
        id: appointmentService.id,

        appointmentId: appointment.id,

        status: "TODO",
      },
    });

    if (deleteResult.count !== 1) {
      throw new BusinessRuleError(
        "Cette prestation ne peut plus être retirée.",
      );
    }

    /*
     * Mise à jour sécurisée de la durée.
     */
    const updateAppointmentResult = await tx.appointment.updateMany({
      where: {
        id: appointment.id,
        salonId,

        status: {
          in: ["PLANNED", "IN_PROGRESS"],
        },
      },

      data: {
        estimatedDurationMinutes: remainingDuration,
      },
    });

    if (updateAppointmentResult.count !== 1) {
      throw new BusinessRuleError("Le rendez-vous ne peut plus être modifié.");
    }

    /*
     * Traçabilité.
     *
     * Le snapshot est conservé dans ActivityLog même si
     * AppointmentService vient d'être supprimée.
     */
    await tx.activityLog.create({
      data: {
        salonId,
        userId: authoritativeUser.id,

        action: "APPOINTMENT_SERVICE_REMOVED",

        entityType: "APPOINTMENT_SERVICE",

        entityId: appointmentService.id,

        metadata: {
          appointmentId: appointment.id,

          serviceId: appointmentService.serviceId,

          serviceName: appointmentService.serviceNameSnapshot,

          durationMinutes: appointmentService.durationMinutes,

          price: appointmentService.price.toString(),

          estimatedDurationMinutes: remainingDuration,
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
      throw new ResourceNotFoundError(
        "Le rendez-vous modifié est introuvable.",
      );
    }

    return result;
  });
}
