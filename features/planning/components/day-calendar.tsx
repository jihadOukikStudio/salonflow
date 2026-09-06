"use client";

import Link from "next/link";
import { CircleAlert, Clock3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { formatPlanningTime } from "@/features/planning/components/planning-formatters";
import type { PlanningAppointmentItem, PlanningEmployeeItem, PlanningRoomItem } from "@/features/planning/server";

type Props = {
  dateKey: string;
  mode: "appointments" | "employees" | "rooms";
  appointments: PlanningAppointmentItem[];
  employees: PlanningEmployeeItem[];
  rooms: PlanningRoomItem[];
};

const START_HOUR = 8;
const END_HOUR = 21;
const HOUR_HEIGHT = 72;
const MINUTES = (END_HOUR - START_HOUR) * 60;

function casablancaParts(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return { dateKey: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

function topFor(value: string) {
  return ((casablancaParts(value).minutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
}
function heightFor(start: string, end: string) {
  const a = casablancaParts(start).minutes;
  const b = casablancaParts(end).minutes;
  return Math.max(34, ((b - a) / 60) * HOUR_HEIGHT);
}
function statusClass(status: PlanningAppointmentItem["status"]) {
  if (status === "IN_PROGRESS") return "border-amber-300 bg-amber-50";
  if (status === "COMPLETED") return "border-emerald-300 bg-emerald-50";
  if (status === "CLOSED") return "border-slate-300 bg-slate-100";
  return "border-violet-200 bg-violet-50";
}

export function DayCalendar({ dateKey, mode, appointments, employees, rooms }: Props) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const nowParts = casablancaParts(now);
  const showNow = nowParts.dateKey === dateKey && nowParts.minutes >= START_HOUR * 60 && nowParts.minutes <= END_HOUR * 60;
  const nowTop = ((nowParts.minutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;

  const columns = useMemo(() => {
    if (mode === "employees") return employees.map((item) => ({ id: item.id, name: item.name, subtitle: "Employée" }));
    if (mode === "rooms") return rooms.map((item) => ({ id: item.id, name: item.name, subtitle: item.type === "HAMAM" ? "Hamam" : "Salle de soins" }));
    return [{ id: "all", name: "Rendez-vous", subtitle: "Journée" }];
  }, [employees, mode, rooms]);

  const entriesFor = (columnId: string) => appointments.filter((appointment) => {
    if (mode === "appointments") return true;
    if (mode === "employees") return appointment.services.some((service) => service.assignedEmployee?.id === columnId);
    return appointment.services.some((service) => service.room?.id === columnId);
  });

  if (columns.length === 0) return <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">Aucune ressource active à afficher.</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-slate-600"><Clock3 className="h-4 w-4 text-violet-700" /><span>La hauteur des blocs représente la durée du rendez-vous.</span></div>
      <div className="hidden overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm md:block">
        <div style={{ minWidth: mode === "appointments" ? 620 : Math.max(760, 128 + columns.length * 210) }}>
          <div className="sticky top-0 z-20 grid border-b border-slate-200 bg-white/95 backdrop-blur" style={{ gridTemplateColumns: `88px repeat(${columns.length}, minmax(190px, 1fr))` }}>
            <div className="border-r border-slate-100 p-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Heure</div>
            {columns.map((column) => <div key={column.id} className="border-r border-slate-100 p-3 last:border-r-0"><p className="truncate font-semibold text-slate-950">{column.name}</p><p className="mt-0.5 text-xs text-slate-500">{column.subtitle}</p></div>)}
          </div>
          <div className="grid" style={{ gridTemplateColumns: `88px repeat(${columns.length}, minmax(190px, 1fr))` }}>
            <div className="relative border-r border-slate-100" style={{ height: MINUTES / 60 * HOUR_HEIGHT }}>
              {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => START_HOUR + index).map((hour) => <div key={hour} className="absolute right-3 -translate-y-2 text-xs font-medium text-slate-500" style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}>{String(hour).padStart(2, "0")}:00</div>)}
            </div>
            {columns.map((column) => (
              <div key={column.id} className="relative border-r border-slate-100 last:border-r-0" style={{ height: MINUTES / 60 * HOUR_HEIGHT }}>
                {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => <div key={index} className="absolute inset-x-0 border-t border-slate-100" style={{ top: index * HOUR_HEIGHT }} />)}
                {entriesFor(column.id).map((appointment) => {
                  const top = Math.max(0, topFor(appointment.scheduledStart));
                  const height = Math.min(heightFor(appointment.scheduledStart, appointment.scheduledEnd), MINUTES / 60 * HOUR_HEIGHT - top);
                  return <Link key={appointment.id} href={`/appointments/${appointment.id}`} className={`absolute left-2 right-2 z-10 overflow-hidden rounded-xl border p-2 shadow-sm transition hover:z-20 hover:shadow-md ${statusClass(appointment.status)}`} style={{ top, height }}>
                    <div className="flex items-start justify-between gap-2"><p className="truncate text-sm font-semibold text-slate-950">{appointment.client.name}</p>{appointment.organizationIssues > 0 ? <CircleAlert className="h-4 w-4 shrink-0 text-amber-700" /> : null}</div>
                    <p className="mt-0.5 text-xs font-semibold text-slate-700">{formatPlanningTime(appointment.scheduledStart)}–{formatPlanningTime(appointment.scheduledEnd)}</p>
                    {height >= 58 ? <p className="mt-1 line-clamp-2 text-xs text-slate-600">{appointment.services.map((service) => service.name).join(" · ")}</p> : null}
                  </Link>;
                })}
                {showNow ? <div className="pointer-events-none absolute inset-x-0 z-30 border-t-2 border-red-500" style={{ top: nowTop }}><span className="absolute -left-1 -top-1.5 h-3 w-3 rounded-full bg-red-500" /><span className="absolute right-2 -top-3 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Maintenant</span></div> : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Vue mobile simplifiée</p>
        {appointments.map((appointment) => <Link key={appointment.id} href={`/appointments/${appointment.id}`} className={`block rounded-2xl border p-4 shadow-sm ${statusClass(appointment.status)}`}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{appointment.client.name}</p><p className="mt-1 text-sm text-slate-600">{appointment.services.map((service) => service.name).join(" · ")}</p></div><span className="shrink-0 text-sm font-semibold text-slate-800">{formatPlanningTime(appointment.scheduledStart)}</span></div></Link>)}
      </div>
    </div>
  );
}
