import { redirect } from "next/navigation";
import { LayoutDashboard } from "lucide-react";

import { Dashboard } from "@/features/dashboard/components/dashboard";
import { canAccessDashboard } from "@/features/dashboard/lib/access";
import { getDashboard } from "@/features/dashboard/server";
import { PlanningQuickNav } from "@/features/planning/components";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { getCurrentUser } from "@/server/auth/get-current-user";

export default async function DashboardPage() {
  const currentUser = await getCurrentUser();
  const user = await getAuthoritativeCurrentUser(currentUser);

  if (!canAccessDashboard(user)) {
    redirect("/planning");
  }

  const data = await getDashboard(user);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <header className="mb-5">
          <div className="flex items-center gap-2 text-violet-700">
            <LayoutDashboard className="h-4 w-4" strokeWidth={1.8} />
            <p className="text-sm font-semibold uppercase tracking-[0.16em]">SalonFlow</p>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">État du salon</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">L’essentiel de la journée, maintenant, sans quitter la vue opérationnelle.</p>
        </header>
        <PlanningQuickNav role={user.role} canManageSalon={user.canManageSalon} current="dashboard" />
        <div className="mt-6"><Dashboard data={data} /></div>
      </div>
    </main>
  );
}
