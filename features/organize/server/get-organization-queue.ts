import type { CurrentUser } from "@/server/permissions";

import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";

import { prisma } from "@/server/db/prisma";

import {
  getAppointmentEnd,
  intervalsOverlap,
} from "@/server/services/resources/appointment-interval";

type AvailableResource = {
  id: string;
  name: string;
};

export type OrganizationQueueItem = {
  serviceId: string;
  appointmentId: string;
  scheduledStart: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  requiredRoomType: "HAMAM" | "TREATMENT_ROOM" | null;
  employeeMissing: boolean;
  roomMissing: boolean;
  urgency: "URGENT" | "SOON" | "LATER";
  availableEmployees: AvailableResource[];
  availableRooms: AvailableResource[];
  currentEmployeeCanTake: boolean;
};

function fullName(value: { firstName: string; lastName: string | null }) {
  return [value.firstName, value.lastName].filter(Boolean).join(" ");
}

export async function getOrganizationQueue(currentUser: CurrentUser) {
  const user = await getAuthoritativeCurrentUser(currentUser);

  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const [services, employees, rooms, currentEmployee, skillModeMarker] =
    await Promise.all([
      prisma.appointmentService.findMany({
        where: {
          appointment: {
            salonId: user.salonId,
            status: { in: ["PLANNED", "IN_PROGRESS"] },
            scheduledStart: { lte: horizon },
          },
          OR: [
            { assignedEmployeeId: null },
            {
              AND: [
                { requiredRoomTypeSnapshot: { not: null } },
                { roomId: null },
              ],
            },
          ],
        },
        orderBy: { appointment: { scheduledStart: "asc" } },
        select: {
          id: true,
          serviceId: true,
          serviceNameSnapshot: true,
          requiredRoomTypeSnapshot: true,
          assignedEmployeeId: true,
          roomId: true,
          appointment: {
            select: {
              id: true,
              scheduledStart: true,
              estimatedDurationMinutes: true,
              client: { select: { name: true, phone: true } },
            },
          },
        },
      }),

      prisma.employee.findMany({
        where: { salonId: user.salonId, isActive: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          skills: { select: { serviceId: true } },
        },
      }),

      prisma.room.findMany({
        where: { salonId: user.salonId, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, type: true },
      }),

      prisma.employee.findFirst({
        where: { salonId: user.salonId, userId: user.id, isActive: true },
        select: { id: true },
      }),

      prisma.employeeSkill.findFirst({
        where: { employee: { salonId: user.salonId } },
        select: { employeeId: true },
      }),
    ]);

  if (services.length === 0) {
    return {
      items: [] as OrganizationQueueItem[],
      currentEmployeeId: currentEmployee?.id ?? null,
    };
  }

  const queueIntervals = services.map((service) => ({
    appointmentId: service.appointment.id,
    startAt: service.appointment.scheduledStart,
    endAt: getAppointmentEnd(
      service.appointment.scheduledStart,
      service.appointment.estimatedDurationMinutes,
    ),
  }));

  const rangeStart = new Date(
    Math.min(...queueIntervals.map((interval) => interval.startAt.getTime())),
  );
  const rangeEnd = new Date(
    Math.max(...queueIntervals.map((interval) => interval.endAt.getTime())),
  );

  const employeeIds = employees.map((employee) => employee.id);
  const roomIds = rooms.map((room) => room.id);

  const [
    employeeUnavailabilities,
    roomUnavailabilities,
    appointmentCandidates,
  ] = await Promise.all([
    employeeIds.length > 0
      ? prisma.employeeUnavailability.findMany({
          where: {
            employeeId: { in: employeeIds },
            startAt: { lt: rangeEnd },
            endAt: { gt: rangeStart },
          },
          select: {
            employeeId: true,
            startAt: true,
            endAt: true,
          },
        })
      : Promise.resolve([]),

    roomIds.length > 0
      ? prisma.roomUnavailability.findMany({
          where: {
            roomId: { in: roomIds },
            startAt: { lt: rangeEnd },
            endAt: { gt: rangeStart },
          },
          select: {
            roomId: true,
            startAt: true,
            endAt: true,
          },
        })
      : Promise.resolve([]),

    prisma.appointment.findMany({
      where: {
        salonId: user.salonId,
        status: { notIn: ["CANCELLED", "CLOSED"] },
        scheduledStart: { lt: rangeEnd },
      },
      select: {
        id: true,
        scheduledStart: true,
        estimatedDurationMinutes: true,
        services: {
          select: {
            assignedEmployeeId: true,
            roomId: true,
          },
        },
      },
    }),
  ]);

  const employeeNames = new Map(
    employees.map((employee) => [employee.id, fullName(employee)] as const),
  );

  const roomNames = new Map(rooms.map((room) => [room.id, room.name] as const));

  const items: OrganizationQueueItem[] = services.map((service) => {
    const startAt = service.appointment.scheduledStart;
    const endAt = getAppointmentEnd(
      startAt,
      service.appointment.estimatedDurationMinutes,
    );

    const interval = { startAt, endAt };

    const unavailableEmployeeIds = new Set(
      employeeUnavailabilities
        .filter((unavailability) =>
          intervalsOverlap(interval, {
            startAt: unavailability.startAt,
            endAt: unavailability.endAt,
          }),
        )
        .map((unavailability) => unavailability.employeeId),
    );

    const unavailableRoomIds = new Set(
      roomUnavailabilities
        .filter((unavailability) =>
          intervalsOverlap(interval, {
            startAt: unavailability.startAt,
            endAt: unavailability.endAt,
          }),
        )
        .map((unavailability) => unavailability.roomId),
    );

    for (const candidate of appointmentCandidates) {
      if (candidate.id === service.appointment.id) {
        continue;
      }

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

      for (const candidateService of candidate.services) {
        if (candidateService.assignedEmployeeId) {
          unavailableEmployeeIds.add(candidateService.assignedEmployeeId);
        }

        if (candidateService.roomId) {
          unavailableRoomIds.add(candidateService.roomId);
        }
      }
    }

    const skillsModeEnabled = skillModeMarker !== null;

    const availableEmployees = employees
      .filter((employee) => {
        if (unavailableEmployeeIds.has(employee.id)) return false;
        if (!service.serviceId || !skillsModeEnabled) return true;
        return employee.skills.some(
          (skill) => skill.serviceId === service.serviceId,
        );
      })
      .map((employee) => ({
        id: employee.id,
        name: employeeNames.get(employee.id) ?? fullName(employee),
      }));

    const availableRooms = service.requiredRoomTypeSnapshot
      ? rooms
          .filter(
            (room) =>
              room.type === service.requiredRoomTypeSnapshot &&
              !unavailableRoomIds.has(room.id),
          )
          .map((room) => ({
            id: room.id,
            name: roomNames.get(room.id) ?? room.name,
          }))
      : [];

    const diffMinutes = (startAt.getTime() - now.getTime()) / 60000;

    const urgency: OrganizationQueueItem["urgency"] =
      diffMinutes <= 60 ? "URGENT" : diffMinutes <= 240 ? "SOON" : "LATER";

    return {
      serviceId: service.id,
      appointmentId: service.appointment.id,
      scheduledStart: startAt.toISOString(),
      clientName: service.appointment.client.name?.trim() || "Cliente sans nom",
      clientPhone: service.appointment.client.phone,
      serviceName: service.serviceNameSnapshot,
      requiredRoomType: service.requiredRoomTypeSnapshot,
      employeeMissing: service.assignedEmployeeId === null,
      roomMissing:
        service.requiredRoomTypeSnapshot !== null && service.roomId === null,
      urgency,
      availableEmployees,
      availableRooms,
      currentEmployeeCanTake:
        currentEmployee !== null &&
        availableEmployees.some(
          (employee) => employee.id === currentEmployee.id,
        ),
    };
  });

  return {
    items,
    currentEmployeeId: currentEmployee?.id ?? null,
  };
}
