import type { CurrentUser } from "@/server/permissions";
import { requirePermission } from "@/server/permissions";

import { prisma } from "@/server/db/prisma";
import { lockResource } from "@/server/db/resource-lock";

import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

type CreateRoomUnavailabilityInput = {
  roomId: string;
  startAt: Date;
  endAt: Date;
  reason?: string | null;
};

export async function createRoomUnavailability(
  currentUser: CurrentUser,
  input: CreateRoomUnavailabilityInput,
) {
  requirePermission(currentUser, "rooms:manage-unavailability");

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
    const room = await tx.room.findFirst({
      where: {
        id: input.roomId,
        salonId,
      },

      select: {
        id: true,
        isActive: true,
      },
    });

    if (!room) {
      throw new ResourceNotFoundError("La salle demandée est introuvable.");
    }

    if (!room.isActive) {
      throw new BusinessRuleError(
        "Une indisponibilité ne peut pas être créée pour une salle inactive.",
      );
    }

    /*
     * Même clé que assignRoomToService().
     */
    await lockResource(tx, `salonflow:room:${salonId}:${room.id}`);

    const lockedRoom = await tx.room.findFirst({
      where: {
        id: room.id,
        salonId,
      },

      select: {
        id: true,
        isActive: true,
      },
    });

    if (!lockedRoom) {
      throw new ResourceNotFoundError("La salle demandée est introuvable.");
    }

    if (!lockedRoom.isActive) {
      throw new BusinessRuleError(
        "Une indisponibilité ne peut pas être créée pour une salle inactive.",
      );
    }

    const overlappingUnavailability = await tx.roomUnavailability.findFirst({
      where: {
        roomId: lockedRoom.id,

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
    });

    if (overlappingUnavailability) {
      throw new BusinessRuleError(
        "Cette salle possède déjà une indisponibilité sur ce créneau.",
      );
    }

    const candidateAssignments = await tx.appointmentService.findMany({
      where: {
        roomId: lockedRoom.id,

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
        "Cette salle est déjà utilisée par un rendez-vous sur ce créneau. Réorganisez d'abord le rendez-vous avant de créer l'indisponibilité.",
      );
    }

    const unavailability = await tx.roomUnavailability.create({
      data: {
        roomId: lockedRoom.id,
        startAt: input.startAt,
        endAt: input.endAt,
        reason: input.reason?.trim() || null,
        createdByUserId: currentUser.id,
      },
    });

    await tx.activityLog.create({
      data: {
        salonId,
        userId: currentUser.id,
        action: "ROOM_UNAVAILABILITY_CREATED",
        entityType: "ROOM_UNAVAILABILITY",
        entityId: unavailability.id,

        metadata: {
          roomId: lockedRoom.id,
          startAt: input.startAt.toISOString(),
          endAt: input.endAt.toISOString(),
        },
      },
    });

    return unavailability;
  });
}
