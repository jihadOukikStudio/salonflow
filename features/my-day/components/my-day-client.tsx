"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  MessageSquareText,
  Play,
} from "lucide-react";
import { formatSalonDateTime } from "@/features/appointments/lib/casablanca-local-datetime";
import type { MyDayData, MyDayService } from "@/features/my-day/server";
import { serviceUi } from "@/features/ui/status-visuals";
import {
  completeAppointmentServiceAction,
  startAppointmentServiceAction,
  updateAppointmentServiceCommentAction,
} from "@/features/appointments/server/actions/service-actions";

function time(v: string) {
  return formatSalonDateTime(v, "fr-MA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function shift(key: string, n: number) {
  const d = new Date(`${key}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function longDate(key: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${key}T12:00:00.000Z`));
}
function badge(s: MyDayService["status"]) {
  return serviceUi(s);
}

export function MyDayClient({ data }: { data: MyDayData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      data.services.map((s) => [s.id, s.employeeComment ?? ""]),
    ),
  );
  function run(
    action: () => Promise<
      { ok: true; data: unknown } | { ok: false; message: string; code: string }
    >,
    ok: string,
  ) {
    setMessage(null);
    startTransition(async () => {
      const r = await action();
      if (!r.ok) {
        setMessage(r.message);
        return;
      }
      setMessage(ok);
      router.refresh();
    });
  }
  const nav = (key: string) => `/my-day?date=${key}`;
  return (
    <div className="space-y-5">
      {message ? (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3 text-sm font-semibold text-violet-900">
          {message}
        </div>
      ) : null}
      <section className="rounded-3xl bg-violet-700 p-5 text-white sm:p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-violet-100">
          Mon planning
        </p>
        <h1 className="mt-2 text-3xl font-semibold">
          Bonjour {data.employeeName.split(" ")[0]}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            className="rounded-xl bg-white/15 p-3"
            href={nav(shift(data.dateKey, -1))}
            aria-label="Jour précédent"
          >
            <ChevronLeft />
          </Link>
          <div className="min-w-0 flex-1 text-center capitalize">
            <CalendarDays className="mr-2 inline h-4 w-4" />
            {longDate(data.dateKey)}
          </div>
          <Link
            className="rounded-xl bg-white/15 p-3"
            href={nav(shift(data.dateKey, 1))}
            aria-label="Jour suivant"
          >
            <ChevronRight />
          </Link>
        </div>
        <div className="mt-3 flex justify-center">
          <input
            aria-label="Choisir une date"
            type="date"
            value={data.dateKey}
            onChange={(e) => router.push(nav(e.target.value))}
            className="min-h-11 rounded-xl bg-white px-3 text-base font-semibold text-slate-900"
          />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-950">
          Mon activité
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Jour", data.activity.day],
            ["Semaine", data.activity.week],
            ["Mois", data.activity.month],
          ].map(([label, v]) => {
            const a = v as MyDayData["activity"]["day"];
            return (
              <div
                key={label as string}
                className="rounded-2xl border bg-white p-3 text-center"
              >
                <p className="text-xs font-bold uppercase text-slate-500">
                  {label as string}
                </p>
                <p className="mt-1 text-2xl font-bold">{a.services}</p>
                <p className="text-xs text-slate-500">prestations</p>
                <p className="mt-1 text-xs font-semibold text-violet-700">
                  {a.appointments} RDV
                </p>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Seules les prestations terminées sont comptées.
        </p>
      </section>
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Prestations du jour</h2>
          <p className="text-sm text-slate-500">
            {data.services.length} prestation
            {data.services.length > 1 ? "s" : ""} affectée
            {data.services.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="space-y-3">
          {data.services.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-white p-6 text-center text-sm text-slate-500">
              Aucune prestation affectée ce jour.
            </div>
          ) : (
            data.services.map((s) => (
              <article
                key={s.id}
                className={`rounded-2xl border bg-white p-4 shadow-sm ${s.status === "IN_PROGRESS" ? "border-violet-200 ring-1 ring-violet-100" : s.status === "DONE" ? "border-emerald-200" : "border-sky-100"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold">
                      {time(s.scheduledStart)} · {s.serviceName}
                    </p>
                    <p className="mt-1 font-semibold text-slate-700">
                      {s.clientName}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>
                        <Clock3 className="mr-1 inline h-3.5 w-3.5" />
                        {s.durationMinutes} min
                      </span>
                      {s.roomName ? (
                        <span>
                          <MapPin className="mr-1 inline h-3.5 w-3.5" />
                          {s.roomName}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${badge(s.status).badge}`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${badge(s.status).dot}`}
                    />
                    {badge(s.status).label}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {s.status === "TODO" ? (
                    <button
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            startAppointmentServiceAction({
                              appointmentServiceId: s.id,
                            }),
                          "Prestation démarrée.",
                        )
                      }
                      className="min-h-11 rounded-xl bg-violet-700 px-4 text-sm font-bold text-white"
                    >
                      <Play className="mr-2 inline h-4 w-4" />
                      Démarrer
                    </button>
                  ) : null}
                  {s.status === "IN_PROGRESS" ? (
                    <button
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            completeAppointmentServiceAction({
                              appointmentServiceId: s.id,
                            }),
                          "Prestation terminée.",
                        )
                      }
                      className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white"
                    >
                      <CheckCircle2 className="mr-2 inline h-4 w-4" />
                      Terminer
                    </button>
                  ) : null}
                  <Link
                    href={`/appointments/${s.appointmentId}`}
                    className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold"
                  >
                    Voir le RDV
                  </Link>
                </div>
                <div className="mt-4 border-t pt-4">
                  <label className="text-sm font-semibold">
                    <MessageSquareText className="mr-1 inline h-4 w-4" />
                    Commentaire pour la gérante / encaissement
                    <textarea
                      maxLength={2000}
                      value={comments[s.id] ?? ""}
                      onChange={(e) =>
                        setComments((c) => ({ ...c, [s.id]: e.target.value }))
                      }
                      placeholder="Ex. la cliente a demandé une option supplémentaire…"
                      className="mt-2 min-h-20 w-full rounded-xl border border-slate-300 p-3 text-base font-normal"
                    />
                  </label>
                  <button
                    disabled={pending}
                    onClick={() =>
                      run(
                        () =>
                          updateAppointmentServiceCommentAction({
                            appointmentServiceId: s.id,
                            comment: comments[s.id]?.trim() || null,
                          }),
                        "Commentaire enregistré.",
                      )
                    }
                    className="mt-2 min-h-11 rounded-xl border border-violet-300 bg-violet-50 px-4 text-sm font-bold text-violet-800"
                  >
                    Enregistrer le commentaire
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
