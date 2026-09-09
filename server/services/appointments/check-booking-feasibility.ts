import type { Prisma, RoomType } from "@/app/generated/prisma/client";

import {
  getAppointmentEnd,
  intervalsOverlap,
} from "@/server/services/resources/appointment-interval";
import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";
import { validateBookingWindow } from "@/server/services/appointments/booking-window";
import {
  checkEmployeeCapacityInDb,
  type ServiceEmployeeCapacity,
} from "@/server/services/appointments/check-employee-capacity";

export type BookingFeasibilityLevel = "POSSIBLE" | "WARNING" | "BLOCKED";

export type BookingFeasibility = {
  canCreate: boolean;
  level: BookingFeasibilityLevel;
  durationMinutes: number;
  scheduledStart: string;
  scheduledEnd: string;
  employeeCapacity: {
    active: number;
    unavailable: number;
    reservedByAppointments: number;
    remaining: number;
  };
  serviceEmployeeCapacity: ServiceEmployeeCapacity[];
  roomCapacity: Array<{
    type: "HAMAM" | "TREATMENT_ROOM";
    active: number;
    unavailable: number;
    reservedByAppointments: number;
    remaining: number;
  }>;
  blockers: string[];
  warnings: string[];
};

type Db = Prisma.TransactionClient;

type Input = {
  salonId: string;
  scheduledStart: Date;
  serviceIds: string[];
  /**
   * Durées effectives déjà validées par le caller, indexées par serviceId.
   *
   * Si aucune valeur n'est fournie pour une prestation, la durée catalogue
   * (`defaultDurationMinutes`) reste utilisée. Cela conserve la compatibilité
   * avec les prévisualisations de réservation qui ne manipulent que les IDs.
   */
  durationMinutesByServiceId?: Readonly<Record<string, number>>;
};

function roomLabel(type: RoomType) {
  return type === "HAMAM" ? "Hamam" : "salle de soins";
}

/**
 * Capacité opérationnelle V1.
 *
 * Le modèle V1 ne planifie pas encore chaque prestation à une minute précise.
 * Pour ne pas promettre une capacité que le salon n'a pas, chaque rendez-vous
 * chevauchant réserve donc au minimum une place employée pendant son intervalle.
 * De même, un rendez-vous contenant une prestation nécessitant un type de salle
 * réserve une place de ce type, même si la salle concrète sera affectée plus tard.
 *
 * C'est volontairement conservateur : mieux vaut proposer un autre créneau que
 * recréer le surbooking qui est précisément l'un des problèmes métier à résoudre.
 */
export async function checkBookingFeasibilityInDb(
  db: Db,
  input: Input,
): Promise<BookingFeasibility> {
  if (Number.isNaN(input.scheduledStart.getTime())) {
    throw new BusinessRuleError("La date du rendez-vous est invalide.");
  }

  if (input.serviceIds.length === 0) {
    throw new BusinessRuleError("Sélectionnez au moins une prestation.");
  }

  const uniqueServiceIds = [...new Set(input.serviceIds)];
  if (uniqueServiceIds.length !== input.serviceIds.length) {
    throw new BusinessRuleError(
      "Une prestation ne peut être ajoutée qu'une seule fois au rendez-vous.",
    );
  }

  const services = await db.service.findMany({
    where: {
      salonId: input.salonId,
      id: { in: uniqueServiceIds },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      defaultDurationMinutes: true,
      requiredRoomType: true,
    },
  });

  if (services.length !== uniqueServiceIds.length) {
    throw new ResourceNotFoundError(
      "Une ou plusieurs prestations sont introuvables ou inactives.",
    );
  }

  let durationMinutes = 0;
  const requiredRoomTypes = new Set<RoomType>();

  for (const service of services) {
    const effectiveDurationMinutes =
      input.durationMinutesByServiceId?.[service.id] ??
      service.defaultDurationMinutes;

    if (
      effectiveDurationMinutes === null ||
      !Number.isInteger(effectiveDurationMinutes) ||
      effectiveDurationMinutes <= 0
    ) {
      throw new BusinessRuleError(
        `La durée de la prestation « ${service.name} » doit être configurée avant la réservation.`,
      );
    }

    durationMinutes += effectiveDurationMinutes;

    if (service.requiredRoomType) {
      requiredRoomTypes.add(service.requiredRoomType);
    }
  }

  const bookingWindow = validateBookingWindow(
    input.scheduledStart,
    durationMinutes,
  );
  const scheduledEnd = bookingWindow.scheduledEnd;
  const targetInterval = { startAt: input.scheduledStart, endAt: scheduledEnd };

  const [
    employees,
    employeeUnavailability,
    rooms,
    roomUnavailability,
    candidates,
  ] = await Promise.all([
    db.employee.findMany({
      where: { salonId: input.salonId, isActive: true },
      select: { id: true },
    }),
    db.employeeUnavailability.findMany({
      where: {
        employee: { salonId: input.salonId, isActive: true },
        startAt: { lt: scheduledEnd },
        endAt: { gt: input.scheduledStart },
      },
      select: { employeeId: true },
    }),
    db.room.findMany({
      where: { salonId: input.salonId, isActive: true },
      select: { id: true, type: true },
    }),
    db.roomUnavailability.findMany({
      where: {
        room: { salonId: input.salonId, isActive: true },
        startAt: { lt: scheduledEnd },
        endAt: { gt: input.scheduledStart },
      },
      select: { roomId: true },
    }),
    db.appointment.findMany({
      where: {
        salonId: input.salonId,
        status: { notIn: ["CANCELLED", "CLOSED"] },
        scheduledStart: { lt: scheduledEnd },
      },
      select: {
        id: true,
        scheduledStart: true,
        estimatedDurationMinutes: true,
        services: {
          select: { requiredRoomTypeSnapshot: true },
        },
      },
    }),
  ]);

  const overlappingAppointments = candidates.filter((appointment) =>
    intervalsOverlap(targetInterval, {
      startAt: appointment.scheduledStart,
      endAt: getAppointmentEnd(
        appointment.scheduledStart,
        appointment.estimatedDurationMinutes,
      ),
    }),
  );

  const unavailableEmployeeIds = new Set(
    employeeUnavailability.map((item) => item.employeeId),
  );
  const availableEmployeeCount = employees.filter(
    (employee) => !unavailableEmployeeIds.has(employee.id),
  ).length;

  // Un RDV chevauchant consomme au minimum une capacité employée, même si
  // l'affectation n'a pas encore été faite. Cela protège les RDV "À affecter".
  const employeeReserved = overlappingAppointments.length;
  const employeeRemaining = Math.max(
    0,
    availableEmployeeCount - employeeReserved,
  );

  const employeeSkillCapacity = await checkEmployeeCapacityInDb(db, {
    salonId: input.salonId,
    scheduledStart: input.scheduledStart,
    estimatedDurationMinutes: durationMinutes,
    services: services.map((service) => ({
      serviceId: service.id,
      serviceName: service.name,
    })),
  });

  const blockers: string[] = [...employeeSkillCapacity.blockers];
  const warnings: string[] = [...employeeSkillCapacity.warnings];

  if (employees.length === 0) {
    blockers.push("Aucune employée active n'est configurée dans le salon.");
  } else if (employeeRemaining <= 0) {
    blockers.push(
      "Aucune capacité employée ne reste sur toute la durée de ce rendez-vous. Choisissez un autre créneau ou réduisez les prestations.",
    );
  } else if (employeeRemaining === 1) {
    warnings.push(
      "Il ne reste qu'une capacité employée sur ce créneau. Toute nouvelle réservation concurrente devra être refusée ou déplacée.",
    );
  }

  const unavailableRoomIds = new Set(
    roomUnavailability.map((item) => item.roomId),
  );
  const roomCapacity: BookingFeasibility["roomCapacity"] = [];

  for (const type of requiredRoomTypes) {
    const activeRooms = rooms.filter((room) => room.type === type);
    const unavailable = activeRooms.filter((room) =>
      unavailableRoomIds.has(room.id),
    );
    const availableRoomCount = activeRooms.length - unavailable.length;
    const reservedByAppointments = overlappingAppointments.filter(
      (appointment) =>
        appointment.services.some(
          (service) => service.requiredRoomTypeSnapshot === type,
        ),
    ).length;
    const remaining = Math.max(0, availableRoomCount - reservedByAppointments);

    roomCapacity.push({
      type,
      active: activeRooms.length,
      unavailable: unavailable.length,
      reservedByAppointments,
      remaining,
    });

    if (activeRooms.length === 0) {
      blockers.push(`Aucune ${roomLabel(type)} active n'est configurée.`);
    } else if (remaining <= 0) {
      blockers.push(
        `Aucune ${roomLabel(type)} n'est disponible sur toute la durée de ce rendez-vous.`,
      );
    } else if (remaining === 1) {
      warnings.push(
        `Il ne reste qu'une ${roomLabel(type)} disponible sur ce créneau.`,
      );
    }
  }

  const canCreate = blockers.length === 0;
  const level: BookingFeasibilityLevel = !canCreate
    ? "BLOCKED"
    : warnings.length > 0
      ? "WARNING"
      : "POSSIBLE";

  return {
    canCreate,
    level,
    durationMinutes,
    scheduledStart: input.scheduledStart.toISOString(),
    scheduledEnd: scheduledEnd.toISOString(),
    employeeCapacity: {
      active: employees.length,
      unavailable: unavailableEmployeeIds.size,
      reservedByAppointments: employeeReserved,
      remaining: employeeRemaining,
    },
    serviceEmployeeCapacity: employeeSkillCapacity.serviceCapacity,
    roomCapacity,
    blockers,
    warnings,
  };
}
