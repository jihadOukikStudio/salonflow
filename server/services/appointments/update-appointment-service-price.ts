import type { CurrentUser } from "@/server/permissions";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { prisma } from "@/server/db/prisma";
import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

type Input = {
  appointmentServiceId: string;
  price: number;
  reason?: string | null;
};

export async function updateAppointmentServicePrice(
  currentUser: CurrentUser,
  input: Input,
) {
  const user = await getAuthoritativeCurrentUser(currentUser);
  const canManage = user.role === "ADMIN" || user.canManageSalon;
  if (!canManage) {
    throw new BusinessRuleError(
      "Seule la gérante ou la responsable peut valider le montant d’une prestation.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const service = await tx.appointmentService.findFirst({
      where: {
        id: input.appointmentServiceId,
        appointment: { salonId: user.salonId },
      },
      select: {
        id: true,
        price: true,
        basePriceSnapshot: true,
        serviceNameSnapshot: true,
        appointmentId: true,
        appointment: {
          select: { status: true, payment: { select: { status: true } } },
        },
      },
    });

    if (!service) throw new ResourceNotFoundError("Prestation introuvable.");
    if (
      service.appointment.status === "CANCELLED" ||
      service.appointment.status === "CLOSED"
    ) {
      throw new BusinessRuleError(
        "Le montant de cette prestation ne peut plus être modifié.",
      );
    }
    if (service.appointment.payment?.status === "PAID") {
      throw new BusinessRuleError("Le rendez-vous est déjà encaissé.");
    }

    const basePrice = service.basePriceSnapshot ?? service.price;
    const reason = input.reason?.trim() || null;

    const updated = await tx.appointmentService.update({
      where: { id: service.id },
      data: {
        basePriceSnapshot: basePrice,
        price: input.price,
        priceAdjustmentReason:
          input.price === Number(basePrice) ? null : reason,
        priceReviewedAt: new Date(),
      },
    });

    await tx.activityLog.create({
      data: {
        salonId: user.salonId,
        userId: user.id,
        action: "APPOINTMENT_SERVICE_PRICE_REVIEWED",
        entityType: "AppointmentService",
        entityId: service.id,
        metadata: {
          serviceName: service.serviceNameSnapshot,
          basePrice: Number(basePrice),
          appliedPrice: input.price,
          reason,
        },
      },
    });

    return updated;
  });
}
