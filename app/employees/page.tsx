import Link from "next/link";
import { redirect } from "next/navigation";

import { getEmployees } from "@/features/employees/server";
import { EmployeesAdmin } from "@/features/employees/server/components/employees-admin";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { getCurrentUser } from "@/server/auth/get-current-user";

export default async function EmployeesPage() {
  const currentUser = await getCurrentUser();
  const user = await getAuthoritativeCurrentUser(currentUser);

  if (user.role !== "ADMIN") {
    redirect("/planning");
  }

  const employeeData = await getEmployees(user);

  return (
    <main className="min-h-screen bg-[#fcf9f7]">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-6">
          <Link
            href="/planning"
            className="text-sm font-semibold text-slate-600 hover:text-slate-950"
          >
            ← Retour au planning
          </Link>
          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.16em] text-violet-600">
            SalonFlow
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Équipe
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Employées, accès individuels et gestion opérationnelle.
              </p>
            </div>
            <Link
              href="/employees/unavailability"
              className="rounded-xl border border-violet-300 bg-white px-4 py-2.5 text-sm font-semibold text-violet-800 hover:bg-violet-50"
            >
              Gérer les indisponibilités
            </Link>
          </div>
        </header>
        <EmployeesAdmin {...employeeData} />
      </div>
    </main>
  );
}
