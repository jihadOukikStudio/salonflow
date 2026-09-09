import { prisma } from "@/server/db/prisma";
import type { CurrentUser } from "@/server/permissions";

import {
  getCasablancaDayRange,
  parsePlanningDate,
} from "@/features/planning/server/casablanca-day";

export type MyDayService = {
  id: string;
  appointmentId: string;
  scheduledStart: string;
  appointmentStatus: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CLOSED";
  serviceName: string;
  durationMinutes: number;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  clientName: string;
  clientPhone: string;
  roomName: string | null;
};

export type TakeableService = {
  id: string;
  appointmentId: string;
  scheduledStart: string;
  serviceName: string;
  clientName: string;
};

export type MyDayData = {
  dateKey: string;
  employeeName: string;
  employeeId: string;
  services: MyDayService[];
  takeableServices: TakeableService[];
};

function fullName(firstName: string, lastName: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ");
}

export async function getMyDay(
  currentUser: CurrentUser,
  requestedDate?: string,
): Promise<MyDayData | null> {
  if (currentUser.role !== "EMPLOYEE") return null;

  const employee = await prisma.employee.findFirst({
    where: {
      salonId: currentUser.salonId,
      userId: currentUser.id,
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      skills: { select: { serviceId: true } },
    },
  });

  if (!employee) return null;

  const dateKey = parsePlanningDate(requestedDate);
  const range = getCasablancaDayRange(dateKey);

  const [assignedServices, takeableServices] = await Promise.all([
    prisma.appointmentService.findMany({
      where: {
        assignedEmployeeId: employee.id,
        appointment: {
          salonId: currentUser.salonId,
          scheduledStart: { gte: range.start, lt: range.end },
          status: { not: "CANCELLED" },
        },
      },
      orderBy: [
        { appointment: { scheduledStart: "asc" } },
        { createdAt: "asc" },
      ],
      select: {
        id: true,
        serviceNameSnapshot: true,
        durationMinutes: true,
        status: true,
        room: { select: { name: true } },
        appointment: {
          select: {
            id: true,
            scheduledStart: true,
            status: true,
            client: { select: { name: true, phone: true } },
          },
        },
      },
    }),
    prisma.appointmentService.findMany({
      where: {
        assignedEmployeeId: null,
        serviceId: { in: employee.skills.map((skill) => skill.serviceId) },
        appointment: {
          salonId: currentUser.salonId,
          scheduledStart: { gte: range.start, lt: range.end },
          status: { in: ["PLANNED", "IN_PROGRESS"] },
        },
      },
      orderBy: [
        { appointment: { scheduledStart: "asc" } },
        { createdAt: "asc" },
      ],
      select: {
        id: true,
        serviceNameSnapshot: true,
        appointment: {
          select: {
            id: true,
            scheduledStart: true,
            client: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  return {
    dateKey,
    employeeId: employee.id,
    employeeName: fullName(employee.firstName, employee.lastName),
    services: assignedServices.map((service) => {
      if (service.appointment.status === "CANCELLED") {
        throw new Error(
          "Un rendez-vous annulé ne doit pas apparaître dans Ma journée.",
        );
      }
      return {
        id: service.id,
        appointmentId: service.appointment.id,
        scheduledStart: service.appointment.scheduledStart.toISOString(),
        appointmentStatus: service.appointment.status,
        serviceName: service.serviceNameSnapshot,
        durationMinutes: service.durationMinutes,
        status: service.status,
        clientName:
          service.appointment.client.name?.trim() || "Cliente sans nom",
        clientPhone: service.appointment.client.phone,
        roomName: service.room?.name ?? null,
      };
    }),
    takeableServices: takeableServices.map((service) => ({
      id: service.id,
      appointmentId: service.appointment.id,
      scheduledStart: service.appointment.scheduledStart.toISOString(),
      serviceName: service.serviceNameSnapshot,
      clientName: service.appointment.client.name?.trim() || "Cliente sans nom",
    })),
  };
}
