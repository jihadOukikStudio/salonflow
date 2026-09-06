import type { Prisma } from "@/app/generated/prisma/client";

import { BusinessRuleError } from "@/server/services/errors";
import {
  getAppointmentEnd,
  getAppointmentInterval,
  intervalsOverlap,
} from "@/server/services/resources/appointment-interval";

type ValidateEmployeeAvailabilityInput = {
  salonId: string;
  employeeId: string;
  scheduledStart: Date;
  estimatedDurationMinutes: number;
  excludeAppointmentId?: string;
};

export async function validateEmployeeAvailability(
  tx: Prisma.TransactionClient,
  input: ValidateEmployeeAvailabilityInput,
): Promise<void> {
  const interval = getAppointmentInterval(
    input.scheduledStart,
    input.estimatedDurationMinutes,
  );

  const employee = await tx.employee.findFirst({
    where: {
      id: input.employeeId,
      salonId: input.salonId,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!employee) {
    throw new BusinessRuleError(
      "L'employée demandée est introuvable ou inactive.",
    );
  }

  const unavailability = await tx.employeeUnavailability.findFirst({
    where: {
      employeeId: input.employeeId,
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
      "L'employée est indisponible pendant ce rendez-vous.",
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
          assignedEmployeeId: input.employeeId,
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
      "L'employée est déjà affectée à un autre rendez-vous sur ce créneau.",
    );
  }
}
