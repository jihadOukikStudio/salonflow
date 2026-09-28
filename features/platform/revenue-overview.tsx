import type { getPlatformRevenue } from "@/server/platform/revenue";
import { Section, Field, inputClass, buttonClass } from "./ui";
import { money, monthLabel } from "./lib/presentation";

type Revenue = Awaited<ReturnType<typeof getPlatformRevenue>>;
export function RevenueOverview({
  data,
  salonId,
  salons,
}: {
  data: Revenue;
  salonId: string;
  salons: { id: string; name: string }[];
}) {
  const currencies = [...new Set(data.history.map((row) => row.currency))];
  return (
    <div className="mb-7 space-y-5">
      <Section
        title="Vos revenus SalonFlow"
        description="Uniquement les abonnements payés à SalonFlow, pas le chiffre d’affaires des prestations des salons."
      >
        <form
          action="/superadmin/revenus"
          className="mb-5 flex flex-wrap items-end gap-3"
        >
          <Field label="Salon">
            <select
              name="salonId"
              className={inputClass}
              defaultValue={salonId}
            >
              <option value="">Tous les salons</option>
              {salons.map((salon) => (
                <option key={salon.id} value={salon.id}>
                  {salon.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mois des encaissements">
            <input
              className={inputClass}
              type="month"
              name="month"
              defaultValue={data.period.key}
              min="2000-01"
              max="2099-12"
              required
            />
          </Field>
          <button className={buttonClass}>Afficher les revenus</button>
        </form>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-[#126c65] p-5 text-white">
            <p className="text-sm text-teal-50">
              Encaissé · {monthLabel(data.period.key)}
            </p>
            <div className="my-3 space-y-1 text-3xl font-semibold tabular-nums">
              {data.received.length ? (
                data.received.map((row) => (
                  <p key={row.currency}>
                    {money(row._sum.amount?.toString() ?? "0", row.currency)}
                  </p>
                ))
              ) : (
                <p>
                  0{" "}
                  <span className="text-base font-normal">
                    paiement enregistré
                  </span>
                </p>
              )}
            </div>
            <p className="text-xs leading-5 text-teal-50">
              Somme des paiements reçus ce mois-ci, hors écritures annulées. Ce
              montant ne représente pas un bénéfice après charges.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm text-slate-600">Base mensuelle actuelle</p>
            <div className="my-3 space-y-1 text-3xl font-semibold tabular-nums">
              {data.recurring.length ? (
                data.recurring.map((row) => (
                  <p key={row.currency}>
                    {money(
                      row._sum.monthlyPrice?.toString() ?? "0",
                      row.currency,
                    )}
                  </p>
                ))
              ) : (
                <p>—</p>
              )}
            </div>
            <p className="text-xs leading-5 text-slate-600">
              Tarifs actuels des salons actifs avec abonnement actif ou en
              retard. Hors essais et résiliations. Ce n’est ni un encaissement
              ni une reconstitution des anciens tarifs.
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-600">
          Les devises restent séparées. Un règlement couvrant plusieurs mois est
          compté en totalité au mois de sa réception.
        </p>
      </Section>
      <Section
        title="Encaissements sur six mois"
        description={`Jusqu’à ${monthLabel(data.period.key)} · paiements non annulés, regroupés par date de réception.`}
      >
        {currencies.length ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {currencies.map((currency) => {
              const points = data.period.months.map((month) => ({
                month,
                amount: Number(
                  data.history.find(
                    (row) => row.month === month && row.currency === currency,
                  )?.amount ?? 0,
                ),
              }));
              const max = Math.max(1, ...points.map((p) => p.amount));
              return (
                <div key={currency}>
                  <h3 className="mb-4 text-sm font-semibold">{currency}</h3>
                  <ol className="space-y-3">
                    {points.map((point) => (
                      <li key={point.month}>
                        <div className="mb-1 flex justify-between gap-3 text-xs">
                          <span>{monthLabel(point.month)}</span>
                          <span className="font-semibold tabular-nums">
                            {money(point.amount, currency)}
                          </span>
                        </div>
                        <div
                          aria-hidden="true"
                          className="h-2 overflow-hidden rounded-full bg-slate-100"
                        >
                          <div
                            className="h-2 rounded-full bg-teal-600"
                            style={{ width: `${(point.amount / max) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            Aucun paiement enregistré sur cette période. Ouvrez la fiche d’un
            salon pour enregistrer un règlement reçu.
          </p>
        )}
      </Section>
    </div>
  );
}
