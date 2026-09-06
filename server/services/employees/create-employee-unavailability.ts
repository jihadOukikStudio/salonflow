import type { CurrentUser } from "@/server/permissions";
import { hasPermission, requirePermission } from "@/server/permissions";

import { prisma } from "@/server/db/prisma";
import { lockResource } from "@/server/db/resource-lock";

import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

type EmployeeUnavailabilityType = "ABSENCE" | "BREAK" | "LEAVE" | "UNAVAILABLE";

type CreateEmployeeUnavailabilityInput = {
  employeeId: string;
  type: EmployeeUnavailabilityType;
  startAt: Date;
  endAt: Date;
  note?: string | null;
};

export async function createEmployeeUnavailability(
  currentUser: CurrentUser,
  input: CreateEmployeeUnavailabilityInput,
) {
  const canManage = hasPermission(
    currentUser,
    "employee-unavailability:manage",
  );

  if (!canManage) {
    requirePermission(currentUser, "employee-unavailability:create-own");
  }

  const salonId = currentUser.salonId;

  if (
    !(input.startAt instanceof Date) ||
    Number.isNaN(input.startAt.getTime()) ||
    !(input.endAt instanceof Date) ||
    Number.isNaN(input.endAt.getTime())
  ) {
    throw new BusinessRuleError(
      "Les dates de l'indisponibilité sont invalides.",
    );
  }

  if (input.startAt >= input.endAt) {
    throw new BusinessRuleError(
      "La fin de l'indisponibilité doit être postérieure à son début.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findFirst({
      where: {
        id: input.employeeId,
        salonId,
      },

      select: {
        id: true,
        userId: true,
        isActive: true,
      },
    });

    if (!employee) {
      throw new ResourceNotFoundError("L'employée demandée est introuvable.");
    }

    if (!employee.isActive) {
      throw new BusinessRuleError(
        "Une indisponibilité ne peut pas être créée pour une employée inactive.",
      );
    }

    /*
     * Une employée standard ne peut créer une indisponibilité
     * que pour elle-même.
     */
    if (!canManage && employee.userId !== currentUser.id) {
      throw new BusinessRuleError(
        "Vous ne pouvez créer une indisponibilité que pour vous-même.",
      );
    }

    /*
     * Même clé que assignEmployeeToService().
     *
     * Ainsi :
     * - affectation employée
     * - création indisponibilité
     *
     * ne peuvent pas valider simultanément un état incompatible.
     */
    await lockResource(tx, `salonflow:employee:${salonId}:${employee.id}`);

    /*
     * On revalide l'employée après le verrou.
     */
    const lockedEmployee = await tx.employee.findFirst({
      where: {
        id: employee.id,
        salonId,
      },

      select: {
        id: true,
        userId: true,
        isActive: true,
      },
    });

    if (!lockedEmployee) {
      throw new ResourceNotFoundError("L'employée demandée est introuvable.");
    }

    if (!lockedEmployee.isActive) {
      throw new BusinessRuleError(
        "Une indisponibilité ne peut pas être créée pour une employée inactive.",
      );
    }

    if (!canManage && lockedEmployee.userId !== currentUser.id) {
      throw new BusinessRuleError(
        "Vous ne pouvez créer une indisponibilité que pour vous-même.",
      );
    }

    /*
     * Chevauchement :
     *
     * existing.startAt < new.endAt
     * &&
     * existing.endAt > new.startAt
     *
     * Les créneaux adjacents sont donc autorisés.
     */
    const overlappingUnavailability = await tx.employeeUnavailability.findFirst(
      {
        where: {
          employeeId: lockedEmployee.id,

          startAt: {
            lt: input.endAt,
          },

          endAt: {
            gt: input.startAt,
          },
        },

        select: {
          id: true,
        },
      },
    );

    if (overlappingUnavailability) {
      throw new BusinessRuleError(
        "Cette employée possède déjà une indisponibilité sur ce créneau.",
      );
    }

    /*
     * On récupère les affectations susceptibles de chevaucher.
     *
     * Comme Appointment stocke une durée en minutes et non une
     * date de fin persistée, le calcul précis de la fin est fait
     * côté serveur.
     */
    const candidateAssignments = await tx.appointmentService.findMany({
      where: {
        assignedEmployeeId: lockedEmployee.id,

        appointment: {
          salonId,

          status: {
            notIn: ["CANCELLED", "CLOSED"],
          },

          scheduledStart: {
            lt: input.endAt,
          },
        },
      },

      select: {
        id: true,

        appointment: {
          select: {
            id: true,
            scheduledStart: true,
            estimatedDurationMinutes: true,
          },
        },
      },
    });

    const conflictingAssignment = candidateAssignments.find(
      ({ appointment }) => {
        const appointmentEnd = new Date(
          appointment.scheduledStart.getTime() +
            appointment.estimatedDurationMinutes * 60_000,
        );

        return appointmentEnd > input.startAt;
      },
    );

    if (conflictingAssignment) {
      throw new BusinessRuleError(
        "Cette employée est déjà affectée à un rendez-vous sur ce créneau. Réorganisez d'abord le rendez-vous avant de créer l'indisponibilité.",
      );
    }

    const unavailability = await tx.employeeUnavailability.create({
      data: {
        employeeId: lockedEmployee.id,
        type: input.type,
        startAt: input.startAt,
        endAt: input.endAt,
        note: input.note?.trim() || null,
        createdByUserId: currentUser.id,
      },
    });

    await tx.activityLog.create({
      data: {
        salonId,
        userId: currentUser.id,
        action: "EMPLOYEE_UNAVAILABILITY_CREATED",
        entityType: "EMPLOYEE_UNAVAILABILITY",
        entityId: unavailability.id,

        metadata: {
          employeeId: lockedEmployee.id,
          type: input.type,
          startAt: input.startAt.toISOString(),
          endAt: input.endAt.toISOString(),
        },
      },
    });

    return unavailability;
  });
}
