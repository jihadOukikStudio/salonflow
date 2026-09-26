import type { CurrentUser } from "@/server/permissions";
import { requirePermission } from "@/server/permissions";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { prisma } from "@/server/db/prisma";
import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

type Input = { appointmentServiceId: string; comment: string | null };

export async function updateAppointmentServiceComment(
  currentUser: CurrentUser,
  input: Input,
) {
  const user = await getAuthoritativeCurrentUser(currentUser);
  requirePermission(user, "appointments:update-own-service-status");
  const service = await prisma.appointmentService.findFirst({
    where: {
      id: input.appointmentServiceId,
      appointment: { salonId: user.salonId },
    },
    select: {
      id: true,
      assignedEmployee: { select: { userId: true } },
      appointment: { select: { status: true } },
    },
  });
  if (!service)
    throw new ResourceNotFoundError("La prestation demandée est introuvable.");
  if (
    service.appointment.status === "CANCELLED" ||
    service.appointment.status === "CLOSED"
  )
    throw new BusinessRuleError(
      "Le commentaire de cette prestation ne peut plus être modifié.",
    );
  const manager =
    user.role === "ADMIN" || (user.role === "EMPLOYEE" && user.canManageSalon);
  if (!manager && service.assignedEmployee?.userId !== user.id)
    throw new BusinessRuleError(
      "Vous ne pouvez commenter que vos propres prestations.",
    );
  return prisma.appointmentService.update({
    where: { id: service.id },
    data: {
      employeeComment: input.comment?.trim() || null,
      priceReviewedAt: null,
    },
  });
}
