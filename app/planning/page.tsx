import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, X } from "lucide-react";

import { PlanningAppointmentBuilder } from "@/features/appointments/new/components";
import { getMinimumBookableCasablancaDateTime } from "@/features/appointments/lib/casablanca-local-datetime";
import { getNewAppointmentOptions } from "@/features/appointments/new/server";
import {
  PlanningDateNavigation,
  PlanningSummary,
} from "@/features/planning/components";
import { DayCalendar } from "@/features/planning/components/day-calendar";
import { type PlanningPeriod } from "@/features/planning/components/planning-period-tabs";
import {
  PlanningPeriodView,
  type PlanningPeriodDay,
} from "@/features/planning/components/planning-period-view";
import { getPlanningDay, parsePlanningDate } from "@/features/planning/server";
import { shiftPlanningDate } from "@/features/planning/server/casablanca-day";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { getCurrentUser } from "@/server/auth/get-current-user";

type PlanningPageProps = {
  searchParams: Promise<{
    date?: string;
    view?: string;
    period?: string;
    new?: string;
    time?: string;
    employee?: string;
  }>;
};

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
  if (user.role === "EMPLOYEE" && !user.canManageSalon) {
    redirect("/my-day");
  }
  const params = await searchParams;
  const dateKey = parsePlanningDate(params.date);
  const view = "employees" as const;
  const period: PlanningPeriod = "day";
  const planning = await getPlanningDay(user, dateKey);
  const canManageSalon = user.role === "ADMIN" || user.canManageSalon;
  const shouldOpenNewAppointment = canManageSalon && params.new === "1";
  const requestedTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(params.time ?? "")
    ? params.time
    : undefined;
  const newAppointmentOptions = shouldOpenNewAppointment
    ? await getNewAppointmentOptions(user)
    : null;
  const minimumBooking = getMinimumBookableCasablancaDateTime();
  const isPastCreationDate = Boolean(
    shouldOpenNewAppointment &&
    planning.dateKey < minimumBooking.dateKey,
  );

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
    <main className="min-h-screen bg-[#fcf9f6] px-3 py-4 sm:px-6 sm:py-7 xl:px-8">
      <div className="mx-auto w-full max-w-[1700px]">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 flex-1">
            <PlanningDateNavigation
              dateKey={planning.dateKey}
              view={view}
              period={period}
            />
          </div>
          {canManageSalon && planning.dateKey >= minimumBooking.dateKey ? (
            <Link
              href={`/planning?date=${encodeURIComponent(planning.dateKey)}&view=${view}&period=${period}&new=1`}
              className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 sm:w-auto"
            >
              <Plus className="h-4 w-4" strokeWidth={1.9} /> Nouveau rendez-vous
            </Link>
          ) : null}
        </header>
        <div className="mt-4 rounded-2xl bg-white/70 px-3 py-2 text-xs leading-5 text-slate-600 ring-1 ring-slate-200 sm:mt-5 sm:bg-transparent sm:px-0 sm:py-0 sm:text-sm sm:ring-0">
          Une colonne par employée · touchez un créneau libre pour préparer le rendez-vous.
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
              canCreateAppointment={
                canManageSalon && planning.dateKey >= minimumBooking.dateKey
              }
              minimumBooking={minimumBooking}
            />
          ) : (
            <PlanningPeriodView period={period} days={periodDays} />
          )}
        </section>
      </div>

      {isPastCreationDate ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Création impossible"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
                  Création impossible
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">
                  Cette date est déjà passée
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Vous pouvez consulter librement l’historique du planning, mais
                  un nouveau rendez-vous doit être créé aujourd’hui ou à une
                  date future.
                </p>
              </div>
              <Link
                href={`/planning?date=${encodeURIComponent(planning.dateKey)}&view=${view}&period=${period}`}
                aria-label="Fermer"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </Link>
            </div>
            <Link
              href={`/planning?date=${encodeURIComponent(parsePlanningDate(undefined))}&view=${view}&period=${period}&new=1`}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              Créer un rendez-vous aujourd’hui
            </Link>
          </div>
        </div>
      ) : shouldOpenNewAppointment &&
        newAppointmentOptions &&
        minimumBooking ? (
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-white sm:bg-slate-950/45 sm:p-6 sm:backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Nouveau rendez-vous"
        >
          <div className="mx-auto min-h-[100dvh] w-full max-w-6xl bg-slate-50 px-3 pb-8 pt-3 sm:min-h-0 sm:rounded-3xl sm:p-6 sm:shadow-2xl">
            <div className="sticky top-0 z-40 -mx-3 mb-4 flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/95 px-3 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">
                  SalonFlow
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                  Nouveau rendez-vous
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Construisez le rendez-vous au fur et à mesure de l’appel, puis confirmez toutes les affectations en une seule fois.
                </p>
              </div>
              <Link
                href={`/planning?date=${encodeURIComponent(planning.dateKey)}&view=${view}&period=${period}`}
                aria-label="Fermer"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </Link>
            </div>

            <PlanningAppointmentBuilder
              services={newAppointmentOptions.services}
              employees={newAppointmentOptions.employees}
              rooms={newAppointmentOptions.rooms}
              dateKey={
                planning.dateKey < minimumBooking.dateKey
                  ? minimumBooking.dateKey
                  : planning.dateKey
              }
              initialTime={requestedTime}
              initialEmployeeId={params.employee}
              cancelHref={`/planning?date=${encodeURIComponent(planning.dateKey)}&view=${view}&period=${period}`}
              planningAppointments={planning.appointments}
              planningEmployees={planning.employees}
              planningRooms={planning.rooms}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
