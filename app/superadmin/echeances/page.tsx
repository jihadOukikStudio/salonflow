import Link from "next/link";
import { getPlatformDues } from "@/server/platform/dues";
import { ActionForm } from "@/features/platform/action-form";
import {
  PageTitle,
  Section,
  Field,
  inputClass,
  buttonClass,
  dateLabel,
  Pagination,
} from "@/features/platform/ui";
import { dueState, money } from "@/features/platform/lib/presentation";
export default async function DuesPage({
  searchParams,
}: {
  searchParams: Promise<{ salonId?: string; state?: string; page?: string }>;
}) {
  const params = await searchParams;
  const data = await getPlatformDues({
    ...params,
    page: Number(params.page ?? 1),
  });
  return (
    <>
      <PageTitle
        title="Échéances et règlements"
        description="Planifiez les montants attendus, puis rapprochez chaque échéance du paiement reçu. Aucun prélèvement ni rappel automatique."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Link
          href={`/superadmin/echeances?state=late&salonId=${data.salonId}`}
          className="rounded-xl border border-rose-200 bg-rose-50 p-5"
        >
          <p className="text-2xl font-semibold">{data.overdue}</p>
          <p className="text-sm">Échéances en retard</p>
        </Link>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-2xl font-semibold">{data.upcoming}</p>
          <p className="text-sm">À régler dans les 30 prochains jours</p>
        </div>
      </div>
      <Section
        title="Toutes les échéances"
        description="La date limite est indépendante de la date de réception. Les échéances passées ne sont pas reconstruites à partir des tarifs actuels."
      >
        <form className="mb-5 flex flex-wrap items-end gap-3">
          <Field label="Salon">
            <select
              name="salonId"
              className={inputClass}
              defaultValue={data.salonId}
            >
              <option value="">Tous les salons</option>
              {data.salons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Afficher">
            <select
              className={inputClass}
              name="state"
              defaultValue={data.state}
            >
              <option value="">Tous les états</option>
              <option value="open">À régler</option>
              <option value="late">En retard</option>
              <option value="paid">Réglées / traitées</option>
              <option value="cancelled">Annulées</option>
            </select>
          </Field>
          <button className={buttonClass}>Filtrer</button>
        </form>
        <div className="space-y-4">
          {!data.dues.length && (
            <p className="py-5 text-sm text-slate-600">
              Aucune échéance pour ces critères. Ajoutez les prochaines dates
              ci-dessous.
            </p>
          )}
          {data.dues.map((due) => {
            const status = dueState(due, data.today);
            const eligible = data.payments.filter(
              (p) => p.currency === due.currency && p.amount.equals(due.amount),
            );
            return (
              <article
                key={due.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <Link
                      href={`/superadmin/salons/${due.salonId}`}
                      className="font-semibold text-teal-800"
                    >
                      {due.salon.name}
                    </Link>
                    <h3 className="mt-1 font-semibold">{due.title}</h3>
                    <p className="mt-2 text-sm">
                      {money(due.amount.toString(), due.currency)} · Date limite
                      : {dateLabel(due.dueAt)}
                    </p>
                  </div>
                  <span
                    className={`h-fit rounded-full px-3 py-1 text-xs font-semibold ${status === "En retard" ? "bg-rose-50 text-rose-800" : status === "Réglée" ? "bg-teal-50 text-teal-800" : "bg-slate-100 text-slate-700"}`}
                  >
                    {status}
                  </span>
                </div>
                {due.payment && (
                  <p className="mt-3 text-sm text-teal-800">
                    Reçu le {dateLabel(due.payment.paidAt)} · Rapproché le{" "}
                    {dateLabel(due.processedAt)}
                    {due.payment.reference
                      ? ` · Référence : ${due.payment.reference}`
                      : ""}
                  </p>
                )}
                {due.cancelledAt && (
                  <p className="mt-2 text-sm text-slate-600">
                    Annulée le {dateLabel(due.cancelledAt)}
                  </p>
                )}
                {due.note && (
                  <p className="mt-2 break-words text-sm text-slate-600">
                    {due.note}
                  </p>
                )}
                {!due.paymentId && !due.cancelledAt && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-semibold text-teal-800">
                      Traiter cette échéance
                    </summary>
                    <div className="mt-4 grid gap-5 md:grid-cols-2">
                      <div>
                        {data.salonId ? (
                          eligible.length ? (
                            <ActionForm
                              kind="settleDue"
                              submit="Rapprocher le paiement"
                            >
                              <input
                                type="hidden"
                                name="dueId"
                                value={due.id}
                              />
                              <Field label="Paiement reçu">
                                <select
                                  name="paymentId"
                                  className={inputClass}
                                  required
                                >
                                  {eligible.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {dateLabel(p.paidAt)} ·{" "}
                                      {money(p.amount.toString(), p.currency)} ·{" "}
                                      {p.reference || p.method} ·{" "}
                                      {p.id.slice(0, 8)}
                                    </option>
                                  ))}
                                </select>
                              </Field>
                            </ActionForm>
                          ) : (
                            <p className="text-sm text-slate-600">
                              Aucun paiement disponible de ce montant et de
                              cette devise parmi les 100 derniers paiements non
                              affectés.
                            </p>
                          )
                        ) : (
                          <Link
                            className="text-sm text-teal-800 underline"
                            href={`/superadmin/echeances?salonId=${due.salonId}`}
                          >
                            Sélectionner ce salon pour rapprocher son paiement
                          </Link>
                        )}
                        <Link
                          href={`/superadmin/salons/${due.salonId}#paiements`}
                          className="mt-3 block text-sm font-semibold text-teal-800"
                        >
                          Enregistrer ou consulter ses paiements →
                        </Link>
                      </div>
                      <ActionForm
                        kind="cancelDue"
                        submit="Annuler l’échéance"
                        danger
                      >
                        <input type="hidden" name="dueId" value={due.id} />
                        <Field label="Motif d’annulation">
                          <input
                            name="reason"
                            className={inputClass}
                            required
                            maxLength={500}
                          />
                        </Field>
                      </ActionForm>
                    </div>
                  </details>
                )}
              </article>
            );
          })}
        </div>
        <Pagination
          page={data.page}
          total={data.total}
          size={30}
          path="/superadmin/echeances"
          filters={{ salonId: data.salonId, state: data.state }}
        />
      </Section>
      <div className="mt-6">
        <Section
          title="Planifier une échéance"
          description="Saisissez une échéance par règlement attendu. Le rapprochement associe un paiement complet à une échéance de même montant et devise ; les paiements partiels ne sont pas ventilés automatiquement."
        >
          <ActionForm kind="createDue" submit="Ajouter l’échéance">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Salon concerné">
                <select
                  name="salonId"
                  className={inputClass}
                  required
                  defaultValue={data.salonId}
                >
                  <option value="" disabled>
                    Choisir un salon
                  </option>
                  {data.salons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Libellé">
                <input
                  name="title"
                  className={inputClass}
                  placeholder="Abonnement — octobre 2026"
                  required
                  maxLength={150}
                />
              </Field>
              <Field label="Date limite">
                <input
                  name="dueAt"
                  type="date"
                  className={inputClass}
                  required
                />
              </Field>
              <Field label="Montant attendu">
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  max="99999999.99"
                  step="0.01"
                  className={inputClass}
                  required
                />
              </Field>
              <Field label="Devise">
                <select
                  name="currency"
                  className={inputClass}
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Choisir la devise
                  </option>
                  {["MAD", "EUR", "USD"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Note facultative">
                <input name="note" className={inputClass} maxLength={500} />
              </Field>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
