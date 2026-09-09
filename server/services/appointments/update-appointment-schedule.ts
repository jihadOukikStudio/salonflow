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
import { validateBookingWindow } from "@/server/services/appointments/booking-window";
import { validateRoomAvailability } from "@/server/services/resources/validate-room-availability";

import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

type UpdateAppointmentScheduleInput = {
  appointmentId: string;
  scheduledStart: Date;
};

export async function updateAppointmentSchedule(
  currentUser: CurrentUser,
  input: UpdateAppointmentScheduleInput,
) {
  const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);

  requirePermission(authoritativeUser, "appointments:update");

  const salonId = authoritativeUser.salonId;

  if (
    !(input.scheduledStart instanceof Date) ||
    Number.isNaN(input.scheduledStart.getTime())
  ) {
    throw new BusinessRuleError(
      "La nouvelle date du rendez-vous est invalide.",
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
        services: {
          select: {
            id: true,
            assignedEmployeeId: true,
            roomId: true,
          },
        },
      },
    });

    if (!initialAppointment) {
      throw new ResourceNotFoundError(
        "Le rendez-vous demandé est introuvable.",
      );
    }

    await lockResources(tx, [
      appointmentLockKey(salonId, initialAppointment.id),

      ...initialAppointment.services.map((service) =>
        appointmentServiceLockKey(salonId, service.id),
      ),

      ...initialAppointment.services
        .map((service) => service.assignedEmployeeId)
        .filter((employeeId): employeeId is string => employeeId !== null)
        .map((employeeId) => employeeLockKey(salonId, employeeId)),

      ...initialAppointment.services
        .map((service) => service.roomId)
        .filter((roomId): roomId is string => roomId !== null)
        .map((roomId) => roomLockKey(salonId, roomId)),
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
            assignedEmployeeId: true,
            roomId: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new ResourceNotFoundError(
        "Le rendez-vous demandé est introuvable.",
      );
    }

    if (appointment.status === "CANCELLED") {
      throw new BusinessRuleError(
        "Un rendez-vous annulé ne peut pas être déplacé.",
      );
    }

    if (appointment.status === "CLOSED") {
      throw new BusinessRuleError(
        "Un rendez-vous clôturé ne peut pas être déplacé.",
      );
    }

    if (appointment.status === "COMPLETED") {
      throw new BusinessRuleError(
        "Un rendez-vous terminé ne peut pas être déplacé.",
      );
    }

    if (appointment.status === "IN_PROGRESS") {
      throw new BusinessRuleError(
        "Un rendez-vous en cours ne peut pas être déplacé.",
      );
    }

    if (appointment.status !== "PLANNED") {
      throw new BusinessRuleError("Ce rendez-vous ne peut pas être déplacé.");
    }

    validateBookingWindow(
      input.scheduledStart,
      appointment.estimatedDurationMinutes,
    );

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

    const initiallyLockedEmployeeIds = new Set(
      initialAppointment.services
        .map((service) => service.assignedEmployeeId)
        .filter((id): id is string => id !== null),
    );

    const initiallyLockedRoomIds = new Set(
      initialAppointment.services
        .map((service) => service.roomId)
        .filter((id): id is string => id !== null),
    );

    const additionalLocks: string[] = [];

    for (const employeeId of employeeIds) {
      if (!initiallyLockedEmployeeIds.has(employeeId)) {
        additionalLocks.push(employeeLockKey(salonId, employeeId));
      }
    }

    for (const roomId of roomIds) {
      if (!initiallyLockedRoomIds.has(roomId)) {
        additionalLocks.push(roomLockKey(salonId, roomId));
      }
    }

    if (additionalLocks.length > 0) {
      await lockResources(tx, additionalLocks);
    }

    for (const employeeId of employeeIds) {
      await validateEmployeeAvailability(tx, {
        salonId,
        employeeId,
        scheduledStart: input.scheduledStart,
        estimatedDurationMinutes: appointment.estimatedDurationMinutes,
        excludeAppointmentId: appointment.id,
      });
    }

    for (const roomId of roomIds) {
      await validateRoomAvailability(tx, {
        salonId,
        roomId,
        scheduledStart: input.scheduledStart,
        estimatedDurationMinutes: appointment.estimatedDurationMinutes,
        excludeAppointmentId: appointment.id,
      });
    }

    const oldScheduledStart = appointment.scheduledStart;

    const updateResult = await tx.appointment.updateMany({
      where: {
        id: appointment.id,
        salonId,
        status: "PLANNED",
      },
      data: {
        scheduledStart: input.scheduledStart,
      },
    });

    if (updateResult.count !== 1) {
      throw new BusinessRuleError("Le rendez-vous ne peut plus être déplacé.");
    }

    await tx.activityLog.create({
      data: {
        salonId,
        userId: authoritativeUser.id,

        action: "APPOINTMENT_SCHEDULE_UPDATED",

        entityType: "APPOINTMENT",
        entityId: appointment.id,

        metadata: {
          previousScheduledStart: oldScheduledStart.toISOString(),
          scheduledStart: input.scheduledStart.toISOString(),
          estimatedDurationMinutes: appointment.estimatedDurationMinutes,
        },
      },
    });

    const updatedAppointment = await tx.appointment.findFirst({
      where: {
        id: appointment.id,
        salonId,
      },
      include: {
        services: true,
        payment: true,
      },
    });

    if (!updatedAppointment) {
      throw new ResourceNotFoundError(
        "Le rendez-vous déplacé est introuvable.",
      );
    }

    return updatedAppointment;
  });
}
