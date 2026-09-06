import Link from "next/link";
import { Plus } from "lucide-react";

import {
  PlanningDateNavigation,
  PlanningQuickNav,
  PlanningSummary,
  PlanningViewTabs,
} from "@/features/planning/components";
import { DayCalendar } from "@/features/planning/components/day-calendar";
import {
  getPlanningDay,
  parsePlanningDate,
  parsePlanningView,
} from "@/features/planning/server";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { getCurrentUser } from "@/server/auth/get-current-user";

type PlanningPageProps = {
  searchParams: Promise<{
    date?: string;
    view?: string;
  }>;
};

export default async function PlanningPage({
  searchParams,
}: PlanningPageProps) {
  const currentUser = await getCurrentUser();
  const user = await getAuthoritativeCurrentUser(currentUser);
  const params = await searchParams;
  const dateKey = parsePlanningDate(params.date);
  const view = parsePlanningView(params.view);
  const planning = await getPlanningDay(user, dateKey);
  const canManageSalon = user.role === "ADMIN" || user.canManageSalon;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-700">
              SalonFlow
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
              Planning / Cockpit
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Rendez-vous, équipe et salles du salon dans une vue opérationnelle
              unique.
            </p>
          </div>

          {canManageSalon ? (
            <Link
              href="/appointments/new"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
            >
              <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={1.9} />
              Nouveau rendez-vous
            </Link>
          ) : null}
        </header>

        <PlanningQuickNav
          role={user.role}
          canManageSalon={user.canManageSalon}
          current="planning"
        />

        <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)]">
          <PlanningDateNavigation dateKey={planning.dateKey} />
          <PlanningSummary
            appointmentCount={planning.appointmentCount}
            organizationIssues={planning.organizationIssues}
            inProgressCount={planning.inProgressCount}
            completedCount={planning.completedCount}
          />
        </section>

        <div className="mt-5">
          <PlanningViewTabs dateKey={planning.dateKey} view={view} />
        </div>

        <section className="mt-5">
          <DayCalendar
            dateKey={planning.dateKey}
            mode={view === "employees" ? "employees" : view === "rooms" ? "rooms" : "appointments"}
            appointments={planning.appointments}
            employees={planning.employees}
            rooms={planning.rooms}
          />
        </section>
      </div>
    </main>
  );
}

