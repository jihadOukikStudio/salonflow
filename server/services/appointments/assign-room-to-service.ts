import type { CurrentUser } from "@/server/permissions";
import { requirePermission } from "@/server/permissions";

import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";

import { prisma } from "@/server/db/prisma";
import { lockResource, lockResources } from "@/server/db/resource-lock";

import {
  appointmentServiceLockKey,
  roomLockKey,
} from "@/server/services/resources/resource-lock-keys";
import { validateRoomAvailability } from "@/server/services/resources/validate-room-availability";

import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

type AssignRoomToServiceInput = {
  appointmentServiceId: string;
  roomId: string;
};

export async function assignRoomToService(
  currentUser: CurrentUser,
  input: AssignRoomToServiceInput,
) {
  const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);

  requirePermission(authoritativeUser, "rooms:assign");

  const salonId = authoritativeUser.salonId;

  return prisma.$transaction(async (tx) => {
    const existingAppointmentService = await tx.appointmentService.findFirst({
      where: {
        id: input.appointmentServiceId,
        appointment: {
          salonId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!existingAppointmentService) {
      throw new ResourceNotFoundError("Prestation du rendez-vous introuvable.");
    }

    await lockResource(
      tx,
      appointmentServiceLockKey(salonId, existingAppointmentService.id),
    );

    const appointmentService = await tx.appointmentService.findFirst({
      where: {
        id: existingAppointmentService.id,
        appointment: {
          salonId,
        },
      },
      include: {
        appointment: true,
      },
    });

    if (!appointmentService) {
      throw new ResourceNotFoundError("Prestation du rendez-vous introuvable.");
    }

    if (appointmentService.appointment.status === "CANCELLED") {
      throw new BusinessRuleError(
        "Impossible d'affecter une salle à un rendez-vous annulé.",
      );
    }

    if (appointmentService.appointment.status === "CLOSED") {
      throw new BusinessRuleError(
        "Impossible de modifier un rendez-vous clôturé.",
      );
    }

    const room = await tx.room.findFirst({
      where: {
        id: input.roomId,
        salonId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!room) {
      throw new ResourceNotFoundError("Salle introuvable.");
    }

    const roomLockKeys = [roomLockKey(salonId, room.id)];

    if (appointmentService.roomId) {
      roomLockKeys.push(roomLockKey(salonId, appointmentService.roomId));
    }

    await lockResources(tx, roomLockKeys);

    await validateRoomAvailability(tx, {
      salonId,
      roomId: room.id,
      scheduledStart: appointmentService.appointment.scheduledStart,
      estimatedDurationMinutes:
        appointmentService.appointment.estimatedDurationMinutes,
      requiredRoomType: appointmentService.requiredRoomTypeSnapshot,
      excludeAppointmentId: appointmentService.appointmentId,
    });

    const previousRoomId = appointmentService.roomId;

    const updateResult = await tx.appointmentService.updateMany({
      where: {
        id: appointmentService.id,
        appointment: {
          salonId,
        },
      },
      data: {
        roomId: room.id,
      },
    });

    if (updateResult.count !== 1) {
      throw new ResourceNotFoundError("Prestation du rendez-vous introuvable.");
    }

    await tx.activityLog.create({
      data: {
        salonId,
        userId: authoritativeUser.id,

        action:
          previousRoomId === null
            ? "APPOINTMENT_SERVICE_ROOM_ASSIGNED"
            : "APPOINTMENT_SERVICE_ROOM_REASSIGNED",

        entityType: "AppointmentService",
        entityId: appointmentService.id,

        metadata: {
          appointmentId: appointmentService.appointmentId,
          previousRoomId,
          roomId: room.id,
        },
      },
    });

    return tx.appointmentService.findFirstOrThrow({
      where: {
        id: appointmentService.id,
        appointment: {
          salonId,
        },
      },
      include: {
        room: true,
      },
    });
  });
}
