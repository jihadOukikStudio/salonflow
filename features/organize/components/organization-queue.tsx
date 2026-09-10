"use client";

import Link from "next/link";
import { Check, ChevronDown, DoorOpen, UserRound } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { OrganizationQueueItem } from "@/features/organize/server";
import {
  assignEmployeeToServiceAction,
  assignRoomToServiceAction,
  takeUnassignedServiceAction,
} from "@/features/appointments/server/actions/service-actions";

const inputClass =
  "min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-violet-600 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-100 disabled:text-slate-500";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  items: OrganizationQueueItem[];
  currentEmployeeId: string | null;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-MA", {
    timeZone: "Africa/Casablanca",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isToday(value: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date(value)) === formatter.format(new Date());
}

const urgencyLabel = {
  URGENT: "À traiter maintenant",
  SOON: "À préparer bientôt",
  LATER: "À préparer",
} as const;

function AssignmentSummary({ item }: { item: OrganizationQueueItem }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2 text-xs">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-medium ${
          item.assignedEmployee
            ? "bg-emerald-50 text-emerald-800"
            : "bg-amber-50 text-amber-800"
        }`}
      >
        <UserRound className="h-3.5 w-3.5" strokeWidth={1.8} />
        {item.assignedEmployee?.name ?? "Employée à affecter"}
      </span>

      {item.requiredRoomType ? (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-medium ${
            item.assignedRoom
              ? "bg-emerald-50 text-emerald-800"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          <DoorOpen className="h-3.5 w-3.5" strokeWidth={1.8} />
          {item.assignedRoom?.name ?? "Salle à attribuer"}
        </span>
      ) : null}
    </div>
  );
}

export function OrganizationQueue({ items, currentEmployeeId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const unresolved = useMemo(
    () => items.filter((item) => item.employeeMissing || item.roomMissing),
    [items],
  );
  const organized = useMemo(
    () => items.filter((item) => !item.employeeMissing && !item.roomMissing),
    [items],
  );
  const organizedToday = organized.filter((item) =>
    isToday(item.scheduledStart),
  );
  const organizedLater = organized.filter(
    (item) => !isToday(item.scheduledStart),
  );

  const issueCount = unresolved.reduce(
    (total, item) =>
      total + Number(item.employeeMissing) + Number(item.roomMissing),
    0,
  );

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

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div
          className={`rounded-2xl border px-5 py-4 ${
            issueCount > 0
              ? "border-amber-200 bg-amber-50"
              : "border-emerald-200 bg-emerald-50"
          }`}
        >
          <p
            className={`text-xs font-bold uppercase tracking-[0.12em] ${
              issueCount > 0 ? "text-amber-700" : "text-emerald-700"
            }`}
          >
            À régler
          </p>
          <div className="mt-1 flex items-end gap-2">
            <p
              className={`text-3xl font-semibold tabular-nums ${
                issueCount > 0 ? "text-amber-950" : "text-emerald-950"
              }`}
            >
              {issueCount}
            </p>
            <p className="pb-1 text-sm text-slate-600">
              {issueCount === 1 ? "point restant" : "points restants"}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            Organisé
          </p>
          <div className="mt-1 flex items-end gap-2">
            <p className="text-3xl font-semibold tabular-nums text-slate-950">
              {organized.length}
            </p>
            <p className="pb-1 text-sm text-slate-600">
              {organized.length === 1
                ? "prestation prête"
                : "prestations prêtes"}
            </p>
          </div>
        </div>
      </div>

      {message ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
        >
          <Check className="h-4 w-4 shrink-0" strokeWidth={2} />
          {message}
        </div>
      ) : null}

      {unresolved.length > 0 ? (
        <section aria-labelledby="organization-to-fix">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2
                id="organization-to-fix"
                className="text-xl font-semibold text-slate-950"
              >
                À régler
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Les décisions encore nécessaires avant les rendez-vous.
              </p>
            </div>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              {issueCount}
            </span>
          </div>

          <div className="space-y-3">
            {unresolved.map((item) => (
              <article
                key={item.serviceId}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        item.urgency === "URGENT"
                          ? "bg-red-100 text-red-800"
                          : item.urgency === "SOON"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {urgencyLabel[item.urgency]}
                    </span>

                    <h3 className="mt-2 text-base font-semibold text-slate-950">
                      {item.serviceName}
                    </h3>
                    <p className="mt-1 text-sm text-slate-700">
                      {item.clientName}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {formatDateTime(item.scheduledStart)}
                    </p>
                    <AssignmentSummary item={item} />
                  </div>

                  <Link
                    href={`/appointments/${item.appointmentId}`}
                    className="text-sm font-semibold text-violet-700 hover:text-violet-900"
                  >
                    Voir le RDV
                  </Link>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {item.employeeMissing ? (
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Employée
                      </label>
                      <div className="flex gap-2">
                        <select
                          aria-label={`Affecter une employée à ${item.serviceName}`}
                          className={`${inputClass} min-w-0 flex-1`}
                          defaultValue=""
                          disabled={
                            pending || item.availableEmployees.length === 0
                          }
                          onChange={(event) => {
                            if (!event.target.value) return;
                            const employee = item.availableEmployees.find(
                              (value) => value.id === event.target.value,
                            );
                            run(
                              () =>
                                assignEmployeeToServiceAction({
                                  appointmentServiceId: item.serviceId,
                                  employeeId: event.target.value,
                                }),
                              `${employee?.name ?? "Employée"} affectée à ${item.serviceName}.`,
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
                                `Prestation ${item.serviceName} prise.`,
                              )
                            }
                          >
                            Je prends
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                      <span className="font-semibold">Employée :</span>{" "}
                      {item.assignedEmployee?.name}
                    </div>
                  )}

                  {item.roomMissing ? (
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Salle
                      </label>
                      <select
                        aria-label={`Affecter une salle à ${item.serviceName}`}
                        className={`${inputClass} w-full`}
                        defaultValue=""
                        disabled={pending || item.availableRooms.length === 0}
                        onChange={(event) => {
                          if (!event.target.value) return;
                          const room = item.availableRooms.find(
                            (value) => value.id === event.target.value,
                          );
                          run(
                            () =>
                              assignRoomToServiceAction({
                                appointmentServiceId: item.serviceId,
                                roomId: event.target.value,
                              }),
                            `${room?.name ?? "Salle"} attribuée à ${item.serviceName}.`,
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
                    </div>
                  ) : item.requiredRoomType ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                      <span className="font-semibold">Salle :</span>{" "}
                      {item.assignedRoom?.name}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                      Aucune salle requise
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm">
              <Check className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <h2 className="font-semibold text-emerald-950">
                Tout est organisé
              </h2>
              <p className="mt-1 text-sm leading-6 text-emerald-800">
                Aucun rendez-vous ne nécessite d’intervention pour le moment.
              </p>
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="organization-ready">
        <details open={unresolved.length === 0} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm marker:content-none">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <Check className="h-4 w-4" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <h2
                  id="organization-ready"
                  className="font-semibold text-slate-950"
                >
                  Organisé · {organized.length}
                </h2>
                <p className="truncate text-xs text-slate-500">
                  Vérifier qui fait quoi et dans quelle salle.
                </p>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-180" />
          </summary>

          <div className="mt-3 space-y-5">
            {organizedToday.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Aujourd’hui
                </p>
                <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {organizedToday.map((item) => (
                    <OrganizedRow
                      key={item.serviceId}
                      item={item}
                      pending={pending}
                      run={run}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {organizedLater.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  À venir
                </p>
                <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {organizedLater.map((item) => (
                    <OrganizedRow
                      key={item.serviceId}
                      item={item}
                      pending={pending}
                      run={run}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {organized.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">
                Les prestations apparaîtront ici dès qu’elles seront organisées.
              </div>
            ) : null}
          </div>
        </details>
      </section>
    </div>
  );
}

type RunAction = (
  action: () => Promise<
    { ok: true; data: unknown } | { ok: false; message: string; code: string }
  >,
  success: string,
) => void;

function OrganizedRow({
  item,
  pending,
  run,
}: {
  item: OrganizationQueueItem;
  pending: boolean;
  run: RunAction;
}) {
  const [editing, setEditing] = useState<"employee" | "room" | null>(null);

  return (
    <article className="px-4 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-slate-950">
              {item.serviceName}
            </span>
            <span className="text-sm text-slate-500">· {item.clientName}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {formatDateTime(item.scheduledStart)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() =>
              setEditing((value) => (value === "employee" ? null : "employee"))
            }
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-emerald-50 px-3 font-medium text-emerald-800 transition hover:bg-emerald-100"
          >
            <UserRound className="h-3.5 w-3.5" strokeWidth={1.8} />
            {item.assignedEmployee?.name}
          </button>

          {item.requiredRoomType && item.assignedRoom ? (
            <button
              type="button"
              onClick={() =>
                setEditing((value) => (value === "room" ? null : "room"))
              }
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-emerald-50 px-3 font-medium text-emerald-800 transition hover:bg-emerald-100"
            >
              <DoorOpen className="h-3.5 w-3.5" strokeWidth={1.8} />
              {item.assignedRoom.name}
            </button>
          ) : null}

          <Link
            href={`/appointments/${item.appointmentId}`}
            className="inline-flex min-h-9 items-center px-2 text-xs font-semibold text-violet-700 hover:text-violet-900"
          >
            Voir le RDV
          </Link>
        </div>
      </div>

      {editing === "employee" ? (
        <div className="mt-3 rounded-xl bg-slate-50 p-3">
          <label className="mb-2 block text-xs font-semibold text-slate-600">
            Réaffecter l’employée
          </label>
          <select
            className={`${inputClass} w-full sm:max-w-sm`}
            value={item.assignedEmployee?.id ?? ""}
            disabled={pending}
            onChange={(event) => {
              if (
                !event.target.value ||
                event.target.value === item.assignedEmployee?.id
              ) {
                return;
              }
              const employee = item.availableEmployees.find(
                (value) => value.id === event.target.value,
              );
              run(
                () =>
                  assignEmployeeToServiceAction({
                    appointmentServiceId: item.serviceId,
                    employeeId: event.target.value,
                  }),
                `${employee?.name ?? "Employée"} affectée à ${item.serviceName}.`,
              );
              setEditing(null);
            }}
          >
            {item.availableEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {editing === "room" ? (
        <div className="mt-3 rounded-xl bg-slate-50 p-3">
          <label className="mb-2 block text-xs font-semibold text-slate-600">
            Changer de salle
          </label>
          <select
            className={`${inputClass} w-full sm:max-w-sm`}
            value={item.assignedRoom?.id ?? ""}
            disabled={pending}
            onChange={(event) => {
              if (
                !event.target.value ||
                event.target.value === item.assignedRoom?.id
              ) {
                return;
              }
              const room = item.availableRooms.find(
                (value) => value.id === event.target.value,
              );
              run(
                () =>
                  assignRoomToServiceAction({
                    appointmentServiceId: item.serviceId,
                    roomId: event.target.value,
                  }),
                `${room?.name ?? "Salle"} attribuée à ${item.serviceName}.`,
              );
              setEditing(null);
            }}
          >
            {item.availableRooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </article>
  );
}
