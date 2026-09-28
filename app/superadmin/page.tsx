import { getPlatformRevenueSummary } from "@/server/platform/revenue";

import { auditTitle, money } from "@/features/platform/lib/presentation";
import Link from "next/link";
import { Building2, CircleAlert, CreditCard, CheckCircle2 } from "lucide-react";
import { getPlatformDashboard } from "@/server/platform/queries";

import { PageTitle, Section, dateLabel } from "@/features/platform/ui";
export default async function SuperadminPage() {
  const data = await getPlatformDashboard();
  const received = await getPlatformRevenueSummary();
  return (
    <>
      <PageTitle
        title="Vos salons, en un regard."
        description="Pilotez les accès, suivez les abonnements et gardez une vue claire sur les demandes des salons."
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-100 bg-teal-50 p-5">
        <div>
          <p className="text-sm text-teal-900">Encaissé ce mois</p>
          <div className="mt-1 flex flex-wrap gap-3 text-2xl font-semibold text-teal-950">
            {received.length ? (
              received.map((row) => (
                <span key={row.currency}>
                  {money(row._sum.amount?.toString() ?? "0", row.currency)}
                </span>
              ))
            ) : (
              <span>Aucun paiement enregistré</span>
            )}
          </div>
          <p className="mt-1 text-xs text-teal-800">
            Abonnements SalonFlow · hors paiements annulés
          </p>
        </div>
        <Link
          className="font-semibold text-teal-800 underline"
          href="/superadmin/revenus"
        >
          Voir les revenus →
        </Link>
      </div>
      <p className="mb-6">
        <Link
          href="/superadmin/salons"
          className="font-semibold text-teal-800 underline"
        >
          Gérer ou ajouter un salon →
        </Link>
      </p>
      <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Échéances à venir",
            value: data.upcoming,
            Icon: Building2,
            note: "Dans les 7 prochains jours",
          },
          {
            label: "Salons actifs",
            value: data.active,
            Icon: CheckCircle2,
            note: `${data.total} salons au total`,
          },
          {
            label: "Incidents à traiter",
            value: data.openIncidents,
            Icon: CircleAlert,
            note: "Ouverts ou en cours",
          },
          {
            label: "Échéances en retard",
            value: data.lateDues,
            Icon: CreditCard,
            note: "Non réglées, date limite dépassée",
          },
        ].map(({ label, value, Icon, note }) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="flex items-center justify-between text-sm text-slate-500">
              {label}
              <Icon className="h-5 w-5 text-teal-700" />
            </div>
            <p className="mt-4 text-4xl font-semibold tracking-tight">
              {value}
            </p>
            <p className="mt-2 text-xs text-slate-400">{note}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Section title="À traiter">
          <p className="mb-4">
            <Link
              className="font-semibold text-teal-800 underline"
              href="/superadmin/echeances"
            >
              Consulter les échéances par salon →
            </Link>
          </p>
          <div className="space-y-3 text-sm">
            <Link
              className="block rounded-xl bg-amber-50 p-4 text-amber-900"
              href="/superadmin/echeances?state=late"
            >
              {data.lateDues} échéance(s) en retard · Vérifier les paiements →
            </Link>
            <Link
              className="block rounded-xl bg-rose-50 p-4 text-rose-900"
              href="/superadmin/incidents"
            >
              {data.openIncidents} incident(s) à traiter →
            </Link>
            <Link
              className="block rounded-xl bg-slate-50 p-4 text-slate-700"
              href="/superadmin/securite"
            >
              Vérifier la sécurité et les sessions →
            </Link>
          </div>
        </Section>
        <Section title="Dernières actions">
          <div className="space-y-3">
            {data.recent.length ? (
              data.recent.map((entry) => (
                <div
                  key={entry.id}
                  className="border-b border-slate-100 pb-3 text-sm"
                >
                  <p className="font-medium">
                    {entry.salon?.name ?? "Plateforme"}
                  </p>
                  <p className="mt-1 text-slate-500">
                    {auditTitle(entry.action)} · {dateLabel(entry.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                Aucune action pour le moment.
              </p>
            )}
            <Link
              className="inline-block text-sm font-semibold text-teal-800"
              href="/superadmin/journal"
            >
              Voir le journal →
            </Link>
          </div>
        </Section>
      </div>
    </>
  );
}
