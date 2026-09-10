import Link from "next/link";
import {
  Banknote,
  ChevronRight,
  CircleAlert,
  Clock3,
  DoorOpen,
  Sparkles,
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

function salonTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Casablanca",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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

      <section className="overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-violet-100 bg-violet-50/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-700" strokeWidth={1.8} />
              <h2 className="text-xl font-semibold text-slate-950">
                Salon maintenant
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              La situation opérationnelle à {salonTime(operational.generatedAt)}
              .
            </p>
          </div>
          <Link
            href="/planning#planning-now"
            className="inline-flex items-center gap-1 text-sm font-semibold text-violet-700"
          >
            Voir maintenant <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {operational.salonNowAppointments.length === 0 ? (
          <div className="p-5 sm:p-6">
            <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-100">
              Aucun rendez-vous en cours sur le créneau actuel. Le salon est à
              jour.
            </div>
          </div>
        ) : (
          <div className="grid gap-3 p-5 sm:p-6 lg:grid-cols-2">
            {operational.salonNowAppointments.map((appointment) => (
              <Link
                key={appointment.id}
                href={`/appointments/${appointment.id}`}
                className="rounded-2xl border border-slate-200 p-4 transition hover:border-violet-200 hover:bg-violet-50/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">
                      {appointment.client.name}
                    </p>
                    <p className="mt-1 text-sm font-medium text-violet-700">
                      {formatPlanningTime(appointment.scheduledStart)} →{" "}
                      {formatPlanningTime(appointment.scheduledEnd)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      appointment.status === "IN_PROGRESS"
                        ? "bg-violet-100 text-violet-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {appointment.status === "IN_PROGRESS"
                      ? "En cours"
                      : "À vérifier"}
                  </span>
                </div>
                <div className="mt-3 space-y-1.5">
                  {appointment.services.map((service) => (
                    <p key={service.id} className="text-sm text-slate-600">
                      <span className="font-medium text-slate-800">
                        {service.name}
                      </span>
                      {service.assignedEmployee
                        ? ` · ${service.assignedEmployee.name}`
                        : " · Employée à affecter"}
                      {service.room ? ` · ${service.room.name}` : ""}
                    </p>
                  ))}
                </div>
                {appointment.attention ? (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                    {appointment.attention}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        )}
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
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-amber-950">À surveiller</p>
                  <p className="mt-1 text-sm text-amber-800">
                    {operational.organizationIssues} prestation
                    {operational.organizationIssues > 1 ? "s" : ""} à organiser.
                  </p>
                  <div className="mt-3 space-y-2">
                    {operational.organizationAlerts.map((alert) => (
                      <Link
                        key={alert.serviceId}
                        href={`/appointments/${alert.appointmentId}`}
                        className="block rounded-xl bg-white/70 px-3 py-2 text-sm text-amber-950 ring-1 ring-amber-200 transition hover:bg-white"
                      >
                        <span className="font-semibold">
                          {formatPlanningTime(alert.scheduledStart)} ·{" "}
                          {alert.clientName}
                        </span>
                        <span className="block text-xs text-amber-800">
                          {alert.serviceName} ·{" "}
                          {[
                            alert.missingEmployee ? "employée" : null,
                            alert.missingRoom ? "salle" : null,
                          ]
                            .filter(Boolean)
                            .join(" + ")}{" "}
                          à affecter
                        </span>
                      </Link>
                    ))}
                  </div>
                  <Link
                    href="/organize"
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-amber-950"
                  >
                    Tout organiser <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900 shadow-sm">
              <p className="font-semibold">Tout est organisé ✓</p>
              <p className="mt-1 text-emerald-800">
                Aucune affectation ne demande votre attention.
              </p>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
