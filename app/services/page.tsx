import Link from "next/link";
import { redirect } from "next/navigation";

import { ServiceCatalogForm } from "@/features/services/server/components/service-catalog-form";
import { getServiceCatalog } from "@/features/services/server/get-service-catalog";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { getCurrentUser } from "@/server/auth/get-current-user";

export default async function ServicesPage() {
  const currentUser = await getCurrentUser();
  const user = await getAuthoritativeCurrentUser(currentUser);

  if (user.role !== "ADMIN") {
    redirect("/planning");
  }

  const categories = await getServiceCatalog(user);
  const missingDurations = categories.reduce(
    (total, category) =>
      total +
      category.services.filter(
        (service) => service.defaultDurationMinutes === null,
      ).length,
    0,
  );

  return (
    <main className="min-h-screen bg-[#fcf9f7]">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-6">
          <Link
            href="/planning"
            className="inline-flex min-h-10 items-center text-sm font-semibold text-slate-600 hover:text-slate-950"
          >
            ← Retour au planning
          </Link>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-600">
                Administration
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
                Prestations
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                La gérante définit ici la durée de référence et le prix
                catalogue. La prise de rendez-vous réutilise ensuite
                automatiquement ces valeurs.
              </p>
            </div>

            <div
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                missingDurations > 0
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-emerald-300 bg-emerald-50 text-emerald-800"
              }`}
            >
              {missingDurations > 0
                ? `${missingDurations} durée${missingDurations > 1 ? "s" : ""} à compléter`
                : "Toutes les durées sont configurées"}
            </div>
          </div>
        </header>

        <ServiceCatalogForm categories={categories} />
      </div>
    </main>
  );
}
