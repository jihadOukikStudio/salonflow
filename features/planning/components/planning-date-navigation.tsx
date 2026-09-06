import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { shiftPlanningDate } from "@/features/planning/server/casablanca-day";

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

  const makeHref = (date: string) =>
    `/planning?date=${date}&view=${view}&period=${period}`;

  return (
    <div className="flex items-center gap-2">
      <Link
        href={makeHref(previous)}
        aria-label="Période précédente"
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      >
        <ChevronLeft aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
      </Link>

      <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-center">
        <p className="truncate text-sm font-semibold capitalize text-slate-950">
          {formattedDate}
        </p>
      </div>

      <Link
        href={makeHref(next)}
        aria-label="Période suivante"
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      >
        <ChevronRight
          aria-hidden="true"
          className="h-5 w-5"
          strokeWidth={1.8}
        />
      </Link>
    </div>
  );
}
