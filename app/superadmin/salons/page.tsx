import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getPlatformDashboard } from "@/server/platform/queries";
import { ActionForm } from "@/features/platform/action-form";
import {
  Badge,
  Field,
  inputClass,
  PageTitle,
  Pagination,
  Section,
  dateLabel,
} from "@/features/platform/ui";
export default async function SalonsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; state?: string }>;
}) {
  const params = await searchParams;
  const data = await getPlatformDashboard(
    params.q,
    Number(params.page ?? 1),
    params.state,
  );
  return (
    <>
      <PageTitle
        title="Salons"
        description="Créez un salon et gérez ses gérantes, son abonnement et ses accès."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Section
          title="Salons"
          description="Retrouvez les salons, leurs accès et leurs abonnements."
        >
          <form
            className="mb-5 flex flex-wrap items-end gap-2"
            action="/superadmin/salons"
          >
            <Field label="Rechercher un salon">
              <input
                className={inputClass}
                name="q"
                defaultValue={data.q}
                maxLength={150}
                placeholder="Nom du salon"
              />
            </Field>
            <select
              aria-label="État du salon"
              name="state"
              defaultValue={data.state}
              className="min-h-11 max-w-40 rounded-lg border border-slate-300 px-2 text-sm"
            >
              <option value="">Tous les états</option>
              <option value="ACTIVE">Actifs</option>
              <option value="PREPARING">En préparation</option>
              <option value="SUSPENDED">Suspendus</option>
              <option value="ARCHIVED">Archivés</option>
            </select>
            <button className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold">
              Rechercher
            </button>
          </form>
          <div className="space-y-3">
            {data.salons.length ? (
              data.salons.map((salon) => (
                <Link
                  key={salon.id}
                  href={`/superadmin/salons/${salon.id}`}
                  className="block rounded-xl border border-slate-200 p-4 transition hover:border-teal-400 hover:bg-teal-50/30"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words font-semibold">
                        {salon.name}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {salon._count.employees} employées ·{" "}
                        {salon._count.users} comptes
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        value={salon.isActive ? "ACTIVE" : salon.lifecycle}
                      />
                      <ArrowUpRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    {salon.subscription ? (
                      <>
                        <Badge value={salon.subscription.status} />
                        <span>
                          {salon.subscription.planName} ·{" "}
                          {salon.subscription.monthlyPrice.toFixed(2)}{" "}
                          {salon.subscription.currency}/mois
                        </span>
                        <span>
                          Échéance : {dateLabel(salon.subscription.periodEnd)}
                        </span>
                      </>
                    ) : (
                      <span>Abonnement à renseigner</span>
                    )}
                  </div>
                </Link>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">
                Aucun salon trouvé.
              </p>
            )}
          </div>
          <Pagination
            page={data.page}
            total={data.filteredCount}
            size={20}
            path="/superadmin/salons"
            q={data.q}
            filters={{ state: data.state }}
          />
        </Section>
        <Section
          title="Ajouter un salon"
          description="Créez son espace, puis ajoutez sa première gérante."
        >
          <ActionForm kind="createSalon" submit="Créer le salon">
            <Field label="Nom du salon">
              <input
                className={inputClass}
                name="name"
                required
                maxLength={150}
              />
            </Field>
            <Field label="Téléphone">
              <input
                className={inputClass}
                name="phone"
                type="tel"
                maxLength={40}
              />
            </Field>
            <Field label="Adresse">
              <textarea
                className={inputClass}
                name="address"
                maxLength={300}
                rows={3}
              />
            </Field>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
