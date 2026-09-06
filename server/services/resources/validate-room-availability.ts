import type { Prisma, RoomType } from "@/app/generated/prisma/client";

import { BusinessRuleError } from "@/server/services/errors";
import {
  getAppointmentEnd,
  getAppointmentInterval,
  intervalsOverlap,
} from "@/server/services/resources/appointment-interval";

type ValidateRoomAvailabilityInput = {
  salonId: string;
  roomId: string;
  scheduledStart: Date;
  estimatedDurationMinutes: number;
  requiredRoomType?: RoomType | null;
  excludeAppointmentId?: string;
};

export async function validateRoomAvailability(
  tx: Prisma.TransactionClient,
  input: ValidateRoomAvailabilityInput,
): Promise<void> {
  const interval = getAppointmentInterval(
    input.scheduledStart,
    input.estimatedDurationMinutes,
  );

  const room = await tx.room.findFirst({
    where: {
      id: input.roomId,
      salonId: input.salonId,
      isActive: true,
    },
    select: {
      id: true,
      type: true,
    },
  });

  if (!room) {
    throw new BusinessRuleError(
      "La salle demandée est introuvable ou inactive.",
    );
  }

  if (input.requiredRoomType != null && room.type !== input.requiredRoomType) {
    throw new BusinessRuleError(
      "Cette salle n'est pas compatible avec la prestation.",
    );
  }

  const unavailability = await tx.roomUnavailability.findFirst({
    where: {
      roomId: input.roomId,
      startAt: {
        lt: interval.endAt,
      },
      endAt: {
        gt: interval.startAt,
      },
    },
    select: {
      id: true,
    },
  });

  if (unavailability) {
    throw new BusinessRuleError(
      "La salle est indisponible pendant ce rendez-vous.",
    );
  }

  const candidates = await tx.appointment.findMany({
    where: {
      salonId: input.salonId,
      ...(input.excludeAppointmentId
        ? {
            id: {
              not: input.excludeAppointmentId,
            },
          }
        : {}),
      status: {
        notIn: ["CANCELLED", "CLOSED"],
      },
      scheduledStart: {
        lt: interval.endAt,
      },
      services: {
        some: {
          roomId: input.roomId,
        },
      },
    },
    select: {
      scheduledStart: true,
      estimatedDurationMinutes: true,
    },
  });

  const conflict = candidates.some((candidate) =>
    intervalsOverlap(interval, {
      startAt: candidate.scheduledStart,
      endAt: getAppointmentEnd(
        candidate.scheduledStart,
        candidate.estimatedDurationMinutes,
      ),
    }),
  );

  if (conflict) {
    throw new BusinessRuleError(
      "La salle est déjà utilisée par un autre rendez-vous sur ce créneau.",
    );
  }
}
