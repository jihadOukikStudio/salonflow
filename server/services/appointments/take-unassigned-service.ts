import type { CurrentUser } from "@/server/permissions";
import { requirePermission } from "@/server/permissions";

import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";

import { prisma } from "@/server/db/prisma";
import { lockResource } from "@/server/db/resource-lock";

import {
  appointmentServiceLockKey,
  employeeLockKey,
} from "@/server/services/resources/resource-lock-keys";
import { validateEmployeeAvailability } from "@/server/services/resources/validate-employee-availability";
import { assertEmployeeCanPerformServiceInDb } from "@/server/services/employees/skill-policy";

import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

type TakeUnassignedServiceInput = {
  appointmentServiceId: string;
};

export async function takeUnassignedService(
  currentUser: CurrentUser,
  input: TakeUnassignedServiceInput,
) {
  const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);

  requirePermission(authoritativeUser, "appointments:take-unassigned-service");

  const salonId = authoritativeUser.salonId;

  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findFirst({
      where: {
        salonId,
        userId: authoritativeUser.id,
        isActive: true,
        user: {
          isActive: true,
        },
      },
      select: {
        id: true,
      },
    });

    if (!employee) {
      throw new ResourceNotFoundError(
        "Aucune employée active n'est associée à ce compte.",
      );
    }

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
        "Impossible de prendre une prestation d'un rendez-vous annulé.",
      );
    }

    if (appointmentService.appointment.status === "CLOSED") {
      throw new BusinessRuleError(
        "Impossible de modifier un rendez-vous clôturé.",
      );
    }

    if (appointmentService.assignedEmployeeId !== null) {
      throw new BusinessRuleError(
        "Cette prestation vient d'être prise par une autre employée.",
      );
    }

    await lockResource(tx, employeeLockKey(salonId, employee.id));

    await assertEmployeeCanPerformServiceInDb(tx, {
      salonId,
      employeeId: employee.id,
      serviceId: appointmentService.serviceId,
      serviceName: appointmentService.serviceNameSnapshot,
    });

    await validateEmployeeAvailability(tx, {
      salonId,
      employeeId: employee.id,
      scheduledStart: appointmentService.appointment.scheduledStart,
      estimatedDurationMinutes:
        appointmentService.appointment.estimatedDurationMinutes,
      excludeAppointmentId: appointmentService.appointmentId,
    });

    const updateResult = await tx.appointmentService.updateMany({
      where: {
        id: appointmentService.id,
        assignedEmployeeId: null,
        appointment: {
          salonId,
        },
      },
      data: {
        assignedEmployeeId: employee.id,
      },
    });

    if (updateResult.count !== 1) {
      throw new BusinessRuleError(
        "Cette prestation vient d'être prise par une autre employée.",
      );
    }

    await tx.activityLog.create({
      data: {
        salonId,
        userId: authoritativeUser.id,

        action: "APPOINTMENT_SERVICE_TAKEN",

        entityType: "AppointmentService",
        entityId: appointmentService.id,

        metadata: {
          appointmentId: appointmentService.appointmentId,
          employeeId: employee.id,
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
        assignedEmployee: true,
      },
    });
  });
}
