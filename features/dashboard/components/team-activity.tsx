"use client";

import { CheckCircle2, UserRound } from "lucide-react";
import { useState } from "react";

type ActivityItem = {
  employeeId: string;
  name: string;
  completedServices: number;
};

type TeamActivityProps = {
  activity: {
    today: ActivityItem[];
    week: ActivityItem[];
    month: ActivityItem[];
  };
};

type Period = keyof TeamActivityProps["activity"];

const periods: Array<{ key: Period; label: string }> = [
  { key: "today", label: "Aujourd’hui" },
  { key: "week", label: "Cette semaine" },
  { key: "month", label: "Ce mois" },
];

export function TeamActivity({ activity }: TeamActivityProps) {
  const [period, setPeriod] = useState<Period>("today");
  const items = activity[period];
  const max = Math.max(1, ...items.map((item) => item.completedServices));

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-violet-700" strokeWidth={1.8} />
            <h2 className="text-xl font-semibold text-slate-950">
              Activité de l’équipe
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Nombre de prestations réellement terminées dans SalonFlow. Aucun
            montant n’est affiché ici.
          </p>
        </div>

        <div className="flex w-full gap-1 rounded-2xl bg-slate-100 p-1 lg:w-auto">
          {periods.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setPeriod(item.key)}
              className={`min-h-9 flex-1 whitespace-nowrap rounded-xl px-3 text-xs font-semibold transition lg:flex-none ${
                period === item.key
                  ? "bg-white text-violet-800 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600 ring-1 ring-slate-200">
          Aucune prestation terminée sur cette période.
        </div>
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.employeeId}
              className="rounded-2xl border border-slate-200 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <CheckCircle2
                    className="h-4 w-4 shrink-0 text-emerald-700"
                    strokeWidth={1.8}
                  />
                  <p className="truncate font-semibold text-slate-900">
                    {item.name}
                  </p>
                </div>
                <span className="shrink-0 text-lg font-bold text-violet-800">
                  {item.completedServices}
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-violet-500 transition-[width]"
                  style={{
                    width: `${Math.max(8, (item.completedServices / max) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {item.completedServices} prestation
                {item.completedServices > 1 ? "s" : ""} terminée
                {item.completedServices > 1 ? "s" : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
