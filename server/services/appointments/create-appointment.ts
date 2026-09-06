import type { Prisma } from "@/app/generated/prisma/client";
import type { CurrentUser } from "@/server/permissions";
import { requirePermission } from "@/server/permissions";

import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { prisma } from "@/server/db/prisma";
import { lockResources } from "@/server/db/resource-lock";
import { checkBookingFeasibilityInDb } from "@/server/services/appointments/check-booking-feasibility";

import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

export type CreateAppointmentServiceInput = {
  serviceId: string;
  durationMinutes?: number;
  price?: number;
};

export type CreateAppointmentInput = {
  clientId: string;
  scheduledStart: Date;
  internalNote?: string | null;
  services: CreateAppointmentServiceInput[];
};

function validateCreateAppointmentInput(input: CreateAppointmentInput) {
  if (input.services.length === 0) {
    throw new BusinessRuleError(
      "Le rendez-vous doit contenir au moins une prestation.",
    );
  }

  if (Number.isNaN(input.scheduledStart.getTime())) {
    throw new BusinessRuleError("La date du rendez-vous est invalide.");
  }
}

/**
 * Noyau transactionnel partagé.
 * Le caller doit déjà avoir revalidé l'utilisateur et sa permission.
 */
export async function createAppointmentInTransaction(
  tx: Prisma.TransactionClient,
  authoritativeUser: CurrentUser,
  input: CreateAppointmentInput,
) {
  validateCreateAppointmentInput(input);

  const salonId = authoritativeUser.salonId;

  const client = await tx.client.findFirst({
    where: {
      id: input.clientId,
      salonId,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!client) {
    throw new ResourceNotFoundError("Client introuvable.");
  }

  const serviceIds = [...new Set(input.services.map((item) => item.serviceId))];

  if (serviceIds.length !== input.services.length) {
    throw new BusinessRuleError(
      "Une prestation ne peut pas être ajoutée plusieurs fois au même rendez-vous.",
    );
  }

  const services = await tx.service.findMany({
    where: {
      salonId,
      id: {
        in: serviceIds,
      },
      isActive: true,
    },
  });

  if (services.length !== serviceIds.length) {
    throw new ResourceNotFoundError(
      "Une ou plusieurs prestations sont introuvables.",
    );
  }

  const servicesById = new Map(
    services.map((service) => [service.id, service]),
  );

  const appointmentServices = input.services.map((item) => {
    const service = servicesById.get(item.serviceId);

    if (!service) {
      throw new ResourceNotFoundError("Prestation introuvable.");
    }

    const durationMinutes =
      item.durationMinutes ?? service.defaultDurationMinutes;

    if (
      durationMinutes === null ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes <= 0
    ) {
      throw new BusinessRuleError(
        `La durée de la prestation "${service.name}" doit être configurée dans Prestations avant de pouvoir la réserver.`,
      );
    }

    const price = item.price ?? service.defaultPrice.toNumber();

    if (!Number.isFinite(price) || price < 0) {
      throw new BusinessRuleError(
        `Le prix de la prestation "${service.name}" est invalide.`,
      );
    }

    return {
      serviceId: service.id,
      serviceNameSnapshot: service.name,
      durationMinutes,
      price,
      requiredRoomTypeSnapshot: service.requiredRoomType,
    };
  });

  const estimatedDurationMinutes = appointmentServices.reduce(
    (total, service) => total + service.durationMinutes,
    0,
  );

  /*
   * Barrière anti-surbooking à l'écriture. La prévisualisation UI n'est
   * jamais considérée comme une autorisation : deux appels peuvent arriver
   * en même temps. On sérialise donc les créations du salon, puis on relit
   * la capacité dans LA transaction qui va créer le rendez-vous.
   */
  await lockResources(tx, [`booking-capacity:${salonId}`]);

  /*
   * IMPORTANT : la faisabilité finale doit travailler avec exactement les
   * mêmes durées que celles qui seront persistées. Sans cela, un override de
   * durée accepté par createAppointment pourrait être contrôlé avec la durée
   * catalogue et produire un faux conflit (ou, inversement, laisser passer un
   * créneau trop long).
   */
  const durationMinutesByServiceId = Object.fromEntries(
    appointmentServices.map((service) => [
      service.serviceId,
      service.durationMinutes,
    ]),
  );

  const feasibility = await checkBookingFeasibilityInDb(tx, {
    salonId,
    scheduledStart: input.scheduledStart,
    serviceIds,
    durationMinutesByServiceId,
  });

  if (!feasibility.canCreate) {
    throw new BusinessRuleError(
      feasibility.blockers[0] ??
        "Ce créneau n'a plus la capacité nécessaire pour ce rendez-vous.",
    );
  }

  const appointment = await tx.appointment.create({
    data: {
      salonId,
      clientId: client.id,
      scheduledStart: input.scheduledStart,
      estimatedDurationMinutes,
      internalNote: input.internalNote ?? null,
      createdByUserId: authoritativeUser.id,
      services: {
        create: appointmentServices,
      },
    },
    include: {
      client: true,
      services: true,
    },
  });

  await tx.activityLog.create({
    data: {
      salonId,
      userId: authoritativeUser.id,
      action: "APPOINTMENT_CREATED",
      entityType: "Appointment",
      entityId: appointment.id,
      metadata: {
        serviceCount: appointmentServices.length,
        estimatedDurationMinutes,
      },
    },
  });

  return appointment;
}

export async function createAppointment(
  currentUser: CurrentUser,
  input: CreateAppointmentInput,
) {
  const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);
  requirePermission(authoritativeUser, "appointments:create");

  return prisma.$transaction((tx) =>
    createAppointmentInTransaction(tx, authoritativeUser, input),
  );
}
