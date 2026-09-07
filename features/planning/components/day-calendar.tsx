"use client";

import Link from "next/link";
import { CircleAlert, Clock3, DoorOpen, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatPlanningTime } from "@/features/planning/components/planning-formatters";
import type {
  PlanningAppointmentItem,
  PlanningEmployeeItem,
  PlanningRoomItem,
} from "@/features/planning/server";

type Props = {
  dateKey: string;
  mode: "appointments" | "employees" | "rooms";
  appointments: PlanningAppointmentItem[];
  employees: PlanningEmployeeItem[];
  rooms: PlanningRoomItem[];
};

type PositionedAppointment = {
  appointment: PlanningAppointmentItem;
  lane: number;
  laneCount: number;
};

const START_HOUR = 10;
const END_HOUR = 21;

// Salon ouvert de 10h à 21h. 112 px = 1 heure pour une lecture confortable.
const HOUR_HEIGHT = 112;
const CALENDAR_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
const BOTTOM_SPACE = 52;
const VIEWPORT_HEIGHT = CALENDAR_HEIGHT + BOTTOM_SPACE;
const CARD_GAP = 6;

function casablancaParts(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return {
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function minutesOf(value: string | Date) {
  return casablancaParts(value).minutes;
}

function topFor(value: string) {
  return ((minutesOf(value) - START_HOUR * 60) / 60) * HOUR_HEIGHT;
}

function rawHeightFor(start: string, end: string) {
  const startMinutes = minutesOf(start);
  const endMinutes = minutesOf(end);
  return ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;
}

function heightFor(start: string, end: string) {
  // On garde la proportion exacte de durée puis on retire un petit espace visuel
  // entre deux rendez-vous consécutifs. La position temporelle, elle, ne change pas.
  return Math.max(44, rawHeightFor(start, end) - CARD_GAP);
}

function statusClass(status: PlanningAppointmentItem["status"]) {
  if (status === "IN_PROGRESS") {
    return "border-amber-300 bg-amber-50/95 before:bg-amber-500";
  }
  if (status === "COMPLETED") {
    return "border-emerald-300 bg-emerald-50/95 before:bg-emerald-600";
  }
  if (status === "CLOSED") {
    return "border-slate-300 bg-slate-100/95 before:bg-slate-400";
  }
  return "border-violet-200 bg-violet-50/95 before:bg-violet-600";
}

function uniqueNames(values: Array<string | null | undefined>) {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
}

/**
 * Positionne uniquement les rendez-vous qui se chevauchent côte à côte.
 * Les employées ne sont PAS des colonnes dans la vue Planning.
 */
function layoutAppointments(
  appointments: PlanningAppointmentItem[],
): PositionedAppointment[] {
  const sorted = [...appointments].sort((a, b) => {
    const startDiff = minutesOf(a.scheduledStart) - minutesOf(b.scheduledStart);
    if (startDiff !== 0) return startDiff;
    return minutesOf(a.scheduledEnd) - minutesOf(b.scheduledEnd);
  });

  const result: PositionedAppointment[] = [];
  let index = 0;

  while (index < sorted.length) {
    const group: PlanningAppointmentItem[] = [sorted[index]];
    let groupEnd = minutesOf(sorted[index].scheduledEnd);
    let cursor = index + 1;

    // Un groupe contient tous les RDV reliés par un chevauchement temporel.
    while (
      cursor < sorted.length &&
      minutesOf(sorted[cursor].scheduledStart) < groupEnd
    ) {
      group.push(sorted[cursor]);
      groupEnd = Math.max(groupEnd, minutesOf(sorted[cursor].scheduledEnd));
      cursor += 1;
    }

    const laneEnds: number[] = [];
    const placed = group.map((appointment) => {
      const start = minutesOf(appointment.scheduledStart);
      const end = minutesOf(appointment.scheduledEnd);

      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(end);
      } else {
        laneEnds[lane] = end;
      }

      return { appointment, lane };
    });

    const laneCount = Math.max(1, laneEnds.length);
    result.push(
      ...placed.map(({ appointment, lane }) => ({
        appointment,
        lane,
        laneCount,
      })),
    );

    index = cursor;
  }

  return result;
}

function AppointmentStatusLegend() {
  const items = [
    {
      label: "Prévu",
      className: "border-violet-200 bg-violet-50",
      dotClassName: "bg-violet-600",
    },
    {
      label: "En cours",
      className: "border-amber-300 bg-amber-50",
      dotClassName: "bg-amber-500",
    },
    {
      label: "Terminé",
      className: "border-emerald-300 bg-emerald-50",
      dotClassName: "bg-emerald-600",
    },
    {
      label: "Clôturé",
      className: "border-slate-300 bg-slate-100",
      dotClassName: "bg-slate-400",
    },
  ] as const;

  return (
    <div
      aria-label="Légende des statuts de rendez-vous"
      className="flex flex-wrap items-center gap-2"
    >
      {items.map((item) => (
        <span
          key={item.label}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold text-slate-700 ${item.className}`}
        >
          <span className={`h-2 w-2 rounded-full ${item.dotClassName}`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function TimeGrid() {
  return (
    <>
      {Array.from({ length: (END_HOUR - START_HOUR) * 2 + 1 }, (_, index) => {
        const isHour = index % 2 === 0;
        return (
          <div
            key={index}
            className={`absolute inset-x-0 border-t ${
              isHour ? "border-slate-200" : "border-slate-100"
            }`}
            style={{ top: index * (HOUR_HEIGHT / 2) }}
          />
        );
      })}
    </>
  );
}

function TimeRail() {
  return (
    <div
      className="relative border-r border-slate-200 bg-white"
      style={{ height: VIEWPORT_HEIGHT }}
    >
      {Array.from(
        { length: END_HOUR - START_HOUR + 1 },
        (_, index) => START_HOUR + index,
      ).map((hour) => (
        <div
          key={hour}
          className="absolute right-3 -translate-y-2 text-xs font-medium text-slate-500"
          style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
        >
          {String(hour).padStart(2, "0")}:00
        </div>
      ))}
    </div>
  );
}

function NowLine({ top }: { top: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-40 border-t-2 border-red-500/80"
      style={{ top }}
    >
      <span className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-red-500" />
      <span className="absolute right-2 -top-3 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
        Maintenant
      </span>
    </div>
  );
}

function AppointmentCard({ item }: { item: PositionedAppointment }) {
  const { appointment, lane, laneCount } = item;
  const top = Math.max(0, topFor(appointment.scheduledStart));
  const height = Math.min(
    heightFor(appointment.scheduledStart, appointment.scheduledEnd),
    CALENDAR_HEIGHT - top,
  );

  const employees = uniqueNames(
    appointment.services.map((service) => service.assignedEmployee?.name),
  );
  const rooms = uniqueNames(
    appointment.services.map((service) => service.room?.name),
  );

  const widthPercent = 100 / laneCount;
  const leftPercent = lane * widthPercent;

  return (
    <Link
      href={`/appointments/${appointment.id}`}
      className={`absolute z-10 overflow-hidden rounded-2xl border shadow-sm transition before:absolute before:inset-y-0 before:left-0 before:w-1 hover:z-30 hover:-translate-y-px hover:shadow-md ${statusClass(
        appointment.status,
      )}`}
      style={{
        top,
        height,
        left: `calc(${leftPercent}% + ${lane === 0 ? 8 : 4}px)`,
        width: `calc(${widthPercent}% - 12px)`,
      }}
    >
      <div className="h-full min-w-0 overflow-y-auto px-3 py-2.5 pl-4 [scrollbar-width:thin]">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold leading-5 text-slate-950">
            {appointment.client.name}
          </p>
          {appointment.organizationIssues > 0 ? (
            <CircleAlert
              aria-label="À organiser"
              className="h-4 w-4 shrink-0 text-amber-700"
            />
          ) : null}
        </div>

        <div className="mt-1 space-y-0.5 text-xs leading-4 text-slate-700">
          {appointment.services.map((service) => (
            <p key={service.id} className="break-words">
              • {service.name}
            </p>
          ))}
        </div>

        <p className="mt-1 text-xs font-semibold text-slate-800">
          {formatPlanningTime(appointment.scheduledStart)} –{" "}
          {formatPlanningTime(appointment.scheduledEnd)}
        </p>

        {employees.length > 0 ? (
          <div className="mt-1.5 flex min-w-0 items-start gap-1.5 text-xs leading-4 text-slate-600">
            <UserRound
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              strokeWidth={1.8}
            />
            <span className="break-words">{employees.join(", ")}</span>
          </div>
        ) : null}

        {rooms.length > 0 ? (
          <div className="mt-1 flex min-w-0 items-start gap-1.5 text-xs leading-4 text-slate-600">
            <DoorOpen
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              strokeWidth={1.8}
            />
            <span className="break-words">{rooms.join(", ")}</span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}

function AppointmentsCalendar({
  appointments,
  showNow,
  nowTop,
}: {
  dateKey: string;
  appointments: PlanningAppointmentItem[];
  showNow: boolean;
  nowTop: number;
}) {
  const positioned = useMemo(
    () => layoutAppointments(appointments),
    [appointments],
  );

  return (
    <div className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:block">
      <div className="grid grid-cols-[82px_minmax(0,1fr)] border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="border-r border-slate-200 px-3 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Heure
        </div>
        <div className="flex flex-col gap-2 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="font-semibold text-slate-950">Rendez-vous</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Vue chronologique de la journée · les chevauchements sont affichés
              côte à côte
            </p>
          </div>
          <AppointmentStatusLegend />
        </div>
      </div>

      <div className="grid grid-cols-[82px_minmax(0,1fr)]">
        <TimeRail />

        <div
          className="relative min-w-0 bg-white"
          style={{ height: VIEWPORT_HEIGHT }}
        >
          <TimeGrid />
          {positioned.map((item) => (
            <AppointmentCard key={item.appointment.id} item={item} />
          ))}
          {showNow ? <NowLine top={nowTop} /> : null}
          <div
            className="absolute inset-x-0 border-t border-slate-200 bg-[#fcf9f7]/70"
            style={{ top: CALENDAR_HEIGHT, height: BOTTOM_SPACE }}
          >
            <span className="absolute right-4 top-3 text-[11px] font-medium text-slate-400">
              Fermeture · 21:00
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResourceCalendar({
  mode,
  appointments,
  employees,
  rooms,
  showNow,
  nowTop,
}: Omit<Props, "dateKey"> & {
  showNow: boolean;
  nowTop: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, left: 0 });
  }, [mode]);

  const columns = useMemo(() => {
    if (mode === "employees") {
      return employees.map((item) => {
        const completedServiceCount = appointments.reduce(
          (total, appointment) =>
            total +
            appointment.services.filter(
              (service) =>
                service.assignedEmployee?.id === item.id &&
                service.status === "DONE",
            ).length,
          0,
        );

        const appointmentCount = appointments.filter((appointment) =>
          appointment.services.some(
            (service) => service.assignedEmployee?.id === item.id,
          ),
        ).length;

        return {
          id: item.id,
          name: item.name,
          subtitle: `${appointmentCount} RDV`,
          badge: `${completedServiceCount} terminée${completedServiceCount > 1 ? "s" : ""}`,
        };
      });
    }

    return rooms.map((item) => {
      const appointmentCount = appointments.filter((appointment) =>
        appointment.services.some((service) => service.room?.id === item.id),
      ).length;

      return {
        id: item.id,
        name: item.name,
        subtitle: item.type === "HAMAM" ? "Hamam" : "Salle de soins",
        badge: `${appointmentCount} RDV`,
      };
    });
  }, [appointments, employees, mode, rooms]);

  const entriesFor = (columnId: string) =>
    appointments.filter((appointment) => {
      if (mode === "employees") {
        return appointment.services.some(
          (service) => service.assignedEmployee?.id === columnId,
        );
      }

      return appointment.services.some(
        (service) => service.room?.id === columnId,
      );
    });

  if (columns.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
        Aucune ressource active à afficher.
      </div>
    );
  }

  const minWidth = Math.max(900, 92 + columns.length * 248);

  return (
    <div className="hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:block">
      <div
        ref={scrollRef}
        className="max-h-[calc(100vh-190px)] min-h-[620px] overflow-auto rounded-3xl [scrollbar-gutter:stable]"
      >
        <div style={{ minWidth }}>
          <div
            className="sticky top-0 z-40 grid border-b border-slate-200 bg-[#fffaf8]/98 shadow-[0_2px_10px_rgba(48,38,41,0.04)] backdrop-blur"
            style={{
              gridTemplateColumns: `92px repeat(${columns.length}, minmax(230px, 1fr))`,
            }}
          >
            <div className="sticky left-0 z-50 flex items-center border-r border-slate-200 bg-[#fffaf8] px-3 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Heure
            </div>

            {columns.map((column) => (
              <div
                key={column.id}
                className="min-w-0 border-r border-slate-100 px-4 py-3.5 last:border-r-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-950">
                      {column.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {column.subtitle}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-800 ring-1 ring-violet-100">
                    {column.badge}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div
            className="grid"
            style={{
              gridTemplateColumns: `92px repeat(${columns.length}, minmax(230px, 1fr))`,
            }}
          >
            <div className="sticky left-0 z-30 bg-white">
              <TimeRail />
            </div>

            {columns.map((column) => (
              <div
                key={column.id}
                className="relative border-r border-slate-100 bg-white last:border-r-0"
                style={{ height: VIEWPORT_HEIGHT }}
              >
                <TimeGrid />

                {entriesFor(column.id).map((appointment) => {
                  const top = Math.max(0, topFor(appointment.scheduledStart));
                  const height = Math.min(
                    heightFor(
                      appointment.scheduledStart,
                      appointment.scheduledEnd,
                    ),
                    CALENDAR_HEIGHT - top,
                  );

                  const relevantServices = appointment.services.filter(
                    (service) =>
                      mode === "employees"
                        ? service.assignedEmployee?.id === column.id
                        : service.room?.id === column.id,
                  );

                  return (
                    <Link
                      key={appointment.id}
                      href={`/appointments/${appointment.id}`}
                      className={`absolute left-2.5 right-2.5 z-10 overflow-hidden rounded-2xl border shadow-sm transition before:absolute before:inset-y-0 before:left-0 before:w-1 hover:z-30 hover:-translate-y-px hover:shadow-md ${statusClass(
                        appointment.status,
                      )}`}
                      style={{ top, height }}
                    >
                      <div className="h-full overflow-y-auto px-3 py-2.5 pl-4 [scrollbar-width:thin]">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 text-sm font-bold leading-5 text-slate-950">
                            {appointment.client.name}
                          </p>
                          {appointment.organizationIssues > 0 ? (
                            <CircleAlert
                              aria-label="À organiser"
                              className="h-4 w-4 shrink-0 text-amber-700"
                            />
                          ) : null}
                        </div>

                        <p className="mt-0.5 text-[11px] font-semibold text-slate-600">
                          {formatPlanningTime(appointment.scheduledStart)} –{" "}
                          {formatPlanningTime(appointment.scheduledEnd)}
                        </p>

                        {height >= 66 ? (
                          <div className="mt-1.5 space-y-0.5 text-xs leading-4 text-slate-700">
                            {relevantServices.map((service) => (
                              <p key={service.id} className="break-words">
                                • {service.name}
                              </p>
                            ))}
                          </div>
                        ) : null}

                        {mode === "rooms" && height >= 92 ? (
                          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                            <UserRound className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                              {uniqueNames(
                                relevantServices.map(
                                  (service) => service.assignedEmployee?.name,
                                ),
                              ).join(", ") || "À affecter"}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </Link>
                  );
                })}

                {showNow ? <NowLine top={nowTop} /> : null}

                <div
                  className="absolute inset-x-0 border-t border-slate-200 bg-[#fcf9f7]/70"
                  style={{ top: CALENDAR_HEIGHT, height: BOTTOM_SPACE }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
        <span>Début du planning : 10:00</span>
        <span>Fermeture : 21:00</span>
      </div>
    </div>
  );
}

export function DayCalendar({
  dateKey,
  mode,
  appointments,
  employees,
  rooms,
}: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const nowParts = casablancaParts(now);
  const showNow =
    nowParts.dateKey === dateKey &&
    nowParts.minutes >= START_HOUR * 60 &&
    nowParts.minutes <= END_HOUR * 60;
  const nowTop = ((nowParts.minutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Clock3 className="h-4 w-4 text-violet-700" />
        <span>
          Salon ouvert de 10h à 21h · la hauteur des blocs représente la durée
          réelle des rendez-vous.
        </span>
      </div>

      {mode === "appointments" ? (
        <AppointmentsCalendar
          dateKey={dateKey}
          appointments={appointments}
          showNow={showNow}
          nowTop={nowTop}
        />
      ) : (
        <ResourceCalendar
          mode={mode}
          appointments={appointments}
          employees={employees}
          rooms={rooms}
          showNow={showNow}
          nowTop={nowTop}
        />
      )}

      <div className="space-y-3 md:hidden">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Planning du jour
        </p>
        {appointments.map((appointment) => (
          <Link
            key={appointment.id}
            href={`/appointments/${appointment.id}`}
            className={`block rounded-2xl border p-4 shadow-sm ${statusClass(
              appointment.status,
            )}`}
          >
            <div className="flex items-start justify-between gap-3">
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
              <span className="shrink-0 text-sm font-semibold text-slate-800">
                {formatPlanningTime(appointment.scheduledStart)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
