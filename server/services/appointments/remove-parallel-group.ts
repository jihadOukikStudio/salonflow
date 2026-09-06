import type { CurrentUser } from "@/server/permissions";
import { requirePermission } from "@/server/permissions";

import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";

import { prisma } from "@/server/db/prisma";
import { lockResources } from "@/server/db/resource-lock";

import {
  appointmentLockKey,
  appointmentServiceLockKey,
  employeeLockKey,
  roomLockKey,
} from "@/server/services/resources/resource-lock-keys";
import { validateEmployeeAvailability } from "@/server/services/resources/validate-employee-availability";
import { validateRoomAvailability } from "@/server/services/resources/validate-room-availability";

import { calculateAppointmentDuration } from "@/server/services/appointments/calculate-appointment-duration";

import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

type RemoveParallelGroupInput = {
  parallelGroupId: string;
};

export async function removeParallelGroup(
  currentUser: CurrentUser,
  input: RemoveParallelGroupInput,
) {
  const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);

  requirePermission(authoritativeUser, "appointments:update");

  const salonId = authoritativeUser.salonId;

  return prisma.$transaction(async (tx) => {
    /*
     * Première lecture.
     *
     * On récupère les ressources parce que supprimer
     * le parallélisme peut rallonger le rendez-vous.
     */
    const initialGroup = await tx.parallelGroup.findFirst({
      where: {
        id: input.parallelGroupId,

        appointment: {
          salonId,
        },
      },

      select: {
        id: true,
        appointmentId: true,

        appointment: {
          select: {
            services: {
              select: {
                id: true,
                assignedEmployeeId: true,
                roomId: true,
              },
            },
          },
        },
      },
    });

    if (!initialGroup) {
      throw new ResourceNotFoundError(
        "Le groupe parallèle demandé est introuvable.",
      );
    }

    /*
     * Verrouiller toutes les ressources potentiellement
     * touchées par l'allongement du rendez-vous.
     */
    await lockResources(tx, [
      appointmentLockKey(salonId, initialGroup.appointmentId),

      ...initialGroup.appointment.services.map((service) =>
        appointmentServiceLockKey(salonId, service.id),
      ),

      ...initialGroup.appointment.services
        .map((service) => service.assignedEmployeeId)
        .filter((employeeId): employeeId is string => employeeId !== null)
        .map((employeeId) => employeeLockKey(salonId, employeeId)),

      ...initialGroup.appointment.services
        .map((service) => service.roomId)
        .filter((roomId): roomId is string => roomId !== null)
        .map((roomId) => roomLockKey(salonId, roomId)),
    ]);

    /*
     * Relire après verrouillage.
     */
    const parallelGroup = await tx.parallelGroup.findFirst({
      where: {
        id: initialGroup.id,

        appointment: {
          salonId,
        },
      },

      include: {
        services: {
          select: {
            parallelGroupId: true,
            appointmentServiceId: true,
          },
        },

        appointment: {
          include: {
            services: {
              select: {
                id: true,
                durationMinutes: true,
                assignedEmployeeId: true,
                roomId: true,

                parallelGroupLinks: {
                  select: {
                    parallelGroupId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!parallelGroup) {
      throw new ResourceNotFoundError(
        "Le groupe parallèle demandé est introuvable.",
      );
    }

    const appointment = parallelGroup.appointment;

    if (appointment.status !== "PLANNED") {
      throw new BusinessRuleError(
        "Un groupe parallèle ne peut être supprimé que sur un rendez-vous prévu.",
      );
    }

    /*
     * Un vrai groupe parallèle doit avoir au moins
     * deux prestations.
     */
    if (parallelGroup.services.length < 2) {
      throw new BusinessRuleError("Le groupe parallèle est incohérent.");
    }

    /*
     * Simulation de l'état après suppression du groupe.
     */
    const projectedServices = appointment.services.map((service) => ({
      id: service.id,

      durationMinutes: service.durationMinutes,

      parallelGroupLinks: service.parallelGroupLinks.filter(
        (link) => link.parallelGroupId !== parallelGroup.id,
      ),
    }));

    const newEstimatedDurationMinutes =
      calculateAppointmentDuration(projectedServices);

    if (newEstimatedDurationMinutes <= 0) {
      throw new BusinessRuleError(
        "La durée calculée du rendez-vous est invalide.",
      );
    }

    const employeeIds = [
      ...new Set(
        appointment.services
          .map((service) => service.assignedEmployeeId)
          .filter((employeeId): employeeId is string => employeeId !== null),
      ),
    ];

    const roomIds = [
      ...new Set(
        appointment.services
          .map((service) => service.roomId)
          .filter((roomId): roomId is string => roomId !== null),
      ),
    ];

    /*
     * Supprimer le parallélisme peut rallonger le rendez-vous.
     * On revalide donc toutes les ressources sur la nouvelle durée.
     */
    for (const employeeId of employeeIds) {
      await validateEmployeeAvailability(tx, {
        salonId,
        employeeId,
        scheduledStart: appointment.scheduledStart,
        estimatedDurationMinutes: newEstimatedDurationMinutes,
        excludeAppointmentId: appointment.id,
      });
    }

    for (const roomId of roomIds) {
      await validateRoomAvailability(tx, {
        salonId,
        roomId,
        scheduledStart: appointment.scheduledStart,
        estimatedDurationMinutes: newEstimatedDurationMinutes,
        excludeAppointmentId: appointment.id,
      });
    }

    /*
     * Le modèle de liaison n'a pas de champ id.
     * On supprime donc les liens via parallelGroupId.
     */
    await tx.parallelGroupService.deleteMany({
      where: {
        parallelGroupId: parallelGroup.id,
      },
    });

    const deleteResult = await tx.parallelGroup.deleteMany({
      where: {
        id: parallelGroup.id,

        appointmentId: appointment.id,
      },
    });

    if (deleteResult.count !== 1) {
      throw new BusinessRuleError(
        "Le groupe parallèle ne peut plus être supprimé.",
      );
    }

    /*
     * Mise à jour conditionnelle du rendez-vous.
     */
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

        action: "PARALLEL_GROUP_REMOVED",

        entityType: "PARALLEL_GROUP",

        entityId: parallelGroup.id,

        metadata: {
          appointmentId: appointment.id,

          appointmentServiceIds: parallelGroup.services.map(
            (service) => service.appointmentServiceId,
          ),

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
