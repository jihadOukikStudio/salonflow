import { prisma } from "@/server/db/prisma";
import type { CurrentUser } from "@/server/permissions";

import {
  getCasablancaDayRange,
  parsePlanningDate,
} from "@/features/planning/server/casablanca-day";

export type PlanningServiceStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type PlanningAppointmentStatus =
  "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CLOSED";

export type PlanningServiceItem = {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  status: PlanningServiceStatus;
  assignedEmployee: {
    id: string;
    name: string;
  } | null;
  room: {
    id: string;
    name: string;
    type: "HAMAM" | "TREATMENT_ROOM";
  } | null;
  requiredRoomType: "HAMAM" | "TREATMENT_ROOM" | null;
  needsOrganization: boolean;
};

export type PlanningAppointmentItem = {
  id: string;
  scheduledStart: string;
  scheduledEnd: string;
  estimatedDurationMinutes: number;
  status: PlanningAppointmentStatus;
  client: {
    id: string;
    name: string;
    phone: string;
  };
  services: PlanningServiceItem[];
  totalAmount: number;
  organizationIssues: number;
};

export type PlanningEmployeeItem = {
  id: string;
  name: string;
  unavailabilities: Array<{
    id: string;
    type: "ABSENCE" | "BREAK" | "LEAVE" | "UNAVAILABLE";
    startAt: string;
    endAt: string;
    note: string | null;
  }>;
};

export type PlanningRoomItem = {
  id: string;
  name: string;
  type: "HAMAM" | "TREATMENT_ROOM";
  capacity: number;
  unavailabilities: Array<{
    id: string;
    startAt: string;
    endAt: string;
    reason: string | null;
  }>;
};

export type PlanningDay = {
  dateKey: string;
  appointmentCount: number;
  organizationIssues: number;
  inProgressCount: number;
  completedCount: number;
  appointments: PlanningAppointmentItem[];
  employees: PlanningEmployeeItem[];
  rooms: PlanningRoomItem[];
};

function employeeName(employee: {
  firstName: string;
  lastName: string | null;
}): string {
  return [employee.firstName, employee.lastName].filter(Boolean).join(" ");
}

export async function getPlanningDay(
  currentUser: CurrentUser,
  requestedDate?: string,
): Promise<PlanningDay> {
  const dateKey = parsePlanningDate(requestedDate);
  const range = getCasablancaDayRange(dateKey);

  const [appointments, employees, rooms] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        salonId: currentUser.salonId,
        scheduledStart: {
          gte: range.start,
          lt: range.end,
        },
        status: {
          not: "CANCELLED",
        },
      },
      orderBy: [{ scheduledStart: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        scheduledStart: true,
        estimatedDurationMinutes: true,
        status: true,
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        services: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            serviceNameSnapshot: true,
            durationMinutes: true,
            price: true,
            status: true,
            requiredRoomTypeSnapshot: true,
            assignedEmployee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            room: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
      },
    }),
    prisma.employee.findMany({
      where: {
        salonId: currentUser.salonId,
        isActive: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        unavailabilities: {
          where: {
            startAt: { lt: range.end },
            endAt: { gt: range.start },
          },
          orderBy: { startAt: "asc" },
          select: {
            id: true,
            type: true,
            startAt: true,
            endAt: true,
            note: true,
          },
        },
      },
    }),
    prisma.room.findMany({
      where: {
        salonId: currentUser.salonId,
        isActive: true,
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        capacity: true,
        unavailabilities: {
          where: {
            startAt: { lt: range.end },
            endAt: { gt: range.start },
          },
          orderBy: { startAt: "asc" },
          select: {
            id: true,
            startAt: true,
            endAt: true,
            reason: true,
          },
        },
      },
    }),
  ]);

  const mappedAppointments = appointments.map(
    (appointment): PlanningAppointmentItem => {
      // Prisma ne réduit pas automatiquement le type après `not: CANCELLED`.
      // Ce garde-fou conserve le contrat du Planning et évite tout cast forcé.
      if (appointment.status === "CANCELLED") {
        throw new Error(
          "Un rendez-vous annulé ne doit pas apparaître dans le planning.",
        );
      }

      const services = appointment.services.map(
        (service): PlanningServiceItem => {
          const needsEmployee = service.assignedEmployee === null;
          const needsRoom =
            service.requiredRoomTypeSnapshot !== null && service.room === null;

          return {
            id: service.id,
            name: service.serviceNameSnapshot,
            durationMinutes: service.durationMinutes,
            price: Number(service.price),
            status: service.status,
            assignedEmployee: service.assignedEmployee
              ? {
                  id: service.assignedEmployee.id,
                  name: employeeName(service.assignedEmployee),
                }
              : null,
            room: service.room
              ? {
                  id: service.room.id,
                  name: service.room.name,
                  type: service.room.type,
                }
              : null,
            requiredRoomType: service.requiredRoomTypeSnapshot,
            needsOrganization: needsEmployee || needsRoom,
          };
        },
      );

      const totalAmount = services.reduce(
        (total, service) => total + service.price,
        0,
      );
      const organizationIssues = services.filter(
        (service) => service.needsOrganization,
      ).length;
      const scheduledEnd = new Date(
        appointment.scheduledStart.getTime() +
          appointment.estimatedDurationMinutes * 60_000,
      );

      return {
        id: appointment.id,
        scheduledStart: appointment.scheduledStart.toISOString(),
        scheduledEnd: scheduledEnd.toISOString(),
        estimatedDurationMinutes: appointment.estimatedDurationMinutes,
        status: appointment.status,
        client: {
          id: appointment.client.id,
          name: appointment.client.name?.trim() || "Cliente sans nom",
          phone: appointment.client.phone,
        },
        services,
        totalAmount,
        organizationIssues,
      };
    },
  );

  return {
    dateKey,
    appointmentCount: mappedAppointments.length,
    organizationIssues: mappedAppointments.reduce(
      (total, appointment) => total + appointment.organizationIssues,
      0,
    ),
    inProgressCount: mappedAppointments.filter(
      (appointment) => appointment.status === "IN_PROGRESS",
    ).length,
    completedCount: mappedAppointments.filter(
      (appointment) =>
        appointment.status === "COMPLETED" || appointment.status === "CLOSED",
    ).length,
    appointments: mappedAppointments,
    employees: employees.map((employee) => ({
      id: employee.id,
      name: employeeName(employee),
      unavailabilities: employee.unavailabilities.map((unavailability) => ({
        id: unavailability.id,
        type: unavailability.type,
        startAt: unavailability.startAt.toISOString(),
        endAt: unavailability.endAt.toISOString(),
        note: unavailability.note,
      })),
    })),
    rooms: rooms.map((room) => ({
      id: room.id,
      name: room.name,
      type: room.type,
      capacity: room.capacity,
      unavailabilities: room.unavailabilities.map((unavailability) => ({
        id: unavailability.id,
        startAt: unavailability.startAt.toISOString(),
        endAt: unavailability.endAt.toISOString(),
        reason: unavailability.reason,
      })),
    })),
  };
}
