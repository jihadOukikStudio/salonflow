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

  const operational = {
    dateKey,
    appointmentCount: planning.appointmentCount,
    organizationIssues: planning.organizationIssues,
    inProgressCount: planning.inProgressCount,
    completedCount: planning.completedCount,
    employeesNow,
    roomsNow,
    upcomingAppointments,
  };

  if (!canViewDashboardFinance(currentUser)) {
    return { operational, finance: null };
  }

  const today = getCasablancaDayRange(dateKey);
  const week = getCasablancaDayRange(mondayOf(dateKey));
  const month = getCasablancaDayRange(monthStart(dateKey));

  const [todayAmount, weekAmount, monthAmount] = await Promise.all([
    paidAmountBetween(currentUser.salonId, today.start, today.end),
    paidAmountBetween(currentUser.salonId, week.start, today.end),
    paidAmountBetween(currentUser.salonId, month.start, today.end),
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
