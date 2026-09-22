import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { prisma } from "@/server/db/prisma";
import type { CurrentUser } from "@/server/permissions";
import { PermissionDeniedError } from "@/server/permissions/errors";
import { getCasablancaDayRange } from "@/features/planning/server/casablanca-day";
import { parsePlanningDate } from "@/features/planning/server";

export type EmployeeActivityDetail = {
  id: string;
  appointmentId: string;
  serviceName: string;
  clientName: string;
  finishedAt: string;
};

export type EmployeeActivityItem = {
  employeeId: string;
  name: string;
  completedServices: number;
  appointmentCount: number;
  details: EmployeeActivityDetail[];
};

export type TeamActivityData = {
  today: EmployeeActivityItem[];
  week: EmployeeActivityItem[];
  month: EmployeeActivityItem[];
};

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

function employeeName(firstName: string, lastName: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ");
}

async function activityBetween(
  salonId: string,
  employees: Array<{ id: string; firstName: string; lastName: string | null }>,
  start: Date,
  end: Date,
): Promise<EmployeeActivityItem[]> {
  const rows = await prisma.appointmentService.findMany({
    where: {
      status: "DONE",
      performedByEmployeeId: { not: null },
      actualFinishedAt: { gte: start, lt: end },
      appointment: { salonId, status: { not: "CANCELLED" } },
    },
    orderBy: { actualFinishedAt: "desc" },
    select: {
      id: true,
      performedByEmployeeId: true,
      appointmentId: true,
      serviceNameSnapshot: true,
      actualFinishedAt: true,
      appointment: { select: { client: { select: { name: true } } } },
    },
  });

  const counters = new Map<
    string,
    {
      completedServices: number;
      appointmentIds: Set<string>;
      details: EmployeeActivityDetail[];
    }
  >();

  for (const row of rows) {
    if (!row.performedByEmployeeId) continue;
    const current = counters.get(row.performedByEmployeeId) ?? {
      completedServices: 0,
      appointmentIds: new Set<string>(),
      details: [],
    };
    current.completedServices += 1;
    current.appointmentIds.add(row.appointmentId);
    if (row.actualFinishedAt && current.details.length < 12) {
      current.details.push({
        id: row.id,
        appointmentId: row.appointmentId,
        serviceName: row.serviceNameSnapshot,
        clientName: row.appointment.client.name?.trim() || "Cliente sans nom",
        finishedAt: row.actualFinishedAt.toISOString(),
      });
    }
    counters.set(row.performedByEmployeeId, current);
  }

  return employees
    .map((employee) => {
      const counter = counters.get(employee.id);
      return {
        employeeId: employee.id,
        name: employeeName(employee.firstName, employee.lastName),
        completedServices: counter?.completedServices ?? 0,
        appointmentCount: counter?.appointmentIds.size ?? 0,
        details: counter?.details ?? [],
      };
    })
    .sort(
      (a, b) =>
        b.completedServices - a.completedServices ||
        a.name.localeCompare(b.name, "fr"),
    );
}

/** Activité individuelle de l'équipe. Réservée à la gérante/Admin. */
export async function getTeamActivity(
  currentUser: CurrentUser,
): Promise<TeamActivityData> {
  const user = await getAuthoritativeCurrentUser(currentUser);
  if (user.role !== "ADMIN") {
    throw new PermissionDeniedError(
      "Seule la gérante peut consulter l’activité de l’équipe.",
    );
  }

  const employees = await prisma.employee.findMany({
    where: { salonId: user.salonId, isActive: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });

  const dateKey = parsePlanningDate(undefined);
  const today = getCasablancaDayRange(dateKey);
  const week = getCasablancaDayRange(mondayOf(dateKey));
  const month = getCasablancaDayRange(monthStart(dateKey));

  const [todayActivity, weekActivity, monthActivity] = await Promise.all([
    activityBetween(user.salonId, employees, today.start, today.end),
    activityBetween(user.salonId, employees, week.start, today.end),
    activityBetween(user.salonId, employees, month.start, today.end),
  ]);

  return {
    today: todayActivity,
    week: weekActivity,
    month: monthActivity,
  };
}
