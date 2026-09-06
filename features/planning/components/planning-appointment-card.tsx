import Link from "next/link";
import { ArrowUpRight, Clock3, DoorOpen, UserRound } from "lucide-react";

import {
  formatPlanningMoney,
  formatPlanningTime,
} from "@/features/planning/components/planning-formatters";
import type { PlanningAppointmentItem } from "@/features/planning/server";

const statusLabels = {
  PLANNED: "Prévu",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminé",
  CLOSED: "Clôturé",
} as const;

const serviceStatusLabels = {
  TODO: "À faire",
  IN_PROGRESS: "En cours",
  DONE: "Terminée",
} as const;

const statusClasses = {
  PLANNED: "bg-violet-50 text-violet-700",
  IN_PROGRESS: "bg-amber-50 text-amber-800",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-slate-100 text-slate-600",
} as const;

type PlanningAppointmentCardProps = {
  appointment: PlanningAppointmentItem;
};

export function PlanningAppointmentCard({
  appointment,
}: PlanningAppointmentCardProps) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white">
            {formatPlanningTime(appointment.scheduledStart)}–
            {formatPlanningTime(appointment.scheduledEnd)}
          </div>

          <div className="min-w-0">
            <h2 className="truncate font-semibold text-slate-950">
              {appointment.client.name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {appointment.client.phone}
            </p>
          </div>
        </div>

        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[appointment.status]}`}
        >
          {statusLabels[appointment.status]}
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {appointment.services.map((service) => (
          <div
            key={service.id}
            className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-slate-950">{service.name}</p>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  {serviceStatusLabels[service.status]}
                </span>
                {service.needsOrganization ? (
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                    À organiser
                  </span>
                ) : null}
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
                  {service.durationMinutes} min
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <UserRound aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
                  {service.assignedEmployee?.name ?? "Employée à affecter"}
                </span>
                {service.requiredRoomType ? (
                  <span className="inline-flex items-center gap-1.5">
                    <DoorOpen aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
                    {service.room?.name ?? "Salle à affecter"}
                  </span>
                ) : null}
              </div>
            </div>

            <p className="font-medium text-slate-800 sm:text-right">
              {formatPlanningMoney(service.price)}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3">
        <div>
          {appointment.organizationIssues > 0 ? (
            <p className="text-sm font-semibold text-amber-800">
              {appointment.organizationIssues} élément
              {appointment.organizationIssues > 1 ? "s" : ""} à organiser
            </p>
          ) : (
            <p className="text-sm text-slate-500">Organisation complète</p>
          )}
        </div>

        <div className="flex items-center gap-4">
          <p className="font-semibold text-slate-950">
            {formatPlanningMoney(appointment.totalAmount)}
          </p>
          <Link
            href={`/appointments/${appointment.id}`}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-violet-700 hover:bg-violet-50"
          >
            Ouvrir
            <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
          </Link>
        </div>
      </div>
    </article>
  );
}

