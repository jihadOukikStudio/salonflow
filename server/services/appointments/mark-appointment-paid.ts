import { Prisma } from "@/app/generated/prisma/client";
import type { CurrentUser } from "@/server/permissions";
import { requirePermission } from "@/server/permissions";

import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { prisma } from "@/server/db/prisma";
import { lockResource } from "@/server/db/resource-lock";
import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

type MarkAppointmentPaidInput = {
  appointmentId: string;
  amount: number;
};

/**
 * Enregistre l'encaissement cash avec le montant réellement encaissé.
 *
 * Le montant catalogue reste stocké dans les snapshots AppointmentService.price.
 * Payment.amount représente le montant final réellement encaissé.
 * Seuls ADMIN / employés avec gestion du salon disposent de la permission.
 */
export async function markAppointmentPaid(
  currentUser: CurrentUser,
  input: MarkAppointmentPaidInput,
) {
  const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);
  requirePermission(authoritativeUser, "appointments:record-payment");

  if (
    !Number.isFinite(input.amount) ||
    input.amount < 0 ||
    input.amount > 1_000_000
  ) {
    throw new BusinessRuleError("Le montant encaissé est invalide.");
  }

  const amount = new Prisma.Decimal(input.amount.toFixed(2));
  const salonId = authoritativeUser.salonId;

  return prisma.$transaction(async (tx) => {
    const initialAppointment = await tx.appointment.findFirst({
      where: { id: input.appointmentId, salonId },
      select: { id: true },
    });

    if (!initialAppointment) {
      throw new ResourceNotFoundError(
        "Le rendez-vous demandé est introuvable.",
      );
    }

    await lockResource(
      tx,
      `salonflow:appointment:${salonId}:${initialAppointment.id}`,
    );

    const appointment = await tx.appointment.findFirst({
      where: { id: initialAppointment.id, salonId },
      select: {
        id: true,
        status: true,
        payment: { select: { id: true, status: true } },
      },
    });

    if (!appointment) {
      throw new ResourceNotFoundError(
        "Le rendez-vous demandé est introuvable.",
      );
    }

    if (appointment.status === "CANCELLED") {
      throw new BusinessRuleError(
        "Un rendez-vous annulé ne peut pas être encaissé.",
      );
    }
    if (appointment.status === "CLOSED") {
      throw new BusinessRuleError(
        "Un rendez-vous clôturé ne peut pas être encaissé.",
      );
    }
    if (appointment.status !== "COMPLETED") {
      throw new BusinessRuleError(
        "Toutes les prestations doivent être terminées avant l'encaissement.",
      );
    }
    if (appointment.payment?.status === "PAID") {
      throw new BusinessRuleError("Ce rendez-vous a déjà été encaissé.");
    }

    const serviceCount = await tx.appointmentService.count({
      where: { appointmentId: appointment.id, appointment: { salonId } },
    });
    if (serviceCount === 0) {
      throw new BusinessRuleError(
        "Impossible d'encaisser un rendez-vous sans prestation.",
      );
    }

    const paidAt = new Date();
    const payment = appointment.payment
      ? await tx.payment.update({
          where: { id: appointment.payment.id },
          data: {
            amount,
            method: "CASH",
            status: "PAID",
            paidAt,
            recordedByUserId: authoritativeUser.id,
          },
        })
      : await tx.payment.create({
          data: {
            appointmentId: appointment.id,
            amount,
            method: "CASH",
            status: "PAID",
            paidAt,
            recordedByUserId: authoritativeUser.id,
          },
        });

    await tx.activityLog.create({
      data: {
        salonId,
        userId: authoritativeUser.id,
        action: "APPOINTMENT_PAYMENT_RECORDED",
        entityType: "APPOINTMENT",
        entityId: appointment.id,
        metadata: {
          paymentId: payment.id,
          method: payment.method,
          status: payment.status,
          amount: payment.amount.toString(),
        },
      },
    });

    return payment;
  });
}
