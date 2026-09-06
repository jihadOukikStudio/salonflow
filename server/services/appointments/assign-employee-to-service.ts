import type { CurrentUser } from "@/server/permissions";
import { requirePermission } from "@/server/permissions";

import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";

import { prisma } from "@/server/db/prisma";
import { lockResource, lockResources } from "@/server/db/resource-lock";

import {
  employeeLockKey,
  appointmentServiceLockKey,
} from "@/server/services/resources/resource-lock-keys";
import { validateEmployeeAvailability } from "@/server/services/resources/validate-employee-availability";

import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

type AssignEmployeeToServiceInput = {
  appointmentServiceId: string;
  employeeId: string;
};

export async function assignEmployeeToService(
  currentUser: CurrentUser,
  input: AssignEmployeeToServiceInput,
) {
  const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);

  requirePermission(authoritativeUser, "appointments:assign");

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
        "Impossible d'affecter une employée à un rendez-vous annulé.",
      );
    }

    if (appointmentService.appointment.status === "CLOSED") {
      throw new BusinessRuleError(
        "Impossible de modifier un rendez-vous clôturé.",
      );
    }

    const employee = await tx.employee.findFirst({
      where: {
        id: input.employeeId,
        salonId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!employee) {
      throw new ResourceNotFoundError("Employée introuvable.");
    }

    const employeeLockKeys = [employeeLockKey(salonId, employee.id)];

    if (appointmentService.assignedEmployeeId) {
      employeeLockKeys.push(
        employeeLockKey(salonId, appointmentService.assignedEmployeeId),
      );
    }

    await lockResources(tx, employeeLockKeys);

    await validateEmployeeAvailability(tx, {
      salonId,
      employeeId: employee.id,
      scheduledStart: appointmentService.appointment.scheduledStart,
      estimatedDurationMinutes:
        appointmentService.appointment.estimatedDurationMinutes,
      excludeAppointmentId: appointmentService.appointmentId,
    });

    const previousEmployeeId = appointmentService.assignedEmployeeId;

    const updateResult = await tx.appointmentService.updateMany({
      where: {
        id: appointmentService.id,
        appointment: {
          salonId,
        },
      },
      data: {
        assignedEmployeeId: employee.id,
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
          previousEmployeeId === null
            ? "APPOINTMENT_SERVICE_ASSIGNED"
            : "APPOINTMENT_SERVICE_REASSIGNED",

        entityType: "AppointmentService",
        entityId: appointmentService.id,

        metadata: {
          appointmentId: appointmentService.appointmentId,
          previousEmployeeId,
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
