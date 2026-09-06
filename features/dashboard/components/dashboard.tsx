import Link from "next/link";
import {
  Banknote,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Clock3,
  DoorOpen,
  Plus,
  UserRound,
} from "lucide-react";

import { TeamActivity } from "@/features/dashboard/components/team-activity";
import type { AwaitedReturn } from "@/features/dashboard/components/types";
import { formatPlanningTime } from "@/features/planning/components/planning-formatters";

function money(value: number) {
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 0,
  }).format(value);
}

function StateDot({ state }: { state: "FREE" | "BUSY" | "UNAVAILABLE" }) {
  const classes =
    state === "FREE"
      ? "bg-emerald-500"
      : state === "BUSY"
        ? "bg-violet-500"
        : "bg-amber-500";
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${classes}`} />;
}

export function Dashboard({ data }: { data: AwaitedReturn }) {
  const { operational, finance } = data;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Rendez-vous", operational.appointmentCount],
          ["En cours", operational.inProgressCount],
          ["Terminés", operational.completedCount],
          ["À organiser", operational.organizationIssues],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {label}
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {value}
            </p>
          </div>
        ))}
      </section>

      {finance ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-violet-700" strokeWidth={1.8} />
            <h2 className="text-xl font-semibold text-slate-950">
              Activité financière
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Visible uniquement par la gérante.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["Aujourd’hui", finance.today],
              ["Cette semaine", finance.week],
              ["Ce mois", finance.month],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"
              >
                <p className="text-sm text-slate-600">{label}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">
                  {money(Number(value))}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <TeamActivity activity={operational.teamActivity} />

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <UserRound
                className="h-5 w-5 text-violet-700"
                strokeWidth={1.8}
              />
              <h2 className="text-xl font-semibold text-slate-950">
                Équipe maintenant
              </h2>
            </div>
            <Link
              href="/planning?view=employees"
              className="text-sm font-semibold text-violet-700"
            >
              Planning
            </Link>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {operational.employeesNow.map((employee) => (
              <div
                key={employee.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <StateDot state={employee.state} />
                  <span className="truncate font-medium text-slate-900">
                    {employee.name}
                  </span>
                </div>
                <span className="text-sm text-slate-600">
                  {employee.state === "FREE"
                    ? "Libre"
                    : employee.state === "BUSY"
                      ? `Occupée jusqu’à ${employee.until ? formatPlanningTime(employee.until) : "—"}`
                      : `Indisponible jusqu’à ${employee.until ? formatPlanningTime(employee.until) : "—"}`}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <DoorOpen className="h-5 w-5 text-violet-700" strokeWidth={1.8} />
              <h2 className="text-xl font-semibold text-slate-950">
                Salles maintenant
              </h2>
            </div>
            <Link
              href="/planning?view=rooms"
              className="text-sm font-semibold text-violet-700"
            >
              Planning
            </Link>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {operational.roomsNow.map((room) => (
              <div
                key={room.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <StateDot state={room.state} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">
                      {room.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {room.type === "HAMAM" ? "Hamam" : "Salle de soins"}
                    </p>
                  </div>
                </div>
                <span className="text-sm text-slate-600">
                  {room.state === "FREE"
                    ? "Libre"
                    : room.state === "BUSY"
                      ? `Occupée jusqu’à ${room.until ? formatPlanningTime(room.until) : "—"}`
                      : `Indisponible jusqu’à ${room.until ? formatPlanningTime(room.until) : "—"}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-violet-700" strokeWidth={1.8} />
              <h2 className="text-xl font-semibold text-slate-950">
                Prochains rendez-vous
              </h2>
            </div>
            <Link
              href="/planning"
              className="inline-flex items-center gap-1 text-sm font-semibold text-violet-700"
            >
              Voir le planning <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {operational.upcomingAppointments.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                Aucun autre rendez-vous prévu aujourd’hui.
              </p>
            ) : (
              operational.upcomingAppointments.map((appointment) => (
                <Link
                  key={appointment.id}
                  href={`/appointments/${appointment.id}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 transition hover:bg-violet-50"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-950">
                      {appointment.client.name}
                    </p>
                    <p className="mt-1 truncate text-sm text-slate-600">
                      {appointment.services
                        .map((service) => service.name)
                        .join(" · ")}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold text-slate-800">
                    {formatPlanningTime(appointment.scheduledStart)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        <aside className="space-y-3">
          {operational.organizationIssues > 0 ? (
            <Link
              href="/organize"
              className="block rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <CircleAlert className="mt-0.5 h-5 w-5 text-amber-700" />
                <div>
                  <p className="font-semibold text-amber-950">À organiser</p>
                  <p className="mt-1 text-sm text-amber-800">
                    {operational.organizationIssues} élément
                    {operational.organizationIssues > 1 ? "s" : ""} nécessitent
                    une action.
                  </p>
                </div>
              </div>
            </Link>
          ) : null}
          <Link
            href="/appointments/new"
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 font-semibold text-white shadow-sm transition hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" /> Nouveau rendez-vous
          </Link>
          <Link
            href="/planning"
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
          >
            <CalendarDays className="h-4 w-4" /> Ouvrir le planning
          </Link>
        </aside>
      </section>
    </div>
  );
}
