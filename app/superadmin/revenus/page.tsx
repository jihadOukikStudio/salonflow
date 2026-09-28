import Link from "next/link";
import {
  getPlatformRevenue,
  getRevenueDetails,
} from "@/server/platform/revenue";
import { RevenueOverview } from "@/features/platform/revenue-overview";
import {
  PageTitle,
  Section,
  Pagination,
  dateLabel,
  Badge,
} from "@/features/platform/ui";
import { money } from "@/features/platform/lib/presentation";
export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    salonId?: string;
    page?: string;
    paymentPage?: string;
  }>;
}) {
  const params = await searchParams;
  const salonId = params.salonId ?? "";
  const [revenue, details] = await Promise.all([
    getPlatformRevenue(params.month, salonId),
    getRevenueDetails(
      params.month,
      salonId,
      Number(params.page ?? 1),
      Number(params.paymentPage ?? 1),
    ),
  ]);
  const filters = { month: revenue.period.key, salonId };
  return (
    <>
      <PageTitle
        title="Revenus"
        description="Analysez vos encaissements et retrouvez les paiements de chaque salon. Les offres et tarifs se gèrent dans les fiches des salons."
      />
      <RevenueOverview
        data={revenue}
        salonId={salonId}
        salons={details.options}
      />
      <Section
        title="Détail par salon"
        description="Tarifs actuels, encaissements de la période et première échéance restant à régler (y compris en retard)."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <caption className="sr-only">
              Revenus et prochaines échéances des salons
            </caption>
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th scope="col" className="p-3">
                  Salon
                </th>
                <th scope="col" className="p-3">
                  Tarif mensuel actuel
                </th>
                <th scope="col" className="p-3">
                  Reçu sur la période
                </th>
                <th scope="col" className="p-3">
                  Échéance à régler
                </th>
                <th scope="col" className="p-3">
                  Accès
                </th>
              </tr>
            </thead>
            <tbody>
              {details.salons.map((salon) => {
                const received = revenue.bySalon.filter(
                  (row) => row.salonId === salon.id,
                );
                const due = salon.subscriptionDues[0];
                return (
                  <tr key={salon.id} className="border-b border-slate-100">
                    <th scope="row" className="p-3 font-semibold">
                      {salon.name}
                    </th>
                    <td className="p-3">
                      {salon.subscription ? (
                        <>
                          <p className="mb-1 whitespace-nowrap">
                            {money(
                              salon.subscription.monthlyPrice.toString(),
                              salon.subscription.currency,
                            )}
                          </p>
                          <Badge value={salon.subscription.status} />
                        </>
                      ) : (
                        "À renseigner"
                      )}
                    </td>
                    <td className="p-3 tabular-nums">
                      {received.length
                        ? received.map((row) => (
                            <p className="whitespace-nowrap" key={row.currency}>
                              {money(
                                row._sum.amount?.toString() ?? "0",
                                row.currency,
                              )}
                            </p>
                          ))
                        : "Aucun paiement"}
                    </td>
                    <td className="p-3">
                      {due ? (
                        <Link
                          className="text-teal-800 underline"
                          href={`/superadmin/echeances?salonId=${salon.id}&state=open`}
                        >
                          {dateLabel(due.dueAt)}
                          <span className="block whitespace-nowrap">
                            {money(due.amount.toString(), due.currency)}
                          </span>
                        </Link>
                      ) : (
                        "Non planifiée"
                      )}
                    </td>
                    <td className="p-3">
                      <Link
                        className="whitespace-nowrap font-semibold text-teal-800 underline"
                        href={`/superadmin/salons/${salon.id}#paiements`}
                      >
                        Voir les paiements
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!details.total && (
          <p className="py-5 text-sm text-slate-500">
            Aucun salon. Créez votre premier salon depuis le menu Salons.
          </p>
        )}
        <Pagination
          page={details.page}
          total={details.total}
          size={20}
          path="/superadmin/revenus"
          filters={{ ...filters, paymentPage: String(details.paymentPage) }}
        />
      </Section>
      <div className="mt-6">
        <Section
          title="Historique des paiements"
          description="Paiements reçus pendant le mois sélectionné. Les écritures annulées restent visibles pour garder la trace des corrections et sont exclues des totaux."
        >
          <div className="space-y-3">
            {details.payments.map((payment) => (
              <article
                key={payment.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <Link
                    className="font-semibold text-teal-800"
                    href={`/superadmin/salons/${payment.salonId}#paiements`}
                  >
                    {payment.salon.name}
                  </Link>
                  <p
                    className={
                      payment.voidedAt
                        ? "text-slate-500 line-through"
                        : "font-semibold"
                    }
                  >
                    {money(payment.amount.toString(), payment.currency)}
                  </p>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Reçu le {dateLabel(payment.paidAt)} · {payment.method}
                  {payment.reference ? ` · ${payment.reference}` : ""}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Période couverte : {dateLabel(payment.periodStart)} →{" "}
                  {dateLabel(payment.periodEnd)}
                </p>
                {payment.voidedAt && (
                  <p className="mt-2 text-sm text-rose-800">
                    Annulé le {dateLabel(payment.voidedAt)} :{" "}
                    {payment.voidReason}
                  </p>
                )}
              </article>
            ))}
            {!details.paymentTotal && (
              <p className="text-sm text-slate-500">
                Aucun paiement enregistré pour ces critères.
              </p>
            )}
          </div>
          <Pagination
            page={details.paymentPage}
            total={details.paymentTotal}
            size={30}
            pageParam="paymentPage"
            path="/superadmin/revenus"
            filters={{ ...filters, page: String(details.page) }}
          />
        </Section>
      </div>
    </>
  );
}
