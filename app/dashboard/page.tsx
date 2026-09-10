import Link from "next/link";
import { LayoutDashboard, Plus } from "lucide-react";
import { redirect } from "next/navigation";

import { Dashboard } from "@/features/dashboard/components/dashboard";
import { canAccessDashboard } from "@/features/dashboard/lib/access";
import { getDashboard } from "@/features/dashboard/server";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { getCurrentUser } from "@/server/auth/get-current-user";

export default async function DashboardPage() {
  const currentUser = await getCurrentUser();
  const user = await getAuthoritativeCurrentUser(currentUser);

  if (!canAccessDashboard(user)) redirect("/planning");

  const data = await getDashboard(user);

  return (
    <main className="min-h-screen bg-[#fcf9f6] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
      <div className="mx-auto w-full max-w-[1500px]">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-violet-700">
              <LayoutDashboard className="h-4 w-4" strokeWidth={1.8} />
              <p className="text-sm font-semibold uppercase tracking-[0.16em]">
                SalonFlow
              </p>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              État du salon
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              L’essentiel de la journée, l’activité de l’équipe et les
              ressources disponibles.
            </p>
          </div>
          <Link
            href="/planning?new=1"
            className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 font-semibold text-white shadow-sm transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 sm:w-auto"
          >
            <Plus className="h-4 w-4" /> Nouveau rendez-vous
          </Link>
        </header>
        <Dashboard data={data} />
      </div>
    </main>
  );
}
