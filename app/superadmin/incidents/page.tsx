import { IncidentCard } from "@/features/platform/incident-card";
import { getPlatformIncidents } from "@/server/platform/queries";
import { ActionForm } from "@/features/platform/action-form";
import {
  Field,
  inputClass,
  PageTitle,
  Pagination,
  Section,
  labels,
  dateLabel,
} from "@/features/platform/ui";
export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    resolvedPage?: string;
    showResolved?: string;
  }>;
}) {
  const params = await searchParams;
  const data = await getPlatformIncidents(
    Number(params.page ?? 1),
    Number(params.resolvedPage ?? 1),
  );
  return (
    <>
      <PageTitle
        title="Incidents"
        description="Consignez les problèmes signalés et leur résolution. Ce registre manuel ne remplace pas la surveillance technique de l’application."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Section
            title={`À traiter · ${data.total}`}
            description="Incidents ouverts et en cours. Les plus urgents apparaissent en premier, puis les plus anciens."
          >
            <div className="space-y-4">
              {data.incidents.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-500">
                  Aucun incident à traiter. Les incidents résolus restent
                  disponibles ci-dessous.
                </p>
              )}
              {data.incidents.map((incident) => (
                <IncidentCard key={incident.id} incident={incident} />
              ))}
            </div>
            <Pagination
              page={data.page}
              total={data.total}
              size={20}
              path="/superadmin/incidents"
              filters={{
                resolvedPage: String(data.resolvedPage),
                ...(params.showResolved === "1" ? { showResolved: "1" } : {}),
              }}
            />
          </Section>
          <details
            className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
            open={
              params.showResolved === "1" || Number(params.resolvedPage) > 1
            }
          >
            <summary className="cursor-pointer text-lg font-semibold text-slate-800">
              Résolus · {data.resolvedTotal}
              <span className="ml-3 text-xs font-normal text-slate-500">
                Consulter l’historique
              </span>
            </summary>
            <div className="mt-5 space-y-3">
              {data.resolved.length === 0 && (
                <p className="text-sm text-slate-500">
                  Aucun incident résolu pour le moment.
                </p>
              )}
              {data.resolved.map((incident) => (
                <details
                  key={incident.id}
                  className="rounded-xl border border-slate-200"
                >
                  <summary className="cursor-pointer p-4 text-sm">
                    <span className="font-semibold">{incident.title}</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {incident.salon?.name ?? "Plateforme"} · Résolu le{" "}
                      {dateLabel(incident.resolvedAt)}
                    </span>
                  </summary>
                  <div className="px-3 pb-3">
                    <IncidentCard incident={incident} />
                  </div>
                </details>
              ))}
            </div>
            <Pagination
              page={data.resolvedPage}
              total={data.resolvedTotal}
              size={20}
              path="/superadmin/incidents"
              pageParam="resolvedPage"
              filters={{ page: String(data.page), showResolved: "1" }}
            />
          </details>
        </div>
        <Section title="Signaler un incident">
          <ActionForm kind="createIncident" submit="Enregistrer l’incident">
            <Field label="Périmètre">
              <select name="salonId" className={inputClass}>
                <option value="">Plateforme</option>
                {data.salons.map((salon) => (
                  <option key={salon.id} value={salon.id}>
                    {salon.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Titre">
              <input
                className={inputClass}
                name="title"
                required
                maxLength={150}
              />
            </Field>
            <Field label="Priorité">
              <select
                className={inputClass}
                name="priority"
                defaultValue="NORMAL"
              >
                {["LOW", "NORMAL", "HIGH", "CRITICAL"].map((p) => (
                  <option key={p} value={p}>
                    {labels[p]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description">
              <textarea
                className={inputClass}
                name="description"
                required
                maxLength={3000}
                rows={5}
              />
            </Field>
            <p className="text-xs leading-5 text-slate-500">
              N’inscrivez pas de mots de passe ni de données sensibles de
              clientes.
            </p>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
