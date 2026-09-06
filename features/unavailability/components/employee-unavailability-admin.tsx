"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createEmployeeUnavailabilityAction,
  deleteEmployeeUnavailabilityAction,
} from "@/features/unavailability/server/actions/unavailability-actions";
import { casablancaLocalDateTimeToIso } from "@/features/appointments/lib/casablanca-local-datetime";
function formatCasablancaDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("fr-MA", {
    timeZone: "Africa/Casablanca",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-400 bg-white px-3 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:border-violet-600 focus:ring-2 focus:ring-violet-200";
const labels: Record<string, string> = {
  ABSENCE: "Absence",
  BREAK: "Pause",
  LEAVE: "Congé",
  UNAVAILABLE: "Indisponible",
};
type Employee = {
  id: string;
  firstName: string;
  lastName: string | null;
  unavailabilities: Array<{
    id: string;
    type: string;
    startAt: Date | string;
    endAt: Date | string;
    note: string | null;
  }>;
};
export function EmployeeUnavailabilityAdmin({
  employees,
  ownEmployeeId,
  canManage,
}: {
  employees: Employee[];
  ownEmployeeId: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState(
    canManage ? (employees[0]?.id ?? "") : (ownEmployeeId ?? ""),
  );
  const [type, setType] = useState<
    "ABSENCE" | "BREAK" | "LEAVE" | "UNAVAILABLE"
  >("ABSENCE");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [note, setNote] = useState("");
  function run(
    action: () => Promise<
      { ok: true; data: unknown } | { ok: false; message: string; code: string }
    >,
    success: string,
  ) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return setMessage(result.message);
      setMessage(success);
      router.refresh();
    });
  }
  return (
    <div className="space-y-6">
      {message ? (
        <div className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-950">
          {message}
        </div>
      ) : null}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950">
          Nouvelle indisponibilité
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {canManage ? (
            <select
              className={inputClass}
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName ?? ""}
                </option>
              ))}
            </select>
          ) : (
            <div className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-700">
              Votre propre planning
            </div>
          )}
          <select
            className={inputClass}
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            {Object.entries(labels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <label>
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Début
            </span>
            <input
              type="datetime-local"
              className={inputClass}
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Fin
            </span>
            <input
              type="datetime-local"
              className={inputClass}
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </label>
          <input
            className={`${inputClass} sm:col-span-2`}
            placeholder="Note optionnelle"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <button
          disabled={pending || !employeeId || !startAt || !endAt}
          onClick={() =>
            run(
              () =>
                createEmployeeUnavailabilityAction({
                  employeeId,
                  type,
                  startAt: casablancaLocalDateTimeToIso(
                    startAt.slice(0, 10),
                    startAt.slice(11, 16),
                  ),
                  endAt: casablancaLocalDateTimeToIso(
                    endAt.slice(0, 10),
                    endAt.slice(11, 16),
                  ),
                  note: note || null,
                }),
              "Indisponibilité enregistrée.",
            )
          }
          className="mt-4 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white"
        >
          Enregistrer
        </button>
      </section>
      <section className="space-y-4">
        {employees
          .filter((e) => canManage || e.id === ownEmployeeId)
          .map((employee) => (
            <article
              key={employee.id}
              className="rounded-3xl border border-slate-200 bg-white p-5"
            >
              <h3 className="font-semibold text-slate-950">
                {employee.firstName} {employee.lastName ?? ""}
              </h3>
              <div className="mt-3 space-y-2">
                {employee.unavailabilities.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Aucune indisponibilité future.
                  </p>
                ) : (
                  employee.unavailabilities.map((u) => (
                    <div
                      key={u.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {labels[u.type] ?? u.type}
                        </p>
                        <p className="text-xs text-slate-600">
                          {formatCasablancaDateTime(u.startAt)} →{" "}
                          {formatCasablancaDateTime(u.endAt)}
                          {u.note ? ` · ${u.note}` : ""}
                        </p>
                      </div>
                      <button
                        disabled={pending}
                        onClick={() =>
                          run(
                            () =>
                              deleteEmployeeUnavailabilityAction({ id: u.id }),
                            "Indisponibilité supprimée.",
                          )
                        }
                        className="text-sm font-semibold text-red-700"
                      >
                        Supprimer
                      </button>
                    </div>
                  ))
                )}
              </div>
            </article>
          ))}
      </section>
    </div>
  );
}
