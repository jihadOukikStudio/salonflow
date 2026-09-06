"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { AppointmentDetail } from "@/features/appointments/detail/server";
import {
  cancelAppointmentAction,
  closeAppointmentAction,
  markAppointmentPaidAction,
  updateAppointmentDetailsAction,
} from "@/features/appointments/server/actions/appointment-actions";
import {
  addAppointmentServiceAction,
  checkAddAppointmentServiceFeasibilityAction,
  assignEmployeeToServiceAction,
  assignRoomToServiceAction,
  completeAppointmentServiceAction,
  removeAppointmentServiceAction,
  startAppointmentServiceAction,
  takeUnassignedServiceAction,
} from "@/features/appointments/server/actions/service-actions";
import {
  createParallelGroupAction,
  removeParallelGroupAction,
} from "@/features/appointments/server/actions/parallel-actions";

const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-400 bg-white px-3 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:border-violet-600 focus:ring-2 focus:ring-violet-200 disabled:bg-slate-100 disabled:text-slate-500";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

type Props = { detail: AppointmentDetail };

type Feasibility = {
  canAdd: boolean;
  level: "POSSIBLE" | "WARNING" | "BLOCKED";
  currentDurationMinutes: number;
  newDurationMinutes: number;
  currentEnd: string;
  newEnd: string;
  extraMinutes: number;
  availableEmployees: Array<{ id: string; name: string }>;
  availableRooms: Array<{ id: string; name: string }>;
  requiredRoomType: "HAMAM" | "TREATMENT_ROOM" | null;
  blockers: string[];
  warnings: string[];
};

function money(value: number) {
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 2,
  }).format(value);
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("fr-MA", {
    timeZone: "Africa/Casablanca",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

function timeOnly(value: string) {
  return new Intl.DateTimeFormat("fr-MA", {
    timeZone: "Africa/Casablanca",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: AppointmentDetail["status"]) {
  return {
    PLANNED: "Planifié",
    IN_PROGRESS: "En cours",
    COMPLETED: "Terminé",
    CLOSED: "Clôturé",
    CANCELLED: "Annulé",
  }[status];
}

function serviceStatusLabel(
  status: AppointmentDetail["services"][number]["status"],
) {
  return { TODO: "À faire", IN_PROGRESS: "En cours", DONE: "Terminée" }[status];
}

export function AppointmentDetailClient({ detail }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [paymentAmountOverride, setPaymentAmountOverride] = useState<
    string | null
  >(null);
  const [note, setNote] = useState(detail.internalNote ?? "");
  const [serviceToAdd, setServiceToAdd] = useState("");
  const [feasibility, setFeasibility] = useState<Feasibility | null>(null);
  const [feasibilityMessage, setFeasibilityMessage] = useState<string | null>(
    null,
  );
  const [checkingFeasibility, setCheckingFeasibility] = useState(false);
  const [parallelSelection, setParallelSelection] = useState<string[]>([]);
  const feasibilityRequestId = useRef(0);

  const catalogTotal = useMemo(
    () => detail.services.reduce((total, service) => total + service.price, 0),
    [detail.services],
  );

  const paymentAmount =
    detail.payment?.status === "PAID"
      ? String(detail.payment.amount)
      : (paymentAmountOverride ?? String(catalogTotal));

  const isFinal = detail.status === "CLOSED" || detail.status === "CANCELLED";
  const isPaid = detail.payment?.status === "PAID";
  const canChangeStructure =
    detail.status === "PLANNED" ||
    detail.status === "IN_PROGRESS" ||
    (detail.status === "COMPLETED" && !isPaid);
  const allDone = detail.services.every((service) => service.status === "DONE");
  const selectedCatalogService = useMemo(
    () =>
      detail.catalogServices.find((service) => service.id === serviceToAdd) ??
      null,
    [detail.catalogServices, serviceToAdd],
  );

  useEffect(() => {
    if (
      !selectedCatalogService ||
      selectedCatalogService.defaultDurationMinutes === null ||
      !canChangeStructure
    ) {
      return;
    }

    const requestId = ++feasibilityRequestId.current;

    void checkAddAppointmentServiceFeasibilityAction({
      appointmentId: detail.id,
      serviceId: selectedCatalogService.id,
    })
      .then((result) => {
        if (requestId !== feasibilityRequestId.current) return;

        if (!result.ok) {
          setFeasibilityMessage(result.message);
          return;
        }

        setFeasibility(result.data);
      })
      .catch((error) => {
        if (requestId !== feasibilityRequestId.current) return;

        console.error("Feasibility check failed", error);
        setFeasibilityMessage(
          "Impossible de vérifier la faisabilité pour le moment.",
        );
      })
      .finally(() => {
        if (requestId === feasibilityRequestId.current) {
          setCheckingFeasibility(false);
        }
      });
  }, [canChangeStructure, detail.id, selectedCatalogService]);

  function run(
    action: () => Promise<
      { ok: true; data: unknown } | { ok: false; message: string; code: string }
    >,
    successMessage: string,
    onSuccess?: () => void,
  ) {
    setMessage(null);

    startTransition(async () => {
      try {
        const result = await action();

        if (!result.ok) {
          setMessage(result.message);
          return;
        }

        onSuccess?.();
        setMessage(successMessage);
        router.refresh();
      } catch (error) {
        console.error("Appointment action failed", error);
        setMessage("Une erreur inattendue est survenue. Veuillez réessayer.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {message ? (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-950">
          {message}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-violet-700">
                {statusLabel(detail.status)}
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                {detail.client.name}
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-700">
                {detail.client.phone}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-950">
                {dateTime(detail.scheduledStart)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Durée estimée : {detail.estimatedDurationMinutes} min
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-800">
                Note interne
              </span>
              <textarea
                className={`${inputClass} min-h-24 py-3`}
                value={note}
                disabled={!detail.canManageAppointment || isFinal || pending}
                onChange={(event) => setNote(event.target.value)}
                maxLength={2000}
              />
            </label>
            {detail.canManageAppointment && !isFinal ? (
              <button
                type="button"
                disabled={pending}
                className={`${buttonClass} bg-slate-900 text-white hover:bg-slate-800`}
                onClick={() =>
                  run(
                    () =>
                      updateAppointmentDetailsAction({
                        appointmentId: detail.id,
                        internalNote: note.trim() || null,
                      }),
                    "Note enregistrée.",
                  )
                }
              >
                Enregistrer la note
              </button>
            ) : null}
          </div>
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-600">
            Montant catalogue
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            {money(catalogTotal)}
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Les prix sont les snapshots enregistrés au moment de la réservation.
            Le montant réellement encaissé est défini au paiement.
          </p>
        </aside>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              Prestations
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Affectation, salle et exécution réelle.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {detail.services.map((service) => {
            const roomOptions = detail.rooms.filter(
              (room) =>
                !service.requiredRoomType ||
                room.type === service.requiredRoomType,
            );
            const canStart =
              service.status === "TODO" &&
              service.assignedEmployee !== null &&
              !isFinal;
            const canComplete = service.status === "IN_PROGRESS" && !isFinal;

            return (
              <article
                key={service.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-950">
                        {service.name}
                      </h3>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                        {serviceStatusLabel(service.status)}
                      </span>
                      {service.parallelGroupId ? (
                        <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800 ring-1 ring-violet-200">
                          En parallèle
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {service.durationMinutes} min · {money(service.price)}
                    </p>
                    {service.performedByEmployee ? (
                      <p className="mt-1 text-xs font-medium text-emerald-700">
                        Réalisée par : {service.performedByEmployee.name}
                      </p>
                    ) : null}
                  </div>

                  {detail.canManageAppointment &&
                  service.status === "TODO" &&
                  detail.services.length > 1 &&
                  !isFinal ? (
                    <button
                      type="button"
                      disabled={pending}
                      className={`${buttonClass} border border-red-300 bg-white text-red-700 hover:bg-red-50`}
                      onClick={() =>
                        run(
                          () =>
                            removeAppointmentServiceAction({
                              appointmentServiceId: service.id,
                            }),
                          "Prestation retirée.",
                          () => setPaymentAmountOverride(null),
                        )
                      }
                    >
                      Retirer
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Employée
                    </span>
                    <select
                      className={inputClass}
                      value={service.assignedEmployee?.id ?? ""}
                      disabled={pending || isFinal}
                      onChange={(event) => {
                        if (!event.target.value) return;
                        run(
                          () =>
                            assignEmployeeToServiceAction({
                              appointmentServiceId: service.id,
                              employeeId: event.target.value,
                            }),
                          "Employée affectée.",
                        );
                      }}
                    >
                      <option value="">À affecter</option>
                      {detail.employees.map((employee) => (
                        <option
                          key={employee.id}
                          value={employee.id}
                          disabled={
                            !employee.isAvailable &&
                            service.assignedEmployee?.id !== employee.id
                          }
                        >
                          {employee.name}
                          {employee.isAvailable
                            ? ""
                            : ` — ${
                                employee.unavailableReason ?? "Indisponible"
                              }`}
                        </option>
                      ))}
                    </select>
                  </label>

                  {service.requiredRoomType ? (
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Salle
                      </span>
                      <select
                        className={inputClass}
                        value={service.room?.id ?? ""}
                        disabled={pending || isFinal}
                        onChange={(event) => {
                          if (!event.target.value) return;
                          run(
                            () =>
                              assignRoomToServiceAction({
                                appointmentServiceId: service.id,
                                roomId: event.target.value,
                              }),
                            "Salle affectée.",
                          );
                        }}
                      >
                        <option value="">À affecter</option>
                        {roomOptions.map((room) => (
                          <option key={room.id} value={room.id}>
                            {room.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600">
                      Aucune salle requise
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {!service.assignedEmployee &&
                  detail.currentEmployeeId &&
                  !isFinal ? (
                    <button
                      type="button"
                      disabled={pending}
                      className={`${buttonClass} border border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100`}
                      onClick={() =>
                        run(
                          () =>
                            takeUnassignedServiceAction({
                              appointmentServiceId: service.id,
                            }),
                          "La prestation vous est affectée.",
                        )
                      }
                    >
                      Je prends
                    </button>
                  ) : null}

                  {canStart ? (
                    <button
                      type="button"
                      disabled={pending}
                      className={`${buttonClass} bg-violet-700 text-white hover:bg-violet-800`}
                      onClick={() =>
                        run(
                          () =>
                            startAppointmentServiceAction({
                              appointmentServiceId: service.id,
                            }),
                          "Prestation démarrée.",
                        )
                      }
                    >
                      Commencer
                    </button>
                  ) : null}

                  {canComplete ? (
                    <button
                      type="button"
                      disabled={pending}
                      className={`${buttonClass} bg-emerald-700 text-white hover:bg-emerald-800`}
                      onClick={() =>
                        run(
                          () =>
                            completeAppointmentServiceAction({
                              appointmentServiceId: service.id,
                            }),
                          "Prestation terminée.",
                        )
                      }
                    >
                      Terminer
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        {detail.canManageAppointment && detail.status === "PLANNED" ? (
          <div className="mt-6 border-t border-slate-200 pt-5">
            <h3 className="font-semibold text-slate-950">Parallélisme</h3>
            <p className="mt-1 text-sm text-slate-600">
              À utiliser uniquement lorsque plusieurs prestations sont
              réellement réalisées en même temps. La durée du groupe correspond
              à la prestation la plus longue.
            </p>

            {detail.parallelGroups.length > 0 ? (
              <div className="mt-4 space-y-2">
                {detail.parallelGroups.map((group, index) => {
                  const groupServices = group.appointmentServiceIds
                    .map(
                      (serviceId) =>
                        detail.services.find(
                          (service) => service.id === serviceId,
                        )?.name,
                    )
                    .filter((value): value is string => Boolean(value));

                  return (
                    <div
                      key={group.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-violet-950">
                          Groupe parallèle {index + 1}
                        </p>
                        <p className="mt-1 text-sm text-violet-800">
                          {groupServices.join(" + ")}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={pending}
                        className={`${buttonClass} border border-violet-300 bg-white text-violet-800 hover:bg-violet-100`}
                        onClick={() =>
                          run(
                            () =>
                              removeParallelGroupAction({
                                parallelGroupId: group.id,
                              }),
                            "Parallélisme supprimé.",
                          )
                        }
                      >
                        Retirer le parallélisme
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {detail.services
                .filter(
                  (service) =>
                    service.status === "TODO" && !service.parallelGroupId,
                )
                .map((service) => (
                  <label
                    key={service.id}
                    className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={parallelSelection.includes(service.id)}
                      disabled={pending}
                      onChange={(event) =>
                        setParallelSelection((current) =>
                          event.target.checked
                            ? [...current, service.id]
                            : current.filter((id) => id !== service.id),
                        )
                      }
                    />
                    <span>
                      {service.name} · {service.durationMinutes} min
                    </span>
                  </label>
                ))}
            </div>

            <button
              type="button"
              disabled={pending || parallelSelection.length < 2}
              className={`${buttonClass} mt-3 bg-violet-700 text-white hover:bg-violet-800`}
              onClick={() =>
                run(
                  () =>
                    createParallelGroupAction({
                      appointmentId: detail.id,
                      appointmentServiceIds: parallelSelection,
                    }),
                  "Prestations configurées en parallèle.",
                  () => setParallelSelection([]),
                )
              }
            >
              Réaliser les prestations sélectionnées en parallèle
            </button>
          </div>
        ) : null}

        {detail.canManageAppointment && canChangeStructure ? (
          <div className="mt-6 border-t border-slate-200 pt-5">
            <h3 className="font-semibold text-slate-950">
              Ajouter une prestation
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              SalonFlow vérifie d’abord l’impact sur la durée, les employées,
              les salles et les rendez-vous déjà prévus.
            </p>
            {detail.status === "COMPLETED" && !isPaid ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                Le rendez-vous est terminé mais pas encore encaissé. Une
                nouvelle prestation peut encore être ajoutée ; le rendez-vous
                repassera automatiquement en cours.
              </div>
            ) : null}

            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
              <select
                className={inputClass}
                value={serviceToAdd}
                disabled={pending}
                onChange={(event) => {
                  const nextServiceId = event.target.value;
                  const nextService =
                    detail.catalogServices.find(
                      (service) => service.id === nextServiceId,
                    ) ?? null;

                  feasibilityRequestId.current += 1;
                  setServiceToAdd(nextServiceId);
                  setFeasibility(null);
                  setFeasibilityMessage(null);
                  setCheckingFeasibility(
                    Boolean(
                      canChangeStructure &&
                      nextService &&
                      nextService.defaultDurationMinutes !== null,
                    ),
                  );
                }}
              >
                <option value="">Choisir une prestation…</option>
                {detail.catalogServices.map((service) => (
                  <option
                    key={service.id}
                    value={service.id}
                    disabled={service.defaultDurationMinutes === null}
                  >
                    {service.categoryName} — {service.name}
                    {service.defaultDurationMinutes === null
                      ? " (durée à configurer)"
                      : ""}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={
                  pending ||
                  checkingFeasibility ||
                  !selectedCatalogService ||
                  selectedCatalogService.defaultDurationMinutes === null ||
                  !feasibility ||
                  !feasibility.canAdd
                }
                className={`${buttonClass} bg-slate-900 text-white hover:bg-slate-800`}
                onClick={() => {
                  if (!selectedCatalogService || !feasibility?.canAdd) {
                    return;
                  }

                  run(
                    () =>
                      addAppointmentServiceAction({
                        appointmentId: detail.id,
                        serviceId: selectedCatalogService.id,
                      }),
                    "Prestation ajoutée. Affectez maintenant les ressources nécessaires.",
                    () => {
                      setServiceToAdd("");
                      setPaymentAmountOverride(null);
                      setFeasibility(null);
                      setFeasibilityMessage(null);
                    },
                  );
                }}
              >
                {checkingFeasibility ? "Vérification…" : "Ajouter"}
              </button>
            </div>

            {feasibilityMessage ? (
              <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-900">
                {feasibilityMessage}
              </div>
            ) : null}

            {checkingFeasibility ? (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                Vérification du planning en cours…
              </div>
            ) : null}

            {feasibility ? (
              <div
                className={`mt-3 rounded-2xl border p-4 ${
                  feasibility.level === "BLOCKED"
                    ? "border-red-200 bg-red-50"
                    : feasibility.level === "WARNING"
                      ? "border-amber-200 bg-amber-50"
                      : "border-emerald-200 bg-emerald-50"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p
                      className={`font-semibold ${
                        feasibility.level === "BLOCKED"
                          ? "text-red-900"
                          : feasibility.level === "WARNING"
                            ? "text-amber-900"
                            : "text-emerald-900"
                      }`}
                    >
                      {feasibility.level === "BLOCKED"
                        ? "Ajout bloqué : conflit de planning"
                        : feasibility.level === "WARNING"
                          ? "Ajout possible, mais à organiser"
                          : "Ajout possible"}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      Fin actuelle :{" "}
                      <strong>{timeOnly(feasibility.currentEnd)}</strong>
                      {" → "}
                      nouvelle fin estimée :{" "}
                      <strong>{timeOnly(feasibility.newEnd)}</strong>
                      {feasibility.extraMinutes > 0
                        ? ` (+${feasibility.extraMinutes} min)`
                        : ""}
                    </p>
                  </div>

                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    {feasibility.newDurationMinutes} min au total
                  </span>
                </div>

                {feasibility.blockers.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-800">
                      Conflits
                    </p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-red-900">
                      {feasibility.blockers.map((blocker) => (
                        <li key={blocker}>{blocker}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {feasibility.warnings.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                      À vérifier
                    </p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-950">
                      {feasibility.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-white/80 p-3 ring-1 ring-slate-200">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Employées disponibles
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">
                      {feasibility.availableEmployees.length > 0
                        ? feasibility.availableEmployees
                            .map((employee) => employee.name)
                            .join(", ")
                        : "Aucune sur toute la nouvelle plage"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white/80 p-3 ring-1 ring-slate-200">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Salle
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">
                      {!feasibility.requiredRoomType
                        ? "Aucune salle requise"
                        : feasibility.availableRooms.length > 0
                          ? feasibility.availableRooms
                              .map((room) => room.name)
                              .join(", ")
                          : "Aucune salle compatible disponible"}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-xs leading-5 text-slate-600">
                  La disponibilité est revérifiée par le serveur au moment de
                  l’ajout et de l’affectation afin d’éviter qu’une réservation
                  concurrente crée un surbooking.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-semibold text-slate-950">Historique</h2>
        <p className="mt-1 text-sm text-slate-600">
          Qui a fait quoi sur ce rendez-vous.
        </p>

        {detail.history.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Aucune action tracée pour le moment.
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {detail.history.map((item) => (
              <li
                key={item.id}
                className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-violet-600" />
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {item.description}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {dateTime(item.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold text-slate-950">Paiement</h2>

          {detail.payment?.status === "PAID" ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="font-semibold text-emerald-900">
                Espèces encaissées : {money(detail.payment.amount)}
              </p>
              {detail.payment.paidAt ? (
                <p className="mt-1 text-sm text-emerald-800">
                  {dateTime(detail.payment.paidAt)}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-[220px_auto] sm:items-end">
              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-800">
                  Montant réellement encaissé (MAD)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  value={paymentAmount}
                  disabled={
                    !detail.canRecordPayment ||
                    detail.status !== "COMPLETED" ||
                    pending
                  }
                  onChange={(event) =>
                    setPaymentAmountOverride(event.target.value)
                  }
                />
              </label>
              <button
                type="button"
                disabled={
                  pending ||
                  !detail.canRecordPayment ||
                  detail.status !== "COMPLETED" ||
                  !Number.isFinite(Number(paymentAmount)) ||
                  Number(paymentAmount) < 0
                }
                className={`${buttonClass} bg-emerald-700 text-white hover:bg-emerald-800`}
                onClick={() =>
                  run(
                    () =>
                      markAppointmentPaidAction({
                        appointmentId: detail.id,
                        amount: Number(paymentAmount),
                      }),
                    "Paiement enregistré.",
                  )
                }
              >
                Espèces encaissées
              </button>
            </div>
          )}

          {detail.status !== "COMPLETED" &&
          detail.payment?.status !== "PAID" ? (
            <p className="mt-3 text-sm text-slate-600">
              Le paiement devient disponible lorsque toutes les prestations sont
              terminées.
            </p>
          ) : null}
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Finalisation</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Toutes les prestations doivent être terminées et le paiement
            encaissé avant la clôture.
          </p>
          <button
            type="button"
            disabled={
              pending ||
              !detail.canManageAppointment ||
              detail.status !== "COMPLETED" ||
              detail.payment?.status !== "PAID" ||
              !allDone
            }
            className={`${buttonClass} mt-4 w-full bg-slate-950 text-white hover:bg-slate-800`}
            onClick={() =>
              run(
                () =>
                  closeAppointmentAction({
                    appointmentId: detail.id,
                  }),
                "Rendez-vous clôturé.",
              )
            }
          >
            Clôturer le rendez-vous
          </button>

          {detail.canManageAppointment && detail.status === "PLANNED" ? (
            <button
              type="button"
              disabled={pending}
              className={`${buttonClass} mt-3 w-full border border-red-300 bg-white text-red-700 hover:bg-red-50`}
              onClick={() => {
                if (!window.confirm("Annuler définitivement ce rendez-vous ?"))
                  return;
                run(
                  () =>
                    cancelAppointmentAction({
                      appointmentId: detail.id,
                    }),
                  "Rendez-vous annulé.",
                );
              }}
            >
              Annuler le rendez-vous
            </button>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
