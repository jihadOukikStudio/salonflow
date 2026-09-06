import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { shiftPlanningDate } from "@/features/planning/server/casablanca-day";

type PlanningDateNavigationProps = {
  dateKey: string;
};

export function PlanningDateNavigation({
  dateKey,
}: PlanningDateNavigationProps) {
  const previous = shiftPlanningDate(dateKey, -1);
  const next = shiftPlanningDate(dateKey, 1);

  const formattedDate = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dateKey}T12:00:00.000Z`));

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/planning?date=${previous}`}
        aria-label="Jour précédent"
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
        href={`/planning?date=${next}`}
        aria-label="Jour suivant"
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      >
        <ChevronRight aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
      </Link>
    </div>
  );
}

