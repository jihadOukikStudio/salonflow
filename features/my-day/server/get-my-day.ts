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
  employeeComment: string | null;
};
export type ActivityPeriod = { services: number; appointments: number };
export type MyDayData = {
  dateKey: string;
  employeeName: string;
  employeeId: string;
  services: MyDayService[];
  activity: {
    day: ActivityPeriod;
    week: ActivityPeriod;
    month: ActivityPeriod;
  };
};
function fullName(a: string, b: string | null) {
  return [a, b].filter(Boolean).join(" ");
}
function shiftDateKey(key: string, days: number) {
  const d = new Date(`${key}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function monthStart(key: string) {
  return `${key.slice(0, 7)}-01`;
}
function nextMonthStart(key: string) {
  const d = new Date(`${key.slice(0, 7)}-01T12:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}
function weekStart(key: string) {
  const d = new Date(`${key}T12:00:00.000Z`);
  const day = d.getUTCDay();
  return shiftDateKey(key, -(day === 0 ? 6 : day - 1));
}
async function activity(employeeId: string, startKey: string, endKey: string) {
  const start = getCasablancaDayRange(startKey).start;
  const end = getCasablancaDayRange(endKey).start;
  const rows = await prisma.appointmentService.findMany({
    where: {
      performedByEmployeeId: employeeId,
      status: "DONE",
      actualFinishedAt: { gte: start, lt: end },
      appointment: { status: { not: "CANCELLED" } },
    },
    select: { appointmentId: true },
  });
  return {
    services: rows.length,
    appointments: new Set(rows.map((r) => r.appointmentId)).size,
  };
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
    select: { id: true, firstName: true, lastName: true },
  });
  if (!employee) return null;
  const dateKey = parsePlanningDate(requestedDate);
  const range = getCasablancaDayRange(dateKey);
  const ws = weekStart(dateKey);
  const [assignedServices, day, week, month] = await Promise.all([
    prisma.appointmentService.findMany({
      where: {
        assignedEmployeeId: employee.id,
        cancelledAt: null,
        scheduledStart: { gte: range.start, lt: range.end },
        appointment: {
          salonId: currentUser.salonId,
          status: { not: "CANCELLED" },
        },
      },
      orderBy: [{ scheduledStart: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        serviceNameSnapshot: true,
        durationMinutes: true,
        scheduledStart: true,
        status: true,
        employeeComment: true,
        room: { select: { name: true } },
        appointment: {
          select: {
            id: true,
            status: true,
            client: { select: { name: true, phone: true } },
          },
        },
      },
    }),
    activity(employee.id, dateKey, shiftDateKey(dateKey, 1)),
    activity(employee.id, ws, shiftDateKey(ws, 7)),
    activity(employee.id, monthStart(dateKey), nextMonthStart(dateKey)),
  ]);
  return {
    dateKey,
    employeeId: employee.id,
    employeeName: fullName(employee.firstName, employee.lastName),
    activity: { day, week, month },
    services: assignedServices.map((s) => ({
      id: s.id,
      appointmentId: s.appointment.id,
      scheduledStart: s.scheduledStart.toISOString(),
      appointmentStatus: s.appointment
        .status as MyDayService["appointmentStatus"],
      serviceName: s.serviceNameSnapshot,
      durationMinutes: s.durationMinutes,
      status: s.status,
      clientName: s.appointment.client.name?.trim() || "Cliente sans nom",
      clientPhone: s.appointment.client.phone,
      roomName: s.room?.name ?? null,
      employeeComment: s.employeeComment,
    })),
  };
}
