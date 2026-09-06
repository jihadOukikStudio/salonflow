"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { OrganizationQueueItem } from "@/features/organize/server";
import {
  assignEmployeeToServiceAction,
  assignRoomToServiceAction,
  takeUnassignedServiceAction,
} from "@/features/appointments/server/actions/service-actions";

const inputClass =
  "min-h-11 rounded-xl border border-slate-400 bg-white px-3 text-sm text-slate-950 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-200 disabled:bg-slate-100 disabled:text-slate-500";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  items: OrganizationQueueItem[];
  currentEmployeeId: string | null;
};

function dateTime(value: string) {
  return new Intl.DateTimeFormat("fr-MA", {
    timeZone: "Africa/Casablanca",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

const urgencyLabel = {
  URGENT: "Urgent",
  SOON: "Bientôt",
  LATER: "Plus tard",
} as const;

export function OrganizationQueue({ items, currentEmployeeId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(
    action: () => Promise<
      { ok: true; data: unknown } | { ok: false; message: string; code: string }
    >,
    success: string,
  ) {
    setMessage(null);

    startTransition(async () => {
      try {
        const result = await action();

        if (!result.ok) {
          setMessage(result.message);
          return;
        }

        setMessage(success);
        router.refresh();
      } catch (error) {
        console.error("Organization action failed", error);
        setMessage("Une erreur inattendue est survenue. Veuillez réessayer.");
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <p className="font-semibold text-emerald-950">Tout est organisé ✓</p>
        <p className="mt-1 text-sm text-emerald-800">
          Aucune prestation ne manque d’employée ou de salle sur les 14
          prochains jours.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-950">
          {message}
        </div>
      ) : null}

      {items.map((item) => (
        <article
          key={item.serviceId}
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                  item.urgency === "URGENT"
                    ? "bg-red-100 text-red-800"
                    : item.urgency === "SOON"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-100 text-slate-700"
                }`}
              >
                {urgencyLabel[item.urgency]}
              </span>

              <h3 className="mt-2 font-semibold text-slate-950">
                {item.serviceName}
              </h3>

              <p className="mt-1 text-sm text-slate-700">
                {item.clientName} · {item.clientPhone}
              </p>

              <p className="mt-1 text-sm text-slate-600">
                {dateTime(item.scheduledStart)}
              </p>
            </div>

            <Link
              href={`/appointments/${item.appointmentId}`}
              className="text-sm font-semibold text-violet-700 hover:text-violet-900"
            >
              Voir le rendez-vous →
            </Link>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {item.employeeMissing ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Employée manquante
                </p>

                <div className="flex gap-2">
                  <select
                    className={`${inputClass} min-w-0 flex-1`}
                    defaultValue=""
                    disabled={pending || item.availableEmployees.length === 0}
                    onChange={(event) => {
                      if (!event.target.value) return;

                      run(
                        () =>
                          assignEmployeeToServiceAction({
                            appointmentServiceId: item.serviceId,
                            employeeId: event.target.value,
                          }),
                        "Employée affectée.",
                      );
                    }}
                  >
                    <option value="">
                      {item.availableEmployees.length > 0
                        ? "Choisir une employée disponible"
                        : "Aucune employée disponible"}
                    </option>

                    {item.availableEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>

                  {currentEmployeeId && item.currentEmployeeCanTake ? (
                    <button
                      type="button"
                      disabled={pending}
                      className={`${buttonClass} bg-violet-700 text-white hover:bg-violet-800`}
                      onClick={() =>
                        run(
                          () =>
                            takeUnassignedServiceAction({
                              appointmentServiceId: item.serviceId,
                            }),
                          "Prestation prise.",
                        )
                      }
                    >
                      Je prends
                    </button>
                  ) : null}
                </div>

                {item.availableEmployees.length === 0 ? (
                  <p className="mt-2 text-xs font-medium text-red-700">
                    Aucune employée n’est disponible sur toute la plage du
                    rendez-vous.
                  </p>
                ) : null}

                {currentEmployeeId && !item.currentEmployeeCanTake ? (
                  <p className="mt-2 text-xs font-medium text-amber-800">
                    Vous n’êtes pas disponible sur toute la plage de ce
                    rendez-vous.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                Employée déjà affectée
              </div>
            )}

            {item.roomMissing ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Salle manquante
                </p>

                <select
                  className={`${inputClass} w-full`}
                  defaultValue=""
                  disabled={pending || item.availableRooms.length === 0}
                  onChange={(event) => {
                    if (!event.target.value) return;

                    run(
                      () =>
                        assignRoomToServiceAction({
                          appointmentServiceId: item.serviceId,
                          roomId: event.target.value,
                        }),
                      "Salle affectée.",
                    );
                  }}
                >
                  <option value="">
                    {item.availableRooms.length > 0
                      ? "Choisir une salle disponible"
                      : "Aucune salle disponible"}
                  </option>

                  {item.availableRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>

                {item.availableRooms.length === 0 ? (
                  <p className="mt-2 text-xs font-medium text-red-700">
                    Aucune salle compatible n’est disponible sur toute la plage
                    du rendez-vous.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                Salle OK
              </div>
            )}
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            Les listes sont calculées pour ce rendez-vous. La disponibilité est
            revérifiée côté serveur au moment de l’affectation.
          </p>
        </article>
      ))}
    </div>
  );
}
