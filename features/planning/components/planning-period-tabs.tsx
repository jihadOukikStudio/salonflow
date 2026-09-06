import Link from "next/link";

export type PlanningPeriod = "day" | "week" | "month";

type Props = {
  dateKey: string;
  period: PlanningPeriod;
};

const items: Array<{ value: PlanningPeriod; label: string }> = [
  { value: "day", label: "Jour" },
  { value: "week", label: "Semaine" },
  { value: "month", label: "Mois" },
];

export function PlanningPeriodTabs({ dateKey, period }: Props) {
  return (
    <nav
      aria-label="Période du planning"
      className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
    >
      {items.map((item) => {
        const active = item.value === period;
        return (
          <Link
            key={item.value}
            href={`/planning?date=${dateKey}&view=planning&period=${item.value}`}
            aria-current={active ? "page" : undefined}
            className={`min-w-[84px] rounded-xl px-4 py-2 text-center text-sm font-semibold transition ${
              active
                ? "bg-violet-100 text-violet-900 ring-1 ring-violet-200"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
