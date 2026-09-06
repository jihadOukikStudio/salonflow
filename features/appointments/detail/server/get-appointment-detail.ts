import type { CurrentUser } from "@/server/permissions";

import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { prisma } from "@/server/db/prisma";
import {
  getAppointmentEnd,
  intervalsOverlap,
} from "@/server/services/resources/appointment-interval";

export type AppointmentDetail = {
  id: string;
  scheduledStart: string;
  estimatedDurationMinutes: number;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CLOSED" | "CANCELLED";
  internalNote: string | null;
  client: {
    id: string;
    name: string;
    phone: string;
  };
  services: Array<{
    id: string;
    serviceId: string | null;
    name: string;
    durationMinutes: number;
    price: number;
    status: "TODO" | "IN_PROGRESS" | "DONE";
    requiredRoomType: "HAMAM" | "TREATMENT_ROOM" | null;
    assignedEmployee: { id: string; name: string } | null;
    performedByEmployee: { id: string; name: string } | null;
    room: { id: string; name: string; type: "HAMAM" | "TREATMENT_ROOM" } | null;
    actualStartedAt: string | null;
    actualFinishedAt: string | null;
    parallelGroupId: string | null;
  }>;
  parallelGroups: Array<{
    id: string;
    appointmentServiceIds: string[];
  }>;
  history: Array<{
    id: string;
    createdAt: string;
    description: string;
  }>;
  employees: Array<{
    id: string;
    name: string;
    isAvailable: boolean;
    unavailableReason: string | null;
    skillServiceIds: string[];
  }>;
  skillsModeEnabled: boolean;
  rooms: Array<{ id: string; name: string; type: "HAMAM" | "TREATMENT_ROOM" }>;
  catalogServices: Array<{
    id: string;
    name: string;
    categoryName: string;
    defaultDurationMinutes: number | null;
    defaultPrice: number;
  }>;
  payment: {
    status: "PENDING" | "PAID";
    amount: number;
    paidAt: string | null;
  } | null;
  catalogTotal: number;
  currentEmployeeId: string | null;
  canManageAppointment: boolean;
  canRecordPayment: boolean;
};

function fullName(value: {
  firstName: string;
  lastName: string | null;
}): string {
  return [value.firstName, value.lastName].filter(Boolean).join(" ");
}

export async function getAppointmentDetail(
  currentUser: CurrentUser,
  appointmentId: string,
): Promise<AppointmentDetail | null> {
  const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);
  const salonId = authoritativeUser.salonId;

  const [appointment, rooms, catalogServices, currentEmployee] =
    await Promise.all([
      prisma.appointment.findFirst({
        where: { id: appointmentId, salonId },
        select: {
          id: true,
          scheduledStart: true,
          estimatedDurationMinutes: true,
          status: true,
          internalNote: true,
          client: { select: { id: true, name: true, phone: true } },
          payment: {
            select: { status: true, amount: true, paidAt: true },
          },
          services: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              serviceId: true,
              serviceNameSnapshot: true,
              durationMinutes: true,
              price: true,
              status: true,
              requiredRoomTypeSnapshot: true,
              actualStartedAt: true,
              actualFinishedAt: true,
              assignedEmployee: {
                select: { id: true, firstName: true, lastName: true },
              },
              performedByEmployee: {
                select: { id: true, firstName: true, lastName: true },
              },
              room: { select: { id: true, name: true, type: true } },
              parallelGroupLinks: {
                select: { parallelGroupId: true },
              },
            },
          },
          parallelGroups: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              services: {
                select: {
                  appointmentServiceId: true,
                },
              },
            },
          },
        },
      }),
      prisma.room.findMany({
        where: { salonId, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, type: true },
      }),
      prisma.service.findMany({
        where: { salonId, isActive: true },
        orderBy: [{ category: { displayOrder: "asc" } }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          defaultDurationMinutes: true,
          defaultPrice: true,
          category: { select: { name: true } },
        },
      }),
      prisma.employee.findFirst({
        where: { salonId, userId: authoritativeUser.id, isActive: true },
        select: { id: true },
      }),
    ]);

  if (!appointment) return null;

  const appointmentEnd = getAppointmentEnd(
    appointment.scheduledStart,
    appointment.estimatedDurationMinutes,
  );

  const employees = await prisma.employee.findMany({
    where: { salonId, isActive: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      skills: { select: { serviceId: true } },
    },
  });

  const skillsModeEnabled =
    (await prisma.employeeSkill.findFirst({
      where: { employee: { salonId } },
      select: { employeeId: true },
    })) !== null;

  const trackedEntityIds = [
    appointment.id,
    ...appointment.services.map((service) => service.id),
    ...appointment.parallelGroups.map((group) => group.id),
  ];

  const activityLogs = await prisma.activityLog.findMany({
    where: {
      salonId,
      entityId: { in: trackedEntityIds },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      action: true,
      entityId: true,
      metadata: true,
      createdAt: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  const serviceNameById = new Map(
    appointment.services.map((service) => [
      service.id,
      service.serviceNameSnapshot,
    ]),
  );

  function historyDescription(log: (typeof activityLogs)[number]) {
    const actor = fullName(log.user);
    const serviceName = serviceNameById.get(log.entityId);
    const target = serviceName ? ` « ${serviceName} »` : "";

    switch (log.action) {
      case "APPOINTMENT_SERVICE_ASSIGNED":
        return `${actor} a affecté une employée à${target}.`;
      case "APPOINTMENT_SERVICE_REASSIGNED":
        return `${actor} a réaffecté${target}.`;
      case "APPOINTMENT_SERVICE_ROOM_ASSIGNED":
        return `${actor} a affecté une salle à${target}.`;
      case "APPOINTMENT_SERVICE_ROOM_REASSIGNED":
        return `${actor} a changé la salle de${target}.`;
      case "APPOINTMENT_SERVICE_STARTED":
        return `${actor} a démarré${target}.`;
      case "APPOINTMENT_SERVICE_COMPLETED":
        return `${actor} a terminé${target}.`;
      case "APPOINTMENT_SERVICE_ADDED":
        return `${actor} a ajouté une prestation au rendez-vous.`;
      case "APPOINTMENT_SERVICE_REMOVED":
        return `${actor} a retiré une prestation du rendez-vous.`;
      case "APPOINTMENT_PAYMENT_RECORDED": {
        const metadata =
          log.metadata && typeof log.metadata === "object"
            ? (log.metadata as Record<string, unknown>)
            : null;
        const amount = metadata?.amount;
        return `${actor} a encaissé${
          typeof amount === "string" || typeof amount === "number"
            ? ` ${amount} MAD`
            : ""
        }.`;
      }
      case "PARALLEL_GROUP_CREATED":
        return `${actor} a configuré des prestations en parallèle.`;
      case "PARALLEL_GROUP_REMOVED":
        return `${actor} a supprimé un parallélisme.`;
      case "APPOINTMENT_CLOSED":
        return `${actor} a clôturé le rendez-vous.`;
      case "APPOINTMENT_CANCELLED":
        return `${actor} a annulé le rendez-vous.`;
      default:
        return null;
    }
  }

  const history = activityLogs
    .map((log) => {
      const description = historyDescription(log);
      return description
        ? {
            id: log.id,
            createdAt: log.createdAt.toISOString(),
            description,
          }
        : null;
    })
    .filter(
      (item): item is { id: string; createdAt: string; description: string } =>
        item !== null,
    );

  const employeeIds = employees.map((employee) => employee.id);

  const [unavailabilities, conflictingAppointments] = employeeIds.length
    ? await Promise.all([
        prisma.employeeUnavailability.findMany({
          where: {
            employeeId: { in: employeeIds },
            startAt: { lt: appointmentEnd },
            endAt: { gt: appointment.scheduledStart },
          },
          select: { employeeId: true },
        }),
        prisma.appointment.findMany({
          where: {
            salonId,
            id: { not: appointment.id },
            status: { notIn: ["CANCELLED", "CLOSED"] },
            scheduledStart: { lt: appointmentEnd },
            services: {
              some: {
                assignedEmployeeId: { in: employeeIds },
              },
            },
          },
          select: {
            id: true,
            scheduledStart: true,
            estimatedDurationMinutes: true,
            services: {
              where: {
                assignedEmployeeId: { in: employeeIds },
              },
              select: { assignedEmployeeId: true },
            },
          },
        }),
      ])
    : [[], []];

  const unavailableByUnavailability = new Set(
    unavailabilities.map((item) => item.employeeId),
  );

  const unavailableByAppointment = new Set<string>();

  for (const conflictingAppointment of conflictingAppointments) {
    const overlaps = intervalsOverlap(
      {
        startAt: appointment.scheduledStart,
        endAt: appointmentEnd,
      },
      {
        startAt: conflictingAppointment.scheduledStart,
        endAt: getAppointmentEnd(
          conflictingAppointment.scheduledStart,
          conflictingAppointment.estimatedDurationMinutes,
        ),
      },
    );

    if (!overlaps) continue;

    for (const service of conflictingAppointment.services) {
      if (service.assignedEmployeeId) {
        unavailableByAppointment.add(service.assignedEmployeeId);
      }
    }
  }

  const services = appointment.services.map((service) => ({
    id: service.id,
    serviceId: service.serviceId,
    name: service.serviceNameSnapshot,
    durationMinutes: service.durationMinutes,
    price: Number(service.price),
    status: service.status,
    requiredRoomType: service.requiredRoomTypeSnapshot,
    assignedEmployee: service.assignedEmployee
      ? {
          id: service.assignedEmployee.id,
          name: fullName(service.assignedEmployee),
        }
      : null,
    performedByEmployee: service.performedByEmployee
      ? {
          id: service.performedByEmployee.id,
          name: fullName(service.performedByEmployee),
        }
      : null,
    room: service.room,
    actualStartedAt: service.actualStartedAt?.toISOString() ?? null,
    actualFinishedAt: service.actualFinishedAt?.toISOString() ?? null,
    parallelGroupId: service.parallelGroupLinks[0]?.parallelGroupId ?? null,
  }));

  const canManageAppointment =
    authoritativeUser.role === "ADMIN" || authoritativeUser.canManageSalon;

  return {
    id: appointment.id,
    scheduledStart: appointment.scheduledStart.toISOString(),
    estimatedDurationMinutes: appointment.estimatedDurationMinutes,
    status: appointment.status,
    internalNote: appointment.internalNote,
    client: {
      id: appointment.client.id,
      name: appointment.client.name?.trim() || "Cliente sans nom",
      phone: appointment.client.phone,
    },
    services,
    parallelGroups: appointment.parallelGroups.map((group) => ({
      id: group.id,
      appointmentServiceIds: group.services.map(
        (service) => service.appointmentServiceId,
      ),
    })),
    history,
    employees: employees.map((employee) => {
      const hasUnavailability = unavailableByUnavailability.has(employee.id);
      const hasAppointmentConflict = unavailableByAppointment.has(employee.id);

      return {
        id: employee.id,
        name: fullName(employee),
        isAvailable: !hasUnavailability && !hasAppointmentConflict,
        unavailableReason: hasUnavailability
          ? "Indisponible sur ce créneau"
          : hasAppointmentConflict
            ? "Déjà affectée à un autre rendez-vous"
            : null,
        skillServiceIds: employee.skills.map((skill) => skill.serviceId),
      };
    }),
    skillsModeEnabled,
    rooms,
    catalogServices: catalogServices.map((service) => ({
      id: service.id,
      name: service.name,
      categoryName: service.category.name,
      defaultDurationMinutes: service.defaultDurationMinutes,
      defaultPrice: Number(service.defaultPrice),
    })),
    payment: appointment.payment
      ? {
          status: appointment.payment.status,
          amount: Number(appointment.payment.amount),
          paidAt: appointment.payment.paidAt?.toISOString() ?? null,
        }
      : null,
    catalogTotal: services.reduce((total, service) => total + service.price, 0),
    currentEmployeeId: currentEmployee?.id ?? null,
    canManageAppointment,
    canRecordPayment: canManageAppointment,
  };
}
