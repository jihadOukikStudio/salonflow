"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MapPin,
  Play,
  Sparkles,
  UserRoundPlus,
} from "lucide-react";

import type { MyDayData, MyDayService } from "@/features/my-day/server";
import { selectCurrentAndNextServices } from "@/features/my-day/lib/my-day-state";
import {
  completeAppointmentServiceAction,
  startAppointmentServiceAction,
  takeUnassignedServiceAction,
} from "@/features/appointments/server/actions/service-actions";

function time(value: string) {
  return new Intl.DateTimeFormat("fr-MA", {
    timeZone: "Africa/Casablanca",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function longDate(dateKey: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

function statusLabel(status: MyDayService["status"]) {
  return { TODO: "À faire", IN_PROGRESS: "En cours", DONE: "Terminée" }[status];
}

function statusClass(status: MyDayService["status"]) {
  return {
    TODO: "bg-violet-50 text-violet-700 ring-violet-100",
    IN_PROGRESS: "bg-amber-50 text-amber-800 ring-amber-100",
    DONE: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  }[status];
}

export function MyDayClient({ data }: { data: MyDayData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const { current, next } = useMemo(
    () => selectCurrentAndNextServices(data.services),
    [data.services],
  );
  const doneCount = data.services.filter(
    (service) => service.status === "DONE",
  ).length;

  function run(
    action: () => Promise<
      { ok: true; data: unknown } | { ok: false; message: string; code: string }
    >,
    successMessage: string,
  ) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setMessage("message" in result ? result.message : "Action impossible.");
        return;
      }
      setMessage(successMessage);
      router.refresh();
    });
  }

  function actionButton(service: MyDayService) {
    if (service.status === "TODO") {
      return (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                startAppointmentServiceAction({
                  appointmentServiceId: service.id,
                }),
              "Prestation démarrée.",
            )
          }
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-50"
        >
          <Play className="h-4 w-4" /> Démarrer
        </button>
      );
    }

    if (service.status === "IN_PROGRESS") {
      return (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                completeAppointmentServiceAction({
                  appointmentServiceId: service.id,
                }),
              "Prestation terminée.",
            )
          }
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" /> Terminer
        </button>
      );
    }

    return null;
  }

  const focusService =
    data.services.find((service) => service.id === current?.id) ?? null;
  const nextService =
    data.services.find((service) => service.id === next?.id) ?? null;

  return (
    <div className="space-y-5">
      {message ? (
        <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-900">
          {message}
        </div>
      ) : null}

      <section className="rounded-3xl bg-gradient-to-br from-violet-700 to-violet-500 p-5 text-white shadow-lg shadow-violet-100 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-100">
              Ma journée
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Bonjour {data.employeeName.split(" ")[0]}
            </h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-violet-100">
              <CalendarDays className="h-4 w-4" />
              <span className="capitalize">{longDate(data.dateKey)}</span>
            </p>
          </div>
          <div className="rounded-2xl bg-white/15 px-3 py-2 text-right backdrop-blur">
            <p className="text-xl font-bold tabular-nums">
              {doneCount}/{data.services.length}
            </p>
            <p className="text-[11px] font-semibold text-violet-100">
              terminées
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Maintenant
          </h2>
        </div>
        {focusService ? (
          <div className="rounded-3xl border border-violet-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-bold tabular-nums text-slate-950">
                  {time(focusService.scheduledStart)}
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {focusService.clientName}
                </p>
                <p className="mt-1 text-sm font-semibold text-violet-700">
                  {focusService.serviceName}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusClass(focusService.status)}`}
              >
                {statusLabel(focusService.status)}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" />
                {focusService.durationMinutes} min
              </span>
              {focusService.roomName ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {focusService.roomName}
                </span>
              ) : null}
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
              {actionButton(focusService)}
              <Link
                href={`/appointments/${focusService.appointmentId}`}
                className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Voir le RDV <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-semibold text-emerald-800">
            ✓ Aucune prestation en attente pour le moment.
          </div>
        )}
      </section>

      {nextService ? (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Ensuite
          </h2>
          <Link
            href={`/appointments/${nextService.appointmentId}`}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-violet-200 hover:bg-violet-50/40"
          >
            <div className="min-w-14 text-lg font-bold tabular-nums text-slate-950">
              {time(nextService.scheduledStart)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-950">
                {nextService.clientName}
              </p>
              <p className="truncate text-sm text-slate-600">
                {nextService.serviceName}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
          </Link>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Ma journée</h2>
            <p className="text-xs text-slate-500">
              {data.services.length} prestation
              {data.services.length > 1 ? "s" : ""} · {doneCount} terminée
              {doneCount > 1 ? "s" : ""}
            </p>
          </div>
          <Link
            href="/planning"
            className="text-xs font-bold text-violet-700 hover:text-violet-900"
          >
            Planning complet
          </Link>
        </div>
        <div className="space-y-2">
          {data.services.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
              Aucune prestation affectée aujourd’hui.
            </div>
          ) : (
            data.services.map((service) => (
              <div
                key={service.id}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="w-14 shrink-0 text-sm font-bold tabular-nums text-slate-950">
                  {time(service.scheduledStart)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-950">
                    {service.serviceName}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {service.clientName}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ring-1 ${statusClass(service.status)}`}
                >
                  {statusLabel(service.status)}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {data.takeableServices.length > 0 ? (
        <details className="group rounded-3xl border border-amber-200 bg-amber-50/70 p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-amber-950">
                Prestations à prendre
              </p>
              <p className="text-xs text-amber-700">
                {data.takeableServices.length} compatible
                {data.takeableServices.length > 1 ? "s" : ""} avec vos
                compétences
              </p>
            </div>
            <UserRoundPlus className="h-5 w-5 text-amber-700" />
          </summary>
          <div className="mt-4 space-y-2">
            {data.takeableServices.map((service) => (
              <div
                key={service.id}
                className="rounded-2xl bg-white p-3 ring-1 ring-amber-100"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-950">
                      {time(service.scheduledStart)} · {service.serviceName}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {service.clientName}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () =>
                          takeUnassignedServiceAction({
                            appointmentServiceId: service.id,
                          }),
                        "Prestation ajoutée à votre journée.",
                      )
                    }
                    className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-amber-600 px-3 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    Prendre
                  </button>
                </div>
                <p className="mt-2 text-[11px] leading-4 text-amber-800">
                  SalonFlow vérifie la disponibilité au moment de la prise.
                </p>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <div className="flex items-center justify-center gap-2 pb-4 text-xs text-slate-400">
        <Sparkles className="h-3.5 w-3.5" /> SalonFlow · Le 7ème Sens
      </div>
    </div>
  );
}
