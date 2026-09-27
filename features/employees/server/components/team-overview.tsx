import Link from "next/link";
import type { getTeamOverview } from "../get-team-overview";

export function TeamOverview({
  employees,
}: {
  employees: Awaited<ReturnType<typeof getTeamOverview>>;
}) {
  return (
    <section>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-950">Équipe</h1>
          <p className="mt-2 text-sm text-slate-600">
            Consultez l’équipe et gérez ses indisponibilités. Les comptes et les
            droits sont gérés par les gérantes.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {employees.filter((employee) => employee.isActive).length} employées
            actives
          </p>
        </div>
        <Link
          href="/employees/unavailability"
          className="inline-flex min-h-11 items-center rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Gérer les indisponibilités
        </Link>
      </header>
      {employees.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">
          Aucune employée dans ce salon.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {employees.map((employee) => (
            <li
              key={employee.id}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="break-words font-semibold text-slate-950">
                  {[employee.firstName, employee.lastName]
                    .filter(Boolean)
                    .join(" ")}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${employee.isActive ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
                >
                  {employee.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-2 break-words text-sm text-slate-600">
                {employee.phone || "Téléphone non renseigné"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
