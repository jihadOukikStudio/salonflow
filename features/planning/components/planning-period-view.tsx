import Link from "next/link";

import { formatPlanningTime } from "@/features/planning/components/planning-formatters";
import type { PlanningAppointmentItem } from "@/features/planning/server";

export type PlanningPeriodDay = {
  dateKey: string;
  appointments: PlanningAppointmentItem[];
};

type Props = {
  period: "week" | "month";
  days: PlanningPeriodDay[];
};

function dayLabel(dateKey: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

function monthDayNumber(dateKey: string) {
  return new Date(`${dateKey}T12:00:00.000Z`).getUTCDate();
}

function isWeekend(dateKey: string) {
  const day = new Date(`${dateKey}T12:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

function compactServices(appointment: PlanningAppointmentItem) {
  const names = appointment.services.map((service) => service.name);
  if (names.length <= 2) return names.join(" · ");
  return `${names.slice(0, 2).join(" · ")} +${names.length - 2}`;
}

export function PlanningPeriodView({ period, days }: Props) {
  if (period === "week") {
    return (
      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid min-w-[1120px] grid-cols-7 divide-x divide-slate-100">
          {days.map((day) => (
            <section key={day.dateKey} className="min-w-0">
              <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-3 py-3 backdrop-blur">
                <p className="text-sm font-semibold capitalize text-slate-950">
                  {dayLabel(day.dateKey)}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {day.appointments.length} RDV
                </p>
              </header>

              <div className="min-h-[560px] space-y-2 p-2">
                {day.appointments.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
                    Aucun RDV
                  </div>
                ) : (
                  day.appointments.map((appointment) => (
                    <Link
                      key={appointment.id}
                      href={`/appointments/${appointment.id}`}
                      className="block rounded-xl border border-violet-100 bg-violet-50/70 p-3 transition hover:border-violet-200 hover:bg-violet-50 hover:shadow-sm"
                    >
                      <p className="text-xs font-semibold text-violet-800">
                        {formatPlanningTime(appointment.scheduledStart)}–
                        {formatPlanningTime(appointment.scheduledEnd)}
                      </p>
                      <p className="mt-1 truncate text-sm font-bold text-slate-950">
                        {appointment.client.name}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-600">
                        {compactServices(appointment)}
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  const firstDate = days[0]?.dateKey;
  const firstWeekday = firstDate
    ? new Date(`${firstDate}T12:00:00.000Z`).getUTCDay()
    : 1;
  const leadingEmpty = firstWeekday === 0 ? 6 : firstWeekday - 1;

  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/70 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((label) => (
            <div key={label} className="px-2 py-3">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: leadingEmpty }, (_, index) => (
            <div
              key={`empty-${index}`}
              className="min-h-[150px] border-b border-r border-slate-100 bg-slate-50/30 sm:min-h-[170px]"
            />
          ))}
          {days.map((day) => (
            <section
              key={day.dateKey}
              className={`min-h-[150px] border-b border-r border-slate-100 p-2 sm:min-h-[170px] ${
                isWeekend(day.dateKey) ? "bg-rose-50/30" : "bg-white"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold text-slate-700">
                  {monthDayNumber(day.dateKey)}
                </span>
                {day.appointments.length > 0 ? (
                  <span className="text-[10px] font-semibold text-slate-400">
                    {day.appointments.length} RDV
                  </span>
                ) : null}
              </div>

              <div className="space-y-1.5">
                {day.appointments.slice(0, 3).map((appointment) => (
                  <Link
                    key={appointment.id}
                    href={`/appointments/${appointment.id}`}
                    className="block rounded-lg bg-violet-50 px-2 py-1.5 text-xs transition hover:bg-violet-100"
                  >
                    <span className="font-semibold text-violet-800">
                      {formatPlanningTime(appointment.scheduledStart)}
                    </span>{" "}
                    <span className="font-medium text-slate-800">
                      {appointment.client.name}
                    </span>
                  </Link>
                ))}

                {day.appointments.length > 3 ? (
                  <Link
                    href={`/planning?date=${day.dateKey}&view=planning&period=day`}
                    className="block px-1 text-[11px] font-semibold text-violet-700 hover:text-violet-900"
                  >
                    + {day.appointments.length - 3} autre
                    {day.appointments.length - 3 > 1 ? "s" : ""}
                  </Link>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
