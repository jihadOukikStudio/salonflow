import { getPlatformAudit } from "@/server/platform/queries";
import { PageTitle, Pagination, Section } from "@/features/platform/ui";
import { auditTitle, auditDetails } from "@/features/platform/lib/presentation";
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const data = await getPlatformAudit(Number((await searchParams).page ?? 1));
  return (
    <>
      <PageTitle
        title="Journal des actions"
        description="Retrouvez les modifications effectuées depuis l’administration plateforme. Les opérations et leur journal sont enregistrés ensemble."
      />
      <Section title="Historique">
        <div className="divide-y divide-slate-100">
          {data.entries.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">
              Aucune action enregistrée.
            </p>
          )}
          {data.entries.map((entry) => (
            <article key={entry.id} className="py-5 first:pt-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">{auditTitle(entry.action)}</h3>
                <time
                  dateTime={entry.createdAt.toISOString()}
                  className="text-xs text-slate-500"
                >
                  {new Intl.DateTimeFormat("fr-FR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Africa/Casablanca",
                  }).format(entry.createdAt)}{" "}
                  · Casablanca
                </time>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {entry.actor.firstName} · {entry.salon?.name ?? "Plateforme"}
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-semibold text-teal-800">
                  Détails de l’action
                </summary>
                <dl className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                  {auditDetails(entry.details).map(({ label, text }) => (
                    <div key={label}>
                      <dt className="text-xs text-slate-500">{label}</dt>
                      <dd className="mt-1 break-words font-medium">{text}</dd>
                    </div>
                  ))}
                  {auditDetails(entry.details).length === 0 && (
                    <p>Aucun détail complémentaire.</p>
                  )}
                </dl>
              </details>
            </article>
          ))}
        </div>
        <Pagination
          page={data.page}
          total={data.total}
          size={30}
          path="/superadmin/journal"
        />
      </Section>
    </>
  );
}
