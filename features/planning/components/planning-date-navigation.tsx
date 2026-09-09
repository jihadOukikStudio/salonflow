import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock3 } from "lucide-react";

import { PlanningDatePicker } from "@/features/planning/components/planning-date-picker";
import {
  parsePlanningDate,
  shiftPlanningDate,
} from "@/features/planning/server/casablanca-day";

type PlanningDateNavigationProps = {
  dateKey: string;
  view?: "planning" | "employees" | "rooms";
  period?: "day" | "week" | "month";
};

export function PlanningDateNavigation({
  dateKey,
  view = "planning",
  period = "day",
}: PlanningDateNavigationProps) {
  const moveMonth = (offset: number) => {
    const source = new Date(`${dateKey}T12:00:00.000Z`);
    const target = new Date(
      Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + offset, 1, 12),
    );
    const year = target.getUTCFullYear();
    const month = String(target.getUTCMonth() + 1).padStart(2, "0");
    return `${year}-${month}-01`;
  };

  const previous =
    period === "month"
      ? moveMonth(-1)
      : shiftPlanningDate(dateKey, period === "week" ? -7 : -1);
  const next =
    period === "month"
      ? moveMonth(1)
      : shiftPlanningDate(dateKey, period === "week" ? 7 : 1);

  const formattedDate = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    weekday: period === "day" ? "long" : undefined,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dateKey}T12:00:00.000Z`));

  const today = parsePlanningDate(undefined);
  const makeHref = (date: string) =>
    `/planning?date=${date}&view=${view}&period=${period}`;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Link
          href={makeHref(previous)}
          aria-label="Période précédente"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <ChevronLeft
            aria-hidden="true"
            className="h-5 w-5"
            strokeWidth={1.8}
          />
        </Link>

        <PlanningDatePicker
          dateKey={dateKey}
          formattedDate={formattedDate}
          view={view}
          period={period}
        />

        <Link
          href={makeHref(next)}
          aria-label="Période suivante"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <ChevronRight
            aria-hidden="true"
            className="h-5 w-5"
            strokeWidth={1.8}
          />
        </Link>
      </div>

      {dateKey !== today ? (
        <Link
          href={makeHref(today)}
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 px-3 text-sm font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-100"
        >
          Aujourd’hui
        </Link>
      ) : (
        <a
          href="#planning-now"
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
        >
          <Clock3 aria-hidden="true" className="h-4 w-4" strokeWidth={1.9} />
          Maintenant
        </a>
      )}
    </div>
  );
}
