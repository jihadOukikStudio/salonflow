import Link from "next/link";
import { CalendarDays, DoorOpen, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { PlanningView } from "@/features/planning/server";

type PlanningViewTabsProps = {
  dateKey: string;
  view: PlanningView;
};

const tabs: Array<{ value: PlanningView; label: string; icon: LucideIcon }> = [
  { value: "planning", label: "Planning", icon: CalendarDays },
  { value: "employees", label: "Employées", icon: UsersRound },
  { value: "rooms", label: "Salles", icon: DoorOpen },
];

export function PlanningViewTabs({ dateKey, view }: PlanningViewTabsProps) {
  return (
    <nav
      aria-label="Vue du planning"
      className="flex w-full gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
    >
      {tabs.map((tab) => {
        const active = tab.value === view;
        const Icon = tab.icon;

        return (
          <Link
            key={tab.value}
            href={`/planning?date=${dateKey}&view=${tab.value}`}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-center text-sm font-semibold transition ${
              active
                ? "bg-violet-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`}
          >
            <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
