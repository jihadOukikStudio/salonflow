import Link from "next/link";
import type { SubscriptionPayment } from "@/app/generated/prisma/client";
import { ActionForm } from "./action-form";
import { Field, inputClass, Section, dateLabel } from "./ui";
export function SalonPayments({
  salonId,
  currency,
  payments,
}: {
  salonId: string;
  currency: string;
  payments: SubscriptionPayment[];
}) {
  return (
    <div id="paiements">
      <p className="mb-4">
        <Link
          className="font-semibold text-teal-800 underline"
          href={`/superadmin/echeances?salonId=${salonId}`}
        >
          Voir et planifier les échéances de ce salon →
        </Link>
      </p>
      <Section
        title="Paiements d’abonnement"
        description="Paiements reçus pour SalonFlow. Les encaissements des rendez-vous ne figurent pas ici. Les corrections conservent l’original."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            {payments.length === 0 && (
              <p className="text-sm text-slate-500">
                Aucun paiement enregistré.
              </p>
            )}
            {payments.map((payment) => (
              <article
                key={payment.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <p
                  className={`font-semibold ${payment.voidedAt ? "text-slate-400 line-through" : "text-slate-900"}`}
                >
                  {payment.amount.toFixed(2)} {payment.currency} ·{" "}
                  {payment.method}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Reçu le {dateLabel(payment.paidAt)} · Période{" "}
                  {dateLabel(payment.periodStart)} →{" "}
                  {dateLabel(payment.periodEnd)}
                </p>
                {payment.voidedAt ? (
                  <p className="mt-2 text-sm text-rose-800">
                    Annulé : {payment.voidReason}
                  </p>
                ) : (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-teal-800">
                      Corriger ce paiement
                    </summary>
                    <div className="mt-3">
                      <ActionForm
                        kind="voidPayment"
                        submit="Annuler l’écriture"
                        danger
                      >
                        <input
                          type="hidden"
                          name="paymentId"
                          value={payment.id}
                        />
                        <Field label="Motif de correction">
                          <input
                            className={inputClass}
                            name="reason"
                            required
                            maxLength={500}
                          />
                        </Field>
                        <p className="text-xs text-slate-500">
                          Enregistrez ensuite le paiement corrigé. Aucun
                          mouvement bancaire n’est réalisé.
                        </p>
                      </ActionForm>
                    </div>
                  </details>
                )}
              </article>
            ))}
            {payments.length === 100 && (
              <p className="text-xs text-slate-500">
                Les 100 paiements les plus récents sont affichés.
              </p>
            )}
          </div>
          <ActionForm
            kind="recordPayment"
            submit="Enregistrer le paiement reçu"
          >
            <input type="hidden" name="salonId" value={salonId} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Montant reçu">
                <input
                  className={inputClass}
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="99999999.99"
                  required
                />
              </Field>
              <Field label="Devise du paiement">
                <select
                  className={inputClass}
                  name="currency"
                  defaultValue={currency}
                >
                  {["MAD", "EUR", "USD"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Date de réception">
              <input
                className={inputClass}
                name="paidAt"
                type="date"
                required
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Début de période">
                <input
                  className={inputClass}
                  name="periodStart"
                  type="date"
                  required
                />
              </Field>
              <Field label="Fin de période">
                <input
                  className={inputClass}
                  name="periodEnd"
                  type="date"
                  required
                />
              </Field>
            </div>
            <Field label="Moyen de paiement">
              <select className={inputClass} name="method">
                <option>Virement</option>
                <option>Espèces</option>
                <option>Autre</option>
              </select>
            </Field>
            <Field label="Référence">
              <input className={inputClass} name="reference" maxLength={150} />
            </Field>
            <p className="text-xs text-slate-500">
              Ce relevé manuel ne modifie pas automatiquement le statut ou
              l’échéance de l’abonnement.
            </p>
          </ActionForm>
        </div>
      </Section>
    </div>
  );
}
