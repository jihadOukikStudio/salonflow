import type { CurrentUser } from "@/server/permissions";
import { requirePermission } from "@/server/permissions";

import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";

import { prisma } from "@/server/db/prisma";
import { lockResources } from "@/server/db/resource-lock";

import {
  appointmentLockKey,
  appointmentServiceLockKey,
  employeeLockKey,
} from "@/server/services/resources/resource-lock-keys";
import { validateEmployeeAvailability } from "@/server/services/resources/validate-employee-availability";

import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

type StartAppointmentServiceInput = {
  appointmentServiceId: string;
};

/**
 * Démarre réellement une prestation.
 *
 * Le verrouillage porte à la fois sur :
 * - le rendez-vous ;
 * - la prestation.
 *
 * Toutes les opérations d'exécution utilisent ainsi le même
 * protocole de concurrence.
 */
export async function startAppointmentService(
  currentUser: CurrentUser,
  input: StartAppointmentServiceInput,
) {
  const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);

  requirePermission(
    authoritativeUser,
    "appointments:update-own-service-status",
  );

  const salonId = authoritativeUser.salonId;

  return prisma.$transaction(async (tx) => {
    /*
     * Première lecture uniquement pour récupérer l'identité
     * de la prestation et du rendez-vous dans le salon courant.
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
      },
    });

    if (!initialService) {
      throw new ResourceNotFoundError(
        "La prestation demandée est introuvable.",
      );
    }

    /*
     * Verrouillage déterministe.
     *
     * Important :
     * toutes les mutations touchant l'exécution d'une prestation
     * doivent utiliser ces mêmes clés.
     */
    await lockResources(tx, [
      appointmentLockKey(salonId, initialService.appointmentId),
      appointmentServiceLockKey(salonId, initialService.id),
      ...(initialService.assignedEmployeeId
        ? [employeeLockKey(salonId, initialService.assignedEmployeeId)]
        : []),
    ]);

    /*
     * Relire après les verrous :
     * l'état a pu changer pendant l'attente.
     */
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
        "Une prestation d'un rendez-vous annulé ne peut pas être démarrée.",
      );
    }

    if (appointment.status === "CLOSED") {
      throw new BusinessRuleError(
        "Une prestation d'un rendez-vous clôturé ne peut pas être démarrée.",
      );
    }

    if (appointment.status === "COMPLETED") {
      throw new BusinessRuleError(
        "Une prestation d'un rendez-vous terminé ne peut pas être démarrée.",
      );
    }

    if (appointmentService.status !== "TODO") {
      throw new BusinessRuleError(
        "Seule une prestation à faire peut être démarrée.",
      );
    }

    if (!appointmentService.assignedEmployeeId) {
      throw new BusinessRuleError(
        "La prestation doit être affectée à une employée avant de pouvoir être démarrée.",
      );
    }

    if (
      !appointmentService.assignedEmployee ||
      !appointmentService.assignedEmployee.isActive
    ) {
      throw new BusinessRuleError(
        "L'employée affectée à cette prestation n'est plus active.",
      );
    }

    /*
     * Si l'affectation a changé pendant l'acquisition des verrous,
     * on préfère interrompre l'opération plutôt que démarrer avec
     * une ressource que cette transaction n'a pas verrouillée.
     */
    if (
      appointmentService.assignedEmployeeId !==
      initialService.assignedEmployeeId
    ) {
      throw new BusinessRuleError(
        "L'affectation de cette prestation vient de changer. Réessayez.",
      );
    }

    const startedAt = new Date();

    /*
     * Un rendez-vous futur ne peut pas être démarré à l'avance.
     * Cela évite notamment de contourner les indisponibilités
     * prévues pour le créneau réel du rendez-vous.
     */
    if (startedAt < appointment.scheduledStart) {
      throw new BusinessRuleError(
        "Cette prestation ne peut pas être démarrée avant l'heure prévue du rendez-vous.",
      );
    }

    /*
     * Défense en profondeur : on revérifie l'employée au moment
     * du démarrage, même si elle avait déjà été affectée.
     * Une donnée incohérente ou une indisponibilité concurrente
     * ne doit jamais permettre de lancer la prestation.
     */
    await validateEmployeeAvailability(tx, {
      salonId,
      employeeId: appointmentService.assignedEmployeeId,
      scheduledStart: appointment.scheduledStart,
      estimatedDurationMinutes: appointment.estimatedDurationMinutes,
      excludeAppointmentId: appointment.id,
    });

    const canManageAppointment =
      authoritativeUser.role === "ADMIN" ||
      (authoritativeUser.role === "EMPLOYEE" &&
        authoritativeUser.canManageSalon);

    /*
     * Une employée standard ne peut démarrer que sa propre prestation.
     *
     * Admin / Responsable peuvent enregistrer le démarrage
     * opérationnel au nom de l'employée affectée.
     */
    if (
      !canManageAppointment &&
      appointmentService.assignedEmployee.userId !== authoritativeUser.id
    ) {
      throw new BusinessRuleError(
        "Vous ne pouvez démarrer que les prestations qui vous sont affectées.",
      );
    }

    /*
     * Protection supplémentaire contre un changement inattendu
     * entre la lecture et l'UPDATE.
     */
    const updateResult = await tx.appointmentService.updateMany({
      where: {
        id: appointmentService.id,
        status: "TODO",
      },

      data: {
        status: "IN_PROGRESS",
        actualStartedAt: startedAt,
        actualFinishedAt: null,

        /*
         * Au démarrage, l'employée affectée devient
         * l'employée ayant réellement commencé la prestation.
         */
        performedByEmployeeId: appointmentService.assignedEmployeeId,
      },
    });

    if (updateResult.count !== 1) {
      throw new BusinessRuleError(
        "Cette prestation ne peut plus être démarrée.",
      );
    }

    /*
     * Le premier démarrage réel fait passer le rendez-vous
     * PLANNED -> IN_PROGRESS.
     */
    if (appointment.status === "PLANNED") {
      await tx.appointment.updateMany({
        where: {
          id: appointment.id,
          salonId,
          status: "PLANNED",
        },

        data: {
          status: "IN_PROGRESS",
        },
      });
    }

    await tx.activityLog.create({
      data: {
        salonId,
        userId: authoritativeUser.id,

        action: "APPOINTMENT_SERVICE_STARTED",
        entityType: "APPOINTMENT_SERVICE",
        entityId: appointmentService.id,

        metadata: {
          appointmentId: appointment.id,
          assignedEmployeeId: appointmentService.assignedEmployeeId,
          startedAt: startedAt.toISOString(),
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
        "La prestation démarrée est introuvable.",
      );
    }

    return result;
  });
}
