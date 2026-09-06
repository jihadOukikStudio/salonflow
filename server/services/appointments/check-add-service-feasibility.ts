import type { CurrentUser } from "@/server/permissions";
import { requirePermission } from "@/server/permissions";

import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { prisma } from "@/server/db/prisma";

import { calculateAppointmentDuration } from "@/server/services/appointments/calculate-appointment-duration";
import {
  getAppointmentEnd,
  intervalsOverlap,
} from "@/server/services/resources/appointment-interval";

import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

type CheckAddServiceFeasibilityInput = {
  appointmentId: string;
  serviceId: string;
};

export type AddServiceFeasibility = {
  canAdd: boolean;
  level: "POSSIBLE" | "WARNING" | "BLOCKED";
  currentDurationMinutes: number;
  newDurationMinutes: number;
  currentEnd: string;
  newEnd: string;
  extraMinutes: number;
  availableEmployees: Array<{ id: string; name: string }>;
  availableRooms: Array<{ id: string; name: string }>;
  requiredRoomType: "HAMAM" | "TREATMENT_ROOM" | null;
  blockers: string[];
  warnings: string[];
};

function fullName(value: { firstName: string; lastName: string | null }) {
  return [value.firstName, value.lastName].filter(Boolean).join(" ");
}

/**
 * Prévisualisation serveur de l'impact d'une prestation supplémentaire.
 *
 * IMPORTANT :
 * - aucune donnée n'est modifiée ;
 * - salonId et permissions viennent de l'utilisateur authentifié ;
 * - les mêmes règles temporelles que les validateurs d'affectation sont utilisées ;
 * - l'ajout réel reste revalidé transactionnellement par addAppointmentService().
 *
 * Cette prévisualisation est une aide à la décision. Elle ne remplace jamais
 * les contrôles transactionnels au moment de l'ajout / de l'affectation.
 */
export async function checkAddServiceFeasibility(
  currentUser: CurrentUser,
  input: CheckAddServiceFeasibilityInput,
): Promise<AddServiceFeasibility> {
  const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);

  requirePermission(authoritativeUser, "appointments:update");

  const salonId = authoritativeUser.salonId;

  const [appointment, catalogService] = await Promise.all([
    prisma.appointment.findFirst({
      where: {
        id: input.appointmentId,
        salonId,
      },
      select: {
        id: true,
        status: true,
        scheduledStart: true,
        estimatedDurationMinutes: true,
        payment: {
          select: {
            status: true,
          },
        },
        services: {
          select: {
            id: true,
            serviceId: true,
            durationMinutes: true,
            assignedEmployeeId: true,
            roomId: true,
            parallelGroupLinks: {
              select: {
                parallelGroupId: true,
              },
            },
          },
        },
      },
    }),
    prisma.service.findFirst({
      where: {
        id: input.serviceId,
        salonId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        defaultDurationMinutes: true,
        requiredRoomType: true,
      },
    }),
  ]);

  if (!appointment) {
    throw new ResourceNotFoundError("Le rendez-vous demandé est introuvable.");
  }

  if (!catalogService) {
    throw new ResourceNotFoundError(
      "La prestation demandée est introuvable ou inactive.",
    );
  }

  const canAddService =
    appointment.status === "PLANNED" ||
    appointment.status === "IN_PROGRESS" ||
    (appointment.status === "COMPLETED" &&
      appointment.payment?.status !== "PAID");

  if (!canAddService) {
    throw new BusinessRuleError(
      appointment.payment?.status === "PAID"
        ? "Il n'est plus possible d'ajouter une prestation après l'encaissement."
        : "Il n'est plus possible d'ajouter une prestation à ce rendez-vous.",
    );
  }

  if (
    appointment.services.some(
      (service) => service.serviceId === catalogService.id,
    )
  ) {
    throw new BusinessRuleError(
      "Cette prestation est déjà présente dans le rendez-vous.",
    );
  }

  const durationMinutes = catalogService.defaultDurationMinutes;

  if (
    durationMinutes === null ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes <= 0
  ) {
    throw new BusinessRuleError(
      "La durée de cette prestation doit être configurée avant de pouvoir vérifier sa faisabilité.",
    );
  }

  const newDurationMinutes = calculateAppointmentDuration([
    ...appointment.services.map((service) => ({
      id: service.id,
      durationMinutes: service.durationMinutes,
      parallelGroupLinks: service.parallelGroupLinks,
    })),
    {
      id: `preview:${catalogService.id}`,
      durationMinutes,
      parallelGroupLinks: [],
    },
  ]);

  const currentEnd = getAppointmentEnd(
    appointment.scheduledStart,
    appointment.estimatedDurationMinutes,
  );
  const newEnd = getAppointmentEnd(
    appointment.scheduledStart,
    newDurationMinutes,
  );

  const interval = {
    startAt: appointment.scheduledStart,
    endAt: newEnd,
  };

  const [employees, rooms] = await Promise.all([
    prisma.employee.findMany({
      where: {
        salonId,
        isActive: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        skills: { select: { serviceId: true } },
      },
    }),
    prisma.room.findMany({
      where: {
        salonId,
        isActive: true,
        ...(catalogService.requiredRoomType
          ? { type: catalogService.requiredRoomType }
          : {}),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        type: true,
      },
    }),
  ]);

  const employeeIds = employees.map((employee) => employee.id);
  const roomIds = rooms.map((room) => room.id);

  const [
    employeeUnavailabilities,
    employeeAppointmentCandidates,
    roomUnavailabilities,
    roomAppointmentCandidates,
  ] = await Promise.all([
    employeeIds.length
      ? prisma.employeeUnavailability.findMany({
          where: {
            employeeId: { in: employeeIds },
            startAt: { lt: newEnd },
            endAt: { gt: appointment.scheduledStart },
          },
          select: {
            employeeId: true,
          },
        })
      : Promise.resolve([]),
    employeeIds.length
      ? prisma.appointment.findMany({
          where: {
            salonId,
            id: { not: appointment.id },
            status: { notIn: ["CANCELLED", "CLOSED"] },
            scheduledStart: { lt: newEnd },
            services: {
              some: {
                assignedEmployeeId: { in: employeeIds },
              },
            },
          },
          select: {
            scheduledStart: true,
            estimatedDurationMinutes: true,
            services: {
              where: {
                assignedEmployeeId: { in: employeeIds },
              },
              select: {
                assignedEmployeeId: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    roomIds.length
      ? prisma.roomUnavailability.findMany({
          where: {
            roomId: { in: roomIds },
            startAt: { lt: newEnd },
            endAt: { gt: appointment.scheduledStart },
          },
          select: {
            roomId: true,
          },
        })
      : Promise.resolve([]),
    roomIds.length
      ? prisma.appointment.findMany({
          where: {
            salonId,
            id: { not: appointment.id },
            status: { notIn: ["CANCELLED", "CLOSED"] },
            scheduledStart: { lt: newEnd },
            services: {
              some: {
                roomId: { in: roomIds },
              },
            },
          },
          select: {
            scheduledStart: true,
            estimatedDurationMinutes: true,
            services: {
              where: {
                roomId: { in: roomIds },
              },
              select: {
                roomId: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const unavailableEmployeeIds = new Set(
    employeeUnavailabilities.map((item) => item.employeeId),
  );

  for (const candidate of employeeAppointmentCandidates) {
    if (
      !intervalsOverlap(interval, {
        startAt: candidate.scheduledStart,
        endAt: getAppointmentEnd(
          candidate.scheduledStart,
          candidate.estimatedDurationMinutes,
        ),
      })
    ) {
      continue;
    }

    for (const service of candidate.services) {
      if (service.assignedEmployeeId) {
        unavailableEmployeeIds.add(service.assignedEmployeeId);
      }
    }
  }

  const unavailableRoomIds = new Set(
    roomUnavailabilities.map((item) => item.roomId),
  );

  for (const candidate of roomAppointmentCandidates) {
    if (
      !intervalsOverlap(interval, {
        startAt: candidate.scheduledStart,
        endAt: getAppointmentEnd(
          candidate.scheduledStart,
          candidate.estimatedDurationMinutes,
        ),
      })
    ) {
      continue;
    }

    for (const service of candidate.services) {
      if (service.roomId) {
        unavailableRoomIds.add(service.roomId);
      }
    }
  }

  const skillsModeEnabled =
    (await prisma.employeeSkill.findFirst({
      where: { employee: { salonId } },
      select: { employeeId: true },
    })) !== null;

  const availableEmployees = employees
    .filter((employee) => {
      if (unavailableEmployeeIds.has(employee.id)) return false;
      if (!skillsModeEnabled) return true;
      return employee.skills.some(
        (skill) => skill.serviceId === catalogService.id,
      );
    })
    .map((employee) => ({
      id: employee.id,
      name: fullName(employee),
    }));

  const availableRooms = catalogService.requiredRoomType
    ? rooms
        .filter((room) => !unavailableRoomIds.has(room.id))
        .map((room) => ({
          id: room.id,
          name: room.name,
        }))
    : [];

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!skillsModeEnabled) {
    warnings.push(
      "Les compétences de l’équipe ne sont pas encore configurées : SalonFlow utilise temporairement le mode généraliste.",
    );
  }

  /*
   * L'ajout rallonge potentiellement tout le rendez-vous.
   * Les ressources déjà affectées doivent donc rester disponibles
   * jusqu'à la nouvelle heure de fin. C'est la même hypothèse
   * conservatrice que les validateurs V1 actuels.
   */
  const assignedEmployeeIds = new Set(
    appointment.services
      .map((service) => service.assignedEmployeeId)
      .filter((value): value is string => value !== null),
  );

  for (const employee of employees) {
    if (
      assignedEmployeeIds.has(employee.id) &&
      unavailableEmployeeIds.has(employee.id)
    ) {
      blockers.push(
        `${fullName(employee)} n'est pas disponible jusqu'à la nouvelle heure de fin.`,
      );
    }
  }

  const assignedRoomIds = new Set(
    appointment.services
      .map((service) => service.roomId)
      .filter((value): value is string => value !== null),
  );

  for (const room of rooms) {
    if (assignedRoomIds.has(room.id) && unavailableRoomIds.has(room.id)) {
      blockers.push(
        `${room.name} n'est pas disponible jusqu'à la nouvelle heure de fin.`,
      );
    }
  }

  if (availableEmployees.length === 0) {
    if (skillsModeEnabled) {
      blockers.push(
        `Aucune employée compétente pour « ${catalogService.name} » n'est disponible sur toute la nouvelle plage du rendez-vous.`,
      );
    } else if (appointment.status !== "PLANNED") {
      blockers.push(
        "Aucune employée n'est disponible sur toute la nouvelle plage du rendez-vous.",
      );
    } else {
      warnings.push(
        "Aucune employée n'est actuellement disponible sur toute la nouvelle plage : la prestation resterait à organiser.",
      );
    }
  }

  if (catalogService.requiredRoomType && availableRooms.length === 0) {
    if (appointment.status !== "PLANNED") {
      blockers.push(
        "Aucune salle compatible n'est disponible sur toute la nouvelle plage du rendez-vous.",
      );
    } else {
      warnings.push(
        "Aucune salle compatible n'est actuellement disponible sur toute la nouvelle plage : la prestation resterait à organiser.",
      );
    }
  }

  if (appointment.status === "PLANNED" && availableEmployees.length > 0) {
    warnings.push(
      "La prestation peut être ajoutée sans employée affectée immédiatement ; l'affectation finale restera contrôlée par le serveur.",
    );
  }

  const canAdd = blockers.length === 0;

  return {
    canAdd,
    level: !canAdd ? "BLOCKED" : warnings.length > 0 ? "WARNING" : "POSSIBLE",
    currentDurationMinutes: appointment.estimatedDurationMinutes,
    newDurationMinutes,
    currentEnd: currentEnd.toISOString(),
    newEnd: newEnd.toISOString(),
    extraMinutes: newDurationMinutes - appointment.estimatedDurationMinutes,
    availableEmployees,
    availableRooms,
    requiredRoomType: catalogService.requiredRoomType,
    blockers,
    warnings,
  };
}
