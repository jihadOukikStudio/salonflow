import type { CurrentUser } from "@/server/permissions";
import { requirePermission } from "@/server/permissions";

import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";

import { prisma } from "@/server/db/prisma";
import { lockResources } from "@/server/db/resource-lock";

import {
  appointmentLockKey,
  appointmentServiceLockKey,
  employeeLockKey,
  roomLockKey,
} from "@/server/services/resources/resource-lock-keys";
import {
  getAppointmentEnd,
  intervalsOverlap,
} from "@/server/services/resources/appointment-interval";
import { validateEmployeeAvailability } from "@/server/services/resources/validate-employee-availability";
import { assertEmployeeCanPerformServiceInDb } from "@/server/services/employees/skill-policy";
import { validateRoomAvailability } from "@/server/services/resources/validate-room-availability";

import { calculateAppointmentDuration } from "@/server/services/appointments/calculate-appointment-duration";
import { checkEmployeeCapacityInDb } from "@/server/services/appointments/check-employee-capacity";

import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

type AddAppointmentServiceInput = {
  appointmentId: string;
  serviceId: string;
  durationMinutes?: number;
  price?: number;
  employeeId?: string;
  roomId?: string;
};

export async function addAppointmentService(
  currentUser: CurrentUser,
  input: AddAppointmentServiceInput,
) {
  const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);

  requirePermission(authoritativeUser, "appointments:update");

  const salonId = authoritativeUser.salonId;

  return prisma.$transaction(async (tx) => {
    /*
     * Première lecture pour déterminer toutes les ressources
     * devant être verrouillées.
     *
     * Pour la barrière finale de capacité, on verrouille aussi toutes les
     * employées/salles actives du salon. Le salon V1 ne contient que quelques
     * ressources et ce verrouillage conservateur évite qu'une affectation ou
     * une indisponibilité concurrente invalide le contrôle juste avant l'écriture.
     */
    const [initialAppointment, activeEmployees, activeRooms] =
      await Promise.all([
        tx.appointment.findFirst({
          where: {
            id: input.appointmentId,
            salonId,
          },

          select: {
            id: true,

            services: {
              select: {
                id: true,
                assignedEmployeeId: true,
                roomId: true,
              },
            },
          },
        }),

        tx.employee.findMany({
          where: {
            salonId,
            isActive: true,
          },
          select: {
            id: true,
          },
        }),

        tx.room.findMany({
          where: {
            salonId,
            isActive: true,
          },
          select: {
            id: true,
          },
        }),
      ]);

    if (!initialAppointment) {
      throw new ResourceNotFoundError(
        "Le rendez-vous demandé est introuvable.",
      );
    }

    /*
     * Verrouillage déterministe :
     * - barrière globale de capacité du salon, identique à la création ;
     * - rendez-vous ;
     * - prestations ;
     * - toutes les employées actives ;
     * - toutes les salles actives.
     *
     * L'ajout peut modifier la durée du rendez-vous et donc consommer
     * de la capacité supplémentaire.
     */
    await lockResources(tx, [
      `booking-capacity:${salonId}`,

      appointmentLockKey(salonId, initialAppointment.id),

      ...initialAppointment.services.map((service) =>
        appointmentServiceLockKey(salonId, service.id),
      ),

      ...activeEmployees.map((employee) =>
        employeeLockKey(salonId, employee.id),
      ),

      ...activeRooms.map((room) => roomLockKey(salonId, room.id)),
    ]);

    /*
     * Toujours relire après acquisition des verrous.
     */
    const appointment = await tx.appointment.findFirst({
      where: {
        id: initialAppointment.id,
        salonId,
      },

      include: {
        payment: {
          select: {
            status: true,
          },
        },

        services: {
          select: {
            id: true,
            serviceId: true,
            serviceNameSnapshot: true,
            durationMinutes: true,
            assignedEmployeeId: true,
            roomId: true,
            requiredRoomTypeSnapshot: true,

            parallelGroupLinks: {
              select: {
                parallelGroupId: true,
              },
            },
          },
        },
      },
    });

    if (!appointment) {
      throw new ResourceNotFoundError(
        "Le rendez-vous demandé est introuvable.",
      );
    }

    /*
     * Une cliente peut demander une prestation supplémentaire :
     * - avant le rendez-vous ;
     * - pendant le rendez-vous ;
     * - juste après la dernière prestation si le RDV est COMPLETED
     *   mais n'a pas encore été encaissé.
     *
     * Un COMPLETED non payé est alors rouvert en IN_PROGRESS.
     * Après paiement, clôture ou annulation, la structure reste figée.
     */
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

    /*
     * V1 : pas deux occurrences du même service catalogue
     * dans le même rendez-vous.
     */
    const alreadyExists = appointment.services.some(
      (appointmentService) => appointmentService.serviceId === input.serviceId,
    );

    if (alreadyExists) {
      throw new BusinessRuleError(
        "Cette prestation est déjà présente dans le rendez-vous.",
      );
    }

    /*
     * Récupération du catalogue en imposant le salon
     * provenant de la session.
     */
    const service = await tx.service.findFirst({
      where: {
        id: input.serviceId,
        salonId,
        isActive: true,
      },

      select: {
        id: true,
        name: true,
        defaultDurationMinutes: true,
        defaultPrice: true,
        requiredRoomType: true,
      },
    });

    if (!service) {
      throw new ResourceNotFoundError(
        "La prestation demandée est introuvable ou inactive.",
      );
    }

    /*
     * Snapshot durée.
     *
     * Certaines prestations catalogue peuvent ne pas avoir
     * de durée standard. Dans ce cas un override est obligatoire.
     */
    const durationMinutes =
      input.durationMinutes ?? service.defaultDurationMinutes;

    if (
      durationMinutes === null ||
      durationMinutes === undefined ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes <= 0
    ) {
      throw new BusinessRuleError(
        "Une durée valide doit être renseignée pour cette prestation.",
      );
    }

    /*
     * Snapshot prix.
     */
    const price = input.price ?? service.defaultPrice.toNumber();

    if (!Number.isFinite(price) || price < 0) {
      throw new BusinessRuleError("Le prix de la prestation est invalide.");
    }

    /*
     * Ressources choisies lors de l'ajout.
     *
     * Elles sont validées dans la même transaction que la création de la
     * prestation afin de conserver l'atomicité Phase 11.3.
     */
    if (input.employeeId) {
      const selectedEmployee = await tx.employee.findFirst({
        where: {
          id: input.employeeId,
          salonId,
          isActive: true,
        },
        select: { id: true },
      });

      if (!selectedEmployee) {
        throw new ResourceNotFoundError(
          "L'employée demandée est introuvable ou inactive.",
        );
      }

      await assertEmployeeCanPerformServiceInDb(tx, {
        salonId,
        employeeId: selectedEmployee.id,
        serviceId: service.id,
        serviceName: service.name,
      });
    }

    if (input.roomId) {
      const selectedRoom = await tx.room.findFirst({
        where: {
          id: input.roomId,
          salonId,
          isActive: true,
        },
        select: {
          id: true,
          type: true,
        },
      });

      if (!selectedRoom) {
        throw new ResourceNotFoundError(
          "La salle demandée est introuvable ou inactive.",
        );
      }

      if (
        service.requiredRoomType !== null &&
        selectedRoom.type !== service.requiredRoomType
      ) {
        throw new BusinessRuleError(
          service.requiredRoomType === "HAMAM"
            ? "Cette prestation nécessite un Hamam."
            : "Cette prestation nécessite une salle de soins.",
        );
      }

      if (service.requiredRoomType === null) {
        throw new BusinessRuleError(
          "Cette prestation ne nécessite pas de salle.",
        );
      }
    }

    /*
     * Recalcul centralisé.
     *
     * On conserve les éventuels groupes parallèles existants.
     * La nouvelle prestation n'appartient encore à aucun groupe.
     */
    const newEstimatedDurationMinutes = calculateAppointmentDuration([
      ...appointment.services.map((appointmentService) => ({
        id: appointmentService.id,

        durationMinutes: appointmentService.durationMinutes,

        parallelGroupLinks: appointmentService.parallelGroupLinks,
      })),

      {
        id: `new:${service.id}`,
        durationMinutes,
        parallelGroupLinks: [],
      },
    ]);

    if (newEstimatedDurationMinutes <= 0) {
      throw new BusinessRuleError(
        "La durée calculée du rendez-vous est invalide.",
      );
    }

    const employeeCapacity = await checkEmployeeCapacityInDb(tx, {
      salonId,
      scheduledStart: appointment.scheduledStart,
      estimatedDurationMinutes: newEstimatedDurationMinutes,
      excludeAppointmentId: appointment.id,
      services: [
        ...appointment.services.map((appointmentService) => ({
          serviceId: appointmentService.serviceId,
          serviceName: appointmentService.serviceNameSnapshot,
          assignedEmployeeId: appointmentService.assignedEmployeeId,
          parallelGroupIds: appointmentService.parallelGroupLinks.map(
            (link) => link.parallelGroupId,
          ),
        })),
        {
          serviceId: service.id,
          serviceName: service.name,
          assignedEmployeeId: input.employeeId ?? null,
          parallelGroupIds: [],
        },
      ],
    });

    if (!employeeCapacity.feasible) {
      throw new BusinessRuleError(
        employeeCapacity.blockers[0] ??
          "Aucune capacité d'employée compétente ne reste disponible sur cette plage.",
      );
    }

    const employeeIds = [
      ...new Set(
        [
          ...appointment.services.map(
            (appointmentService) => appointmentService.assignedEmployeeId,
          ),
          input.employeeId ?? null,
        ].filter((employeeId): employeeId is string => employeeId !== null),
      ),
    ];

    const roomIds = [
      ...new Set(
        [
          ...appointment.services.map(
            (appointmentService) => appointmentService.roomId,
          ),
          input.roomId ?? null,
        ].filter((roomId): roomId is string => roomId !== null),
      ),
    ];

    /*
     * L'ajout peut rallonger le rendez-vous.
     * Les helpers centraux revalident donc toutes les ressources
     * déjà affectées sur la nouvelle durée.
     */
    for (const employeeId of employeeIds) {
      await validateEmployeeAvailability(tx, {
        salonId,
        employeeId,
        scheduledStart: appointment.scheduledStart,
        estimatedDurationMinutes: newEstimatedDurationMinutes,
        excludeAppointmentId: appointment.id,
      });
    }

    for (const roomId of roomIds) {
      await validateRoomAvailability(tx, {
        salonId,
        roomId,
        scheduledStart: appointment.scheduledStart,
        estimatedDurationMinutes: newEstimatedDurationMinutes,
        excludeAppointmentId: appointment.id,
      });
    }

    /*
     * Barrière finale de capacité employées.
     *
     * Un simple contrôle des affectations existantes ne suffit pas :
     * un RDV non affecté consomme lui aussi une capacité dans le modèle
     * conservateur V1. On compte donc :
     * - les employées actives ;
     * - les indisponibilités ;
     * - les employées déjà affectées à d'autres RDV qui chevauchent ;
     * - les autres RDV chevauchants sans aucune employée affectée.
     *
     * Le rendez-vous courant est exclu, puisqu'on cherche à vérifier
     * qu'il peut conserver au moins une capacité sur sa nouvelle plage.
     */
    const newAppointmentEnd = getAppointmentEnd(
      appointment.scheduledStart,
      newEstimatedDurationMinutes,
    );

    const interval = {
      startAt: appointment.scheduledStart,
      endAt: newAppointmentEnd,
    };

    const currentActiveEmployees = await tx.employee.findMany({
      where: {
        salonId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (currentActiveEmployees.length === 0) {
      throw new BusinessRuleError(
        "Aucune employée active n'est configurée dans le salon.",
      );
    }

    const activeEmployeeIds = currentActiveEmployees.map(
      (employee) => employee.id,
    );

    const [employeeUnavailabilities, overlappingAppointments] =
      await Promise.all([
        tx.employeeUnavailability.findMany({
          where: {
            employeeId: {
              in: activeEmployeeIds,
            },
            startAt: {
              lt: newAppointmentEnd,
            },
            endAt: {
              gt: appointment.scheduledStart,
            },
          },
          select: {
            employeeId: true,
          },
        }),

        tx.appointment.findMany({
          where: {
            salonId,
            id: {
              not: appointment.id,
            },
            status: {
              notIn: ["CANCELLED", "CLOSED"],
            },
            scheduledStart: {
              lt: newAppointmentEnd,
            },
          },
          select: {
            scheduledStart: true,
            estimatedDurationMinutes: true,
            services: {
              select: {
                assignedEmployeeId: true,
              },
            },
          },
        }),
      ]);

    const unavailableEmployeeIds = new Set(
      employeeUnavailabilities.map((item) => item.employeeId),
    );

    const busyEmployeeIds = new Set<string>();
    let unassignedAppointmentDemand = 0;

    for (const candidate of overlappingAppointments) {
      const candidateInterval = {
        startAt: candidate.scheduledStart,
        endAt: getAppointmentEnd(
          candidate.scheduledStart,
          candidate.estimatedDurationMinutes,
        ),
      };

      if (!intervalsOverlap(interval, candidateInterval)) {
        continue;
      }

      const assignedIds = [
        ...new Set(
          candidate.services
            .map((candidateService) => candidateService.assignedEmployeeId)
            .filter(
              (employeeId): employeeId is string =>
                employeeId !== null && activeEmployeeIds.includes(employeeId),
            ),
        ),
      ];

      if (assignedIds.length === 0) {
        unassignedAppointmentDemand += 1;
        continue;
      }

      for (const assignedId of assignedIds) {
        busyEmployeeIds.add(assignedId);
      }
    }

    const physicallyAvailableEmployeeCount = currentActiveEmployees.filter(
      (employee) =>
        !unavailableEmployeeIds.has(employee.id) &&
        !busyEmployeeIds.has(employee.id),
    ).length;

    const remainingEmployeeCapacity =
      physicallyAvailableEmployeeCount - unassignedAppointmentDemand;

    if (remainingEmployeeCapacity < 1) {
      throw new BusinessRuleError(
        "Aucune capacité employée ne reste disponible sur toute la nouvelle plage du rendez-vous.",
      );
    }

    /*
     * Barrière finale de capacité salles.
     *
     * Chaque type de salle requis par le rendez-vous (y compris la nouvelle
     * prestation) doit garder au moins une capacité compatible sur toute la
     * nouvelle plage. Comme pour les employées, un autre RDV ayant un besoin
     * de salle mais aucune salle encore affectée consomme une capacité
     * conservatrice.
     */
    const requiredRoomTypes = [
      ...new Set(
        [
          ...appointment.services.map(
            (appointmentService) => appointmentService.requiredRoomTypeSnapshot,
          ),
          service.requiredRoomType,
        ].filter(
          (roomType): roomType is "HAMAM" | "TREATMENT_ROOM" =>
            roomType !== null,
        ),
      ),
    ];

    for (const requiredRoomType of requiredRoomTypes) {
      const compatibleRooms = await tx.room.findMany({
        where: {
          salonId,
          isActive: true,
          type: requiredRoomType,
        },
        select: {
          id: true,
        },
      });

      if (compatibleRooms.length === 0) {
        throw new BusinessRuleError(
          requiredRoomType === "HAMAM"
            ? "Aucun Hamam actif compatible n'est configuré dans le salon."
            : "Aucune salle de soins active compatible n'est configurée dans le salon.",
        );
      }

      const compatibleRoomIds = compatibleRooms.map((room) => room.id);

      const [roomUnavailabilities, roomCandidates] = await Promise.all([
        tx.roomUnavailability.findMany({
          where: {
            roomId: {
              in: compatibleRoomIds,
            },
            startAt: {
              lt: newAppointmentEnd,
            },
            endAt: {
              gt: appointment.scheduledStart,
            },
          },
          select: {
            roomId: true,
          },
        }),

        tx.appointment.findMany({
          where: {
            salonId,
            id: {
              not: appointment.id,
            },
            status: {
              notIn: ["CANCELLED", "CLOSED"],
            },
            scheduledStart: {
              lt: newAppointmentEnd,
            },
            services: {
              some: {
                requiredRoomTypeSnapshot: requiredRoomType,
              },
            },
          },
          select: {
            scheduledStart: true,
            estimatedDurationMinutes: true,
            services: {
              where: {
                requiredRoomTypeSnapshot: requiredRoomType,
              },
              select: {
                roomId: true,
              },
            },
          },
        }),
      ]);

      const unavailableRoomIds = new Set(
        roomUnavailabilities.map((item) => item.roomId),
      );

      const busyRoomIds = new Set<string>();
      let unassignedRoomDemand = 0;

      for (const candidate of roomCandidates) {
        const candidateInterval = {
          startAt: candidate.scheduledStart,
          endAt: getAppointmentEnd(
            candidate.scheduledStart,
            candidate.estimatedDurationMinutes,
          ),
        };

        if (!intervalsOverlap(interval, candidateInterval)) {
          continue;
        }

        const assignedIds = [
          ...new Set(
            candidate.services
              .map((candidateService) => candidateService.roomId)
              .filter(
                (roomId): roomId is string =>
                  roomId !== null && compatibleRoomIds.includes(roomId),
              ),
          ),
        ];

        if (assignedIds.length === 0) {
          unassignedRoomDemand += 1;
          continue;
        }

        for (const assignedId of assignedIds) {
          busyRoomIds.add(assignedId);
        }
      }

      const physicallyAvailableRoomCount = compatibleRooms.filter(
        (room) => !unavailableRoomIds.has(room.id) && !busyRoomIds.has(room.id),
      ).length;

      const remainingRoomCapacity =
        physicallyAvailableRoomCount - unassignedRoomDemand;

      if (remainingRoomCapacity < 1) {
        throw new BusinessRuleError(
          requiredRoomType === "HAMAM"
            ? "Aucune capacité Hamam ne reste disponible sur toute la nouvelle plage du rendez-vous."
            : "Aucune capacité de salle de soins ne reste disponible sur toute la nouvelle plage du rendez-vous.",
        );
      }
    }

    /*
     * Création du snapshot AppointmentService seulement après
     * toutes les barrières finales. En cas d'échec ci-dessus,
     * aucune écriture métier n'a encore eu lieu.
     */
    const appointmentService = await tx.appointmentService.create({
      data: {
        appointmentId: appointment.id,

        serviceId: service.id,

        serviceNameSnapshot: service.name,

        durationMinutes,
        price,

        requiredRoomTypeSnapshot: service.requiredRoomType,

        assignedEmployeeId: input.employeeId ?? null,
        roomId: input.roomId ?? null,

        status: "TODO",
      },
    });

    /*
     * Mise à jour de la durée globale.
     */
    await tx.appointment.update({
      where: {
        id: appointment.id,
      },

      data: {
        estimatedDurationMinutes: newEstimatedDurationMinutes,
        ...(appointment.status === "COMPLETED"
          ? { status: "IN_PROGRESS" as const }
          : {}),
      },
    });

    /*
     * Traçabilité.
     */
    await tx.activityLog.create({
      data: {
        salonId,
        userId: authoritativeUser.id,

        action: "APPOINTMENT_SERVICE_ADDED",

        entityType: "APPOINTMENT_SERVICE",

        entityId: appointmentService.id,

        metadata: {
          appointmentId: appointment.id,

          serviceId: service.id,

          serviceName: service.name,

          employeeId: input.employeeId ?? null,
          roomId: input.roomId ?? null,

          durationMinutes,

          price: price.toString(),

          estimatedDurationMinutes: newEstimatedDurationMinutes,
          reopenedFromCompleted: appointment.status === "COMPLETED",
        },
      },
    });

    /*
     * Si les ressources ont été choisies au moment de l'ajout, on garde
     * également les événements métier dédiés. Cela préserve la traçabilité
     * historique utilisée par l'écran de détail et par les réaffectations.
     *
     * Ces logs font partie de la même transaction : en cas d'échec, aucun
     * ajout / aucune affectation / aucun log partiel ne subsiste.
     */
    if (input.employeeId) {
      await tx.activityLog.create({
        data: {
          salonId,
          userId: authoritativeUser.id,

          action: "APPOINTMENT_SERVICE_ASSIGNED",

          entityType: "APPOINTMENT_SERVICE",
          entityId: appointmentService.id,

          metadata: {
            appointmentId: appointment.id,
            appointmentServiceId: appointmentService.id,
            serviceName: service.name,
            employeeId: input.employeeId,
          },
        },
      });
    }

    if (input.roomId) {
      await tx.activityLog.create({
        data: {
          salonId,
          userId: authoritativeUser.id,

          action: "APPOINTMENT_SERVICE_ROOM_ASSIGNED",

          entityType: "APPOINTMENT_SERVICE",
          entityId: appointmentService.id,

          metadata: {
            appointmentId: appointment.id,
            appointmentServiceId: appointmentService.id,
            serviceName: service.name,
            roomId: input.roomId,
          },
        },
      });
    }

    const result = await tx.appointment.findFirst({
      where: {
        id: appointment.id,
        salonId,
      },

      include: {
        services: true,
        payment: true,
      },
    });

    if (!result) {
      throw new ResourceNotFoundError(
        "Le rendez-vous modifié est introuvable.",
      );
    }

    return result;
  });
}
