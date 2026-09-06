import Link from "next/link";

import { formatPlanningTime } from "@/features/planning/components/planning-formatters";
import type {
  PlanningAppointmentItem,
  PlanningEmployeeItem,
} from "@/features/planning/server";

const unavailabilityLabels = {
  ABSENCE: "Absence",
  BREAK: "Pause",
  LEAVE: "Congé",
  UNAVAILABLE: "Indisponible",
} as const;

type EmployeePlanningViewProps = {
  employees: PlanningEmployeeItem[];
  appointments: PlanningAppointmentItem[];
};

export function EmployeePlanningView({
  employees,
  appointments,
}: EmployeePlanningViewProps) {
  const unassigned = appointments.flatMap((appointment) =>
    appointment.services
      .filter((service) => service.assignedEmployee === null)
      .map((service) => ({ appointment, service })),
  );

  return (
    <div className="space-y-4">
      {unassigned.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-amber-950">À affecter</h2>
              <p className="mt-1 text-sm text-amber-800">
                {unassigned.length} prestation{unassigned.length > 1 ? "s" : ""}{" "}
                sans employée.
              </p>
            </div>
            <Link
              href="/organize"
              className="rounded-xl bg-amber-900 px-3 py-2 text-sm font-semibold text-white"
            >
              Organiser
            </Link>
          </div>
        </section>
      ) : null}

      {employees.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-medium text-slate-800">Aucune employée active.</p>
          <Link
            href="/employees"
            className="mt-3 inline-block text-sm font-semibold text-violet-700"
          >
            Gérer l’équipe
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {employees.map((employee) => {
            const assignments = appointments.flatMap((appointment) =>
              appointment.services
                .filter(
                  (service) => service.assignedEmployee?.id === employee.id,
                )
                .map((service) => ({ appointment, service })),
            );

            return (
              <section
                key={employee.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <header className="border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-semibold text-slate-950">
                      {employee.name}
                    </h2>
                    <span className="text-xs font-medium text-slate-500">
                      {assignments.length} prestation
                      {assignments.length > 1 ? "s" : ""}
                    </span>
                  </div>
                </header>

                {employee.unavailabilities.length > 0 ? (
                  <div className="space-y-2 border-b border-slate-100 bg-rose-50/60 p-3">
                    {employee.unavailabilities.map((item) => (
                      <div key={item.id} className="text-sm text-rose-900">
                        <span className="font-semibold">
                          {unavailabilityLabels[item.type]}
                        </span>{" "}
                        {formatPlanningTime(item.startAt)}–
                        {formatPlanningTime(item.endAt)}
                        {item.note ? ` · ${item.note}` : ""}
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="divide-y divide-slate-100">
                  {assignments.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">
                      Aucune prestation affectée ce jour.
                    </p>
                  ) : (
                    assignments.map(({ appointment, service }) => (
                      <Link
                        key={service.id}
                        href={`/appointments/${appointment.id}`}
                        className="block p-4 transition hover:bg-slate-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-950">
                              {service.name}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              {appointment.client.name} ·{" "}
                              {appointment.client.phone}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-slate-700">
                            {formatPlanningTime(appointment.scheduledStart)}–
                            {formatPlanningTime(appointment.scheduledEnd)}
                          </span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
