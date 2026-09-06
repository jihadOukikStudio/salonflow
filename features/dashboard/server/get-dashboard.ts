import { prisma } from "@/server/db/prisma";
import { canViewDashboardFinance } from "@/features/dashboard/lib/access";
import type { CurrentUser } from "@/server/permissions";
import { getPlanningDay, parsePlanningDate } from "@/features/planning/server";
import { getCasablancaDayRange } from "@/features/planning/server/casablanca-day";

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function mondayOf(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  return addDays(dateKey, -(weekday === 0 ? 6 : weekday - 1));
}

function monthStart(dateKey: string) {
  return `${dateKey.slice(0, 7)}-01`;
}

async function paidAmountBetween(salonId: string, start: Date, end: Date) {
  const result = await prisma.payment.aggregate({
    where: {
      status: "PAID",
      paidAt: { gte: start, lt: end },
      appointment: { salonId },
    },
    _sum: { amount: true },
  });

  return Number(result._sum.amount ?? 0);
}

async function completedServicesByEmployee(
  salonId: string,
  start: Date,
  end: Date,
  employeeNames: Map<string, string>,
) {
  const rows = await prisma.appointmentService.groupBy({
    by: ["performedByEmployeeId"],
    where: {
      status: "DONE",
      performedByEmployeeId: { not: null },
      appointment: {
        salonId,
        scheduledStart: { gte: start, lt: end },
      },
    },
    _count: { _all: true },
  });

  return rows
    .filter((row) => row.performedByEmployeeId !== null)
    .map((row) => ({
      employeeId: row.performedByEmployeeId as string,
      name:
        employeeNames.get(row.performedByEmployeeId as string) ?? "Employée",
      completedServices: row._count._all,
    }))
    .sort(
      (a, b) =>
        b.completedServices - a.completedServices ||
        a.name.localeCompare(b.name, "fr"),
    );
}

export async function getDashboard(currentUser: CurrentUser) {
  const dateKey = parsePlanningDate(undefined);
  const planning = await getPlanningDay(currentUser, dateKey);
  const now = new Date();

  const activeAppointments = planning.appointments.filter((appointment) => {
    const start = new Date(appointment.scheduledStart);
    const end = new Date(appointment.scheduledEnd);
    return start <= now && now < end;
  });

  const upcomingAppointments = planning.appointments
    .filter((appointment) => new Date(appointment.scheduledStart) > now)
    .slice(0, 4);

  const employeesNow = planning.employees.map((employee) => {
    const active = activeAppointments.find((appointment) =>
      appointment.services.some(
        (service) => service.assignedEmployee?.id === employee.id,
      ),
    );

    const unavailable = employee.unavailabilities.find(
      (item) => new Date(item.startAt) <= now && now < new Date(item.endAt),
    );

    return {
      id: employee.id,
      name: employee.name,
      state: unavailable ? "UNAVAILABLE" : active ? "BUSY" : "FREE",
      until: unavailable?.endAt ?? active?.scheduledEnd ?? null,
    } as const;
  });

  const roomsNow = planning.rooms.map((room) => {
    const active = activeAppointments.find((appointment) =>
      appointment.services.some((service) => service.room?.id === room.id),
    );
    const unavailable = room.unavailabilities.find(
      (item) => new Date(item.startAt) <= now && now < new Date(item.endAt),
    );

    return {
      id: room.id,
      name: room.name,
      type: room.type,
      state: unavailable ? "UNAVAILABLE" : active ? "BUSY" : "FREE",
      until: unavailable?.endAt ?? active?.scheduledEnd ?? null,
    } as const;
  });

  const todayRange = getCasablancaDayRange(dateKey);
  const weekStartRange = getCasablancaDayRange(mondayOf(dateKey));
  const monthStartRange = getCasablancaDayRange(monthStart(dateKey));
  const employeeNames = new Map(
    planning.employees.map((employee) => [employee.id, employee.name]),
  );

  const [teamToday, teamWeek, teamMonth] = await Promise.all([
    completedServicesByEmployee(
      currentUser.salonId,
      todayRange.start,
      todayRange.end,
      employeeNames,
    ),
    completedServicesByEmployee(
      currentUser.salonId,
      weekStartRange.start,
      todayRange.end,
      employeeNames,
    ),
    completedServicesByEmployee(
      currentUser.salonId,
      monthStartRange.start,
      todayRange.end,
      employeeNames,
    ),
  ]);

  const operational = {
    dateKey,
    appointmentCount: planning.appointmentCount,
    organizationIssues: planning.organizationIssues,
    inProgressCount: planning.inProgressCount,
    completedCount: planning.completedCount,
    employeesNow,
    roomsNow,
    upcomingAppointments,
    teamActivity: {
      today: teamToday,
      week: teamWeek,
      month: teamMonth,
    },
  };

  if (!canViewDashboardFinance(currentUser)) {
    return { operational, finance: null };
  }

  const [todayAmount, weekAmount, monthAmount] = await Promise.all([
    paidAmountBetween(currentUser.salonId, todayRange.start, todayRange.end),
    paidAmountBetween(
      currentUser.salonId,
      weekStartRange.start,
      todayRange.end,
    ),
    paidAmountBetween(
      currentUser.salonId,
      monthStartRange.start,
      todayRange.end,
    ),
  ]);

  return {
    operational,
    finance: {
      today: todayAmount,
      week: weekAmount,
      month: monthAmount,
    },
  };
}
