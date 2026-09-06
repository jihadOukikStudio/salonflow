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

type CreateParallelGroupInput = {
  appointmentId: string;
  appointmentServiceIds: string[];
};

export async function createParallelGroup(
  currentUser: CurrentUser,
  input: CreateParallelGroupInput,
) {
  const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);

  requirePermission(authoritativeUser, "appointments:update");

  const salonId = authoritativeUser.salonId;

  const uniqueServiceIds = [...new Set(input.appointmentServiceIds)];

  if (uniqueServiceIds.length < 2) {
    throw new BusinessRuleError(
      "Un groupe parallèle doit contenir au moins deux prestations.",
    );
  }

  if (uniqueServiceIds.length !== input.appointmentServiceIds.length) {
    throw new BusinessRuleError(
      "Une prestation ne peut apparaître qu'une seule fois dans un groupe parallèle.",
    );
  }

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

    /*
     * Le verrou du rendez-vous sérialise les modifications
     * structurelles du parallélisme.
     *
     * On verrouille aussi les prestations concernées afin
     * de rester compatible avec les autres opérations métier.
     */
    await lockResources(tx, [
      `salonflow:appointment:${salonId}:${initialAppointment.id}`,

      ...uniqueServiceIds.map(
        (serviceId) => `salonflow:appointment-service:${salonId}:${serviceId}`,
      ),
    ]);

    const appointment = await tx.appointment.findFirst({
      where: {
        id: initialAppointment.id,
        salonId,
      },

      include: {
        services: {
          select: {
            id: true,
            durationMinutes: true,
            status: true,

            parallelGroupLinks: {
              select: {
                parallelGroupId: true,
              },
            },
          },
        },
      },
    });

    if (!appointment) {
      throw new ResourceNotFoundError(
        "Le rendez-vous demandé est introuvable.",
      );
    }

    /*
     * Le parallélisme prévu ne peut être restructuré
     * qu'avant le démarrage du rendez-vous.
     */
    if (appointment.status !== "PLANNED") {
      throw new BusinessRuleError(
        "Les prestations parallèles ne peuvent être configurées que sur un rendez-vous prévu.",
      );
    }

    const selectedServices = appointment.services.filter((service) =>
      uniqueServiceIds.includes(service.id),
    );

    /*
     * Tous les IDs doivent appartenir exactement
     * à ce rendez-vous et donc à ce salon.
     */
    if (selectedServices.length !== uniqueServiceIds.length) {
      throw new ResourceNotFoundError(
        "Une ou plusieurs prestations sont introuvables dans ce rendez-vous.",
      );
    }

    for (const service of selectedServices) {
      if (service.status !== "TODO") {
        throw new BusinessRuleError(
          "Une prestation déjà commencée ou terminée ne peut pas être ajoutée à un groupe parallèle.",
        );
      }

      if (service.parallelGroupLinks.length > 0) {
        throw new BusinessRuleError(
          "Une prestation sélectionnée appartient déjà à un groupe parallèle.",
        );
      }
    }

    /*
     * Création du groupe puis de ses liens.
     *
     * On les crée explicitement : le modèle de liaison possède
     * une clé composée et pas d'id simple.
     */
    const parallelGroup = await tx.parallelGroup.create({
      data: {
        appointmentId: appointment.id,

        createdByUserId: authoritativeUser.id,
      },
    });

    await tx.parallelGroupService.createMany({
      data: uniqueServiceIds.map((appointmentServiceId) => ({
        parallelGroupId: parallelGroup.id,

        appointmentServiceId,
      })),
    });

    /*
     * Projection du nouvel état pour recalculer la durée
     * sans dépendre d'une nouvelle requête.
     */
    const projectedServices = appointment.services.map((service) => ({
      id: service.id,

      durationMinutes: service.durationMinutes,

      parallelGroupLinks: uniqueServiceIds.includes(service.id)
        ? [
            {
              parallelGroupId: parallelGroup.id,
            },
          ]
        : service.parallelGroupLinks,
    }));

    const newEstimatedDurationMinutes =
      calculateAppointmentDuration(projectedServices);

    if (newEstimatedDurationMinutes <= 0) {
      throw new BusinessRuleError(
        "La durée calculée du rendez-vous est invalide.",
      );
    }

    const updateResult = await tx.appointment.updateMany({
      where: {
        id: appointment.id,
        salonId,
        status: "PLANNED",
      },

      data: {
        estimatedDurationMinutes: newEstimatedDurationMinutes,
      },
    });

    if (updateResult.count !== 1) {
      throw new BusinessRuleError("Le rendez-vous ne peut plus être modifié.");
    }

    await tx.activityLog.create({
      data: {
        salonId,
        userId: authoritativeUser.id,

        action: "PARALLEL_GROUP_CREATED",

        entityType: "PARALLEL_GROUP",

        entityId: parallelGroup.id,

        metadata: {
          appointmentId: appointment.id,

          appointmentServiceIds: uniqueServiceIds,

          previousEstimatedDurationMinutes:
            appointment.estimatedDurationMinutes,

          estimatedDurationMinutes: newEstimatedDurationMinutes,
        },
      },
    });

    const result = await tx.appointment.findFirst({
      where: {
        id: appointment.id,
        salonId,
      },

      include: {
        services: {
          include: {
            parallelGroupLinks: true,
          },
        },

        parallelGroups: {
          include: {
            services: true,
          },
        },

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
