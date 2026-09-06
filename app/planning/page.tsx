import Link from "next/link";
import { Plus } from "lucide-react";

import {
  PlanningDateNavigation,
  PlanningSummary,
  PlanningViewTabs,
} from "@/features/planning/components";
import { DayCalendar } from "@/features/planning/components/day-calendar";
import {
  PlanningPeriodTabs,
  type PlanningPeriod,
} from "@/features/planning/components/planning-period-tabs";
import {
  PlanningPeriodView,
  type PlanningPeriodDay,
} from "@/features/planning/components/planning-period-view";
import {
  getPlanningDay,
  parsePlanningDate,
  parsePlanningView,
} from "@/features/planning/server";
import { shiftPlanningDate } from "@/features/planning/server/casablanca-day";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { getCurrentUser } from "@/server/auth/get-current-user";

type PlanningPageProps = {
  searchParams: Promise<{ date?: string; view?: string; period?: string }>;
};

function parsePeriod(value: string | undefined): PlanningPeriod {
  return value === "week" || value === "month" ? value : "day";
}

function mondayOf(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  const day = date.getUTCDay();
  return shiftPlanningDate(dateKey, day === 0 ? -6 : 1 - day);
}

function weekDates(dateKey: string) {
  const monday = mondayOf(dateKey);
  return Array.from({ length: 7 }, (_, index) =>
    shiftPlanningDate(monday, index),
  );
}

function monthDates(dateKey: string) {
  const source = new Date(`${dateKey}T12:00:00.000Z`);
  const year = source.getUTCFullYear();
  const month = source.getUTCMonth();
  const count = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
  return Array.from(
    { length: count },
    (_, index) =>
      `${year}-${String(month + 1).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`,
  );
}

export default async function PlanningPage({
  searchParams,
}: PlanningPageProps) {
  const currentUser = await getCurrentUser();
  const user = await getAuthoritativeCurrentUser(currentUser);
  const params = await searchParams;
  const dateKey = parsePlanningDate(params.date);
  const view = parsePlanningView(params.view);
  const requestedPeriod = parsePeriod(params.period);
  const period: PlanningPeriod = view === "planning" ? requestedPeriod : "day";
  const planning = await getPlanningDay(user, dateKey);
  const canManageSalon = user.role === "ADMIN" || user.canManageSalon;

  let periodDays: PlanningPeriodDay[] = [];
  if (period !== "day") {
    const dates = period === "week" ? weekDates(dateKey) : monthDates(dateKey);
    const loadedDays = await Promise.all(
      dates.map(async (day) => ({
        dateKey: day,
        planning: day === dateKey ? planning : await getPlanningDay(user, day),
      })),
    );
    periodDays = loadedDays.map(({ dateKey: day, planning: item }) => ({
      dateKey: day,
      appointments: item.appointments,
    }));
  }

  const summary =
    period === "day"
      ? {
          appointmentCount: planning.appointmentCount,
          organizationIssues: planning.organizationIssues,
          inProgressCount: planning.inProgressCount,
          completedCount: planning.completedCount,
        }
      : {
          appointmentCount: periodDays.reduce(
            (total, day) => total + day.appointments.length,
            0,
          ),
          organizationIssues: periodDays.reduce(
            (total, day) =>
              total +
              day.appointments.reduce(
                (sum, item) => sum + item.organizationIssues,
                0,
              ),
            0,
          ),
          inProgressCount: periodDays.reduce(
            (total, day) =>
              total +
              day.appointments.filter((item) => item.status === "IN_PROGRESS")
                .length,
            0,
          ),
          completedCount: periodDays.reduce(
            (total, day) =>
              total +
              day.appointments.filter(
                (item) =>
                  item.status === "COMPLETED" || item.status === "CLOSED",
              ).length,
            0,
          ),
        };

  return (
    <main className="min-h-screen bg-[#fcf9f7] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
      <div className="mx-auto w-full max-w-[1700px]">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 flex-1">
            <PlanningDateNavigation
              dateKey={planning.dateKey}
              view={view}
              period={period}
            />
          </div>
          {canManageSalon ? (
            <Link
              href="/appointments/new"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
            >
              <Plus className="h-4 w-4" strokeWidth={1.9} /> Nouveau rendez-vous
            </Link>
          ) : null}
        </header>

        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <PlanningViewTabs dateKey={planning.dateKey} view={view} />
          {view === "planning" ? (
            <PlanningPeriodTabs dateKey={planning.dateKey} period={period} />
          ) : null}
        </div>

        <div className="mt-4">
          <PlanningSummary {...summary} />
        </div>

        <section className="mt-5">
          {period === "day" ? (
            <DayCalendar
              dateKey={planning.dateKey}
              mode={
                view === "employees"
                  ? "employees"
                  : view === "rooms"
                    ? "rooms"
                    : "appointments"
              }
              appointments={planning.appointments}
              employees={planning.employees}
              rooms={planning.rooms}
            />
          ) : (
            <PlanningPeriodView period={period} days={periodDays} />
          )}
        </section>
      </div>
    </main>
  );
}
