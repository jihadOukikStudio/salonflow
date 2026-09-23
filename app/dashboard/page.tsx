import Link from "next/link";
import { ArrowRight, LayoutDashboard } from "lucide-react";
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
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-violet-700">
              <LayoutDashboard className="h-4 w-4" strokeWidth={1.8} />
              <p className="text-sm font-semibold uppercase tracking-[0.16em]">SalonFlow</p>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Bonjour 👋</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">Voici l’essentiel du salon aujourd’hui.</p>
          </div>
          <Link href="/planning" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-violet-300 hover:bg-violet-50">
            Voir le planning <ArrowRight className="h-4 w-4" />
          </Link>
        </header>
        <Dashboard data={data} />
      </div>
    </main>
  );
}
