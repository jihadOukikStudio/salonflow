import Link from "next/link";
import { redirect } from "next/navigation";

import { EmployeeUnavailabilityAdmin } from "@/features/unavailability/components/employee-unavailability-admin";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { getCurrentUser } from "@/server/auth/get-current-user";
import { getEmployeeUnavailabilityPage } from "@/server/services/unavailability";

export default async function EmployeeUnavailabilityPage() {
  const currentUser = await getCurrentUser();
  const user = await getAuthoritativeCurrentUser(currentUser);

  if (user.role !== "ADMIN" && !user.canManageSalon) {
    redirect("/planning");
  }

  const data = await getEmployeeUnavailabilityPage(user);

  return (
    <main className="min-h-screen bg-[#fcf9f7]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-6">
          <Link
            href={user.role === "ADMIN" ? "/employees" : "/planning"}
            className="text-sm font-semibold text-slate-600"
          >
            {user.role === "ADMIN"
              ? "← Retour à l’équipe"
              : "← Retour au planning"}
          </Link>
          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.16em] text-violet-600">
            SalonFlow
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">
            Indisponibilités équipe
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Absence, pause, congé ou indisponibilité ponctuelle. Les conflits
            avec les rendez-vous sont bloqués côté serveur.
          </p>
        </header>
        <EmployeeUnavailabilityAdmin {...data} />
      </div>
    </main>
  );
}
