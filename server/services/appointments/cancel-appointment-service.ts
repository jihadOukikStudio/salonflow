import type { CurrentUser } from "@/server/permissions";
import { requirePermission } from "@/server/permissions";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { prisma } from "@/server/db/prisma";
import { lockResources } from "@/server/db/resource-lock";
import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

type CancelAppointmentServiceInput = {
  appointmentServiceId: string;
  reason?: string | null;
};

export async function cancelAppointmentService(
  currentUser: CurrentUser,
  input: CancelAppointmentServiceInput,
) {
  const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);
  requirePermission(authoritativeUser, "appointments:cancel");
  const salonId = authoritativeUser.salonId;

  return prisma.$transaction(async (tx) => {
    const initial = await tx.appointmentService.findFirst({
      where: { id: input.appointmentServiceId, appointment: { salonId } },
      select: {
        id: true,
        appointmentId: true,
        assignedEmployeeId: true,
        roomId: true,
      },
    });
    if (!initial)
      throw new ResourceNotFoundError(
        "La prestation demandée est introuvable.",
      );

    await lockResources(tx, [
      `salonflow:appointment:${salonId}:${initial.appointmentId}`,
      `salonflow:appointment-service:${salonId}:${initial.id}`,
      ...(initial.assignedEmployeeId
        ? [`salonflow:employee:${salonId}:${initial.assignedEmployeeId}`]
        : []),
      ...(initial.roomId
        ? [`salonflow:room:${salonId}:${initial.roomId}`]
        : []),
    ]);

    const service = await tx.appointmentService.findFirst({
      where: { id: initial.id, appointment: { salonId } },
      include: {
        appointment: {
          include: {
            services: {
              select: {
                id: true,
                scheduledStart: true,
                durationMinutes: true,
                cancelledAt: true,
              },
            },
            payment: true,
          },
        },
        parallelGroupLinks: true,
      },
    });
    if (!service)
      throw new ResourceNotFoundError(
        "La prestation demandée est introuvable.",
      );

    const appointment = service.appointment;
    if (appointment.status === "CLOSED" || appointment.status === "CANCELLED") {
      throw new BusinessRuleError("Ce rendez-vous ne peut plus être modifié.");
    }
    if (appointment.payment?.status === "PAID") {
      throw new BusinessRuleError(
        "Une prestation d’un rendez-vous déjà encaissé ne peut pas être annulée.",
      );
    }
    if (service.cancelledAt) {
      throw new BusinessRuleError("Cette prestation est déjà annulée.");
    }
    if (service.status !== "TODO") {
      throw new BusinessRuleError(
        "Une prestation déjà commencée ou terminée ne peut pas être annulée.",
      );
    }
    if (service.parallelGroupLinks.length > 0) {
      throw new BusinessRuleError(
        "Cette prestation appartient à un groupe parallèle. Retirez d’abord le groupe parallèle avant de l’annuler.",
      );
    }

    const cancelledAt = new Date();
    const reason = input.reason?.trim() || null;

    const updated = await tx.appointmentService.updateMany({
      where: {
        id: service.id,
        appointmentId: appointment.id,
        status: "TODO",
        cancelledAt: null,
      },
      data: {
        cancelledAt,
        cancelledByUserId: authoritativeUser.id,
        cancellationReason: reason,
      },
    });
    if (updated.count !== 1)
      throw new BusinessRuleError(
        "Cette prestation ne peut plus être annulée.",
      );

    const activeServices = appointment.services.filter(
      (item) => item.id !== service.id && item.cancelledAt === null,
    );

    if (activeServices.length === 0) {
      await tx.appointment.update({
        where: { id: appointment.id },
        data: {
          status: "CANCELLED",
          cancelledAt,
          cancelledByUserId: authoritativeUser.id,
        },
      });
    } else {
      const maxEnd = Math.max(
        ...activeServices.map(
          (item) =>
            item.scheduledStart.getTime() + item.durationMinutes * 60_000,
        ),
      );
      const estimatedDurationMinutes = Math.max(
        1,
        Math.ceil((maxEnd - appointment.scheduledStart.getTime()) / 60_000),
      );
      await tx.appointment.update({
        where: { id: appointment.id },
        data: { estimatedDurationMinutes },
      });
    }

    await tx.activityLog.create({
      data: {
        salonId,
        userId: authoritativeUser.id,
        action: "APPOINTMENT_SERVICE_CANCELLED",
        entityType: "APPOINTMENT_SERVICE",
        entityId: service.id,
        metadata: {
          appointmentId: appointment.id,
          serviceName: service.serviceNameSnapshot,
          reason,
          cancelledAt: cancelledAt.toISOString(),
        },
      },
    });

    return tx.appointment.findFirstOrThrow({
      where: { id: appointment.id, salonId },
      include: { services: true },
    });
  });
}
