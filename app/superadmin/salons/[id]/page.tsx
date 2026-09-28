import { SalonPayments } from "@/features/platform/salon-payments";
import Link from "next/link";
import { getPlatformSalon } from "@/server/platform/queries";
import { ActionForm } from "@/features/platform/action-form";
import {
  Badge,
  Field,
  inputClass,
  PageTitle,
  Section,
  labels,
} from "@/features/platform/ui";
export default async function PlatformSalonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const salon = await getPlatformSalon((await params).id);
  const sub = salon.subscription;
  const salonField = <input type="hidden" name="salonId" value={salon.id} />;
  return (
    <>
      <Link
        className="mb-5 inline-block text-sm font-semibold text-teal-800"
        href="/superadmin/salons"
      >
        ← Tous les salons
      </Link>
      <PageTitle
        title={salon.name}
        description={
          [salon.address, salon.phone].filter(Boolean).join(" · ") ||
          "Gérez les accès et le suivi de ce salon."
        }
      />
      {!salon.isActive && (
        <div
          role="status"
          className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950"
        >
          <h2 className="font-semibold">Connexion au salon désactivée</h2>
          <p className="mt-2 text-sm">
            Créer la gérante ne suffit pas : le salon doit aussi être actif pour
            qu’elle puisse se connecter.
          </p>
          <p className="mt-2 text-sm">
            {salon.users.some((u) => u.isActive)
              ? "Votre gérante est prête. Activez maintenant le salon pour lui ouvrir l’accès."
              : "Ajoutez d’abord une gérante active, puis activez le salon."}
          </p>
          <a
            className="mt-3 inline-block font-semibold underline"
            href="#acces-salon"
          >
            Aller à l’activation du salon →
          </a>
        </div>
      )}
      <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-slate-500">
        <Badge value={salon.isActive ? "ACTIVE" : salon.lifecycle} />
        <span>{salon._count.employees} employées</span>
        <span>{salon._count.clients} clientes</span>
        <span>{salon._count.appointments} rendez-vous</span>
      </div>
      <div className="mb-6 rounded-xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-900">
        Préparation :{" "}
        {salon.users.some((u) => u.isActive)
          ? "✓ Gérante"
          : "○ Gérante à créer"}{" "}
        · {salon.subscription ? "✓ Abonnement" : "○ Abonnement à renseigner"} ·{" "}
        {salon._count.services
          ? "✓ Catalogue"
          : "○ Catalogue à configurer par la gérante après activation"}{" "}
        · {salon._count.rooms ? "✓ Salles" : "○ Salles à configurer"}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Section
          title="Gérantes du salon"
          description="Les gérantes administrent leur salon. Elles n’ont pas accès à la plateforme."
        >
          <div className="space-y-4">
            {salon.users.length === 0 && (
              <p className="text-sm text-slate-500">
                Aucune gérante. Ajoutez le premier compte ci-dessous.
              </p>
            )}
            {salon.users.map((user) => (
              <div
                key={user.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="mb-3 flex flex-wrap justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">
                      {user.firstName} {user.lastName}
                    </h3>
                    <p className="break-all text-sm text-slate-500">
                      {user.email}
                    </p>
                  </div>
                  <Badge value={user.isActive ? "ACTIVE" : "SUSPENDED"} />
                </div>
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-teal-800">
                    {user.isActive
                      ? "Désactiver ce compte"
                      : "Réactiver ce compte"}
                  </summary>
                  <div className="mt-3">
                    <ActionForm
                      kind="managerStatus"
                      submit={
                        user.isActive
                          ? "Confirmer la désactivation"
                          : "Réactiver"
                      }
                      danger={user.isActive}
                    >
                      {salonField}
                      <input type="hidden" name="userId" value={user.id} />
                      <input
                        type="hidden"
                        name="isActive"
                        value={String(!user.isActive)}
                      />
                      <Field label="Motif">
                        <input
                          className={inputClass}
                          name="reason"
                          required
                          maxLength={500}
                        />
                      </Field>
                    </ActionForm>
                  </div>
                </details>
              </div>
            ))}
          </div>
          <details className="mt-5 border-t border-slate-100 pt-4">
            <summary className="cursor-pointer font-semibold text-teal-800">
              Ajouter une gérante
            </summary>
            <div className="mt-4">
              <ActionForm kind="createManager" submit="Créer le compte gérante">
                {salonField}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Prénom">
                    <input
                      className={inputClass}
                      name="firstName"
                      required
                      maxLength={100}
                    />
                  </Field>
                  <Field label="Nom">
                    <input
                      className={inputClass}
                      name="lastName"
                      maxLength={100}
                    />
                  </Field>
                </div>
                <Field label="Email">
                  <input
                    className={inputClass}
                    name="email"
                    type="email"
                    autoComplete="off"
                    required
                    maxLength={320}
                  />
                </Field>
                <Field label="Mot de passe — 12 caractères minimum">
                  <input
                    className={inputClass}
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={72}
                  />
                </Field>
                <Field label="Confirmer le mot de passe">
                  <input
                    className={inputClass}
                    name="confirmation"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={72}
                  />
                </Field>
                <p className="text-xs leading-5 text-slate-500">
                  Transmettez les accès à la gérante individuellement. Aucun
                  email automatique n’est envoyé.
                </p>
              </ActionForm>
            </div>
          </details>
        </Section>
        <Section
          title="Abonnement"
          description="Suivi manuel uniquement. Aucun prélèvement ni suspension automatique n’est déclenché."
        >
          <ActionForm kind="subscription" submit="Enregistrer l’abonnement">
            {salonField}
            <Field label="Offre">
              <input
                className={inputClass}
                name="planName"
                defaultValue={sub?.planName ?? "Pilote"}
                required
                maxLength={80}
              />
            </Field>
            <Field label="Statut">
              <select
                className={inputClass}
                name="status"
                defaultValue={sub?.status ?? "TRIAL"}
              >
                {["TRIAL", "ACTIVE", "PAST_DUE", "CANCELLED"].map((status) => (
                  <option key={status} value={status}>
                    {labels[status]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Montant mensuel">
                <input
                  className={inputClass}
                  type="number"
                  name="monthlyPrice"
                  min="0"
                  max="99999999.99"
                  step="0.01"
                  defaultValue={sub?.monthlyPrice.toFixed(2) ?? "0.00"}
                  required
                />
              </Field>
              <Field label="Devise">
                <select
                  className={inputClass}
                  name="currency"
                  defaultValue={sub?.currency ?? "MAD"}
                >
                  {["MAD", "EUR", "USD"].map((currency) => (
                    <option key={currency}>{currency}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Échéance">
              <input
                className={inputClass}
                type="date"
                name="periodEnd"
                defaultValue={sub?.periodEnd?.toISOString().slice(0, 10) ?? ""}
              />
            </Field>
            <Field label="Note interne">
              <textarea
                className={inputClass}
                name="note"
                defaultValue={sub?.note ?? ""}
                maxLength={1000}
                rows={3}
              />
            </Field>
          </ActionForm>
        </Section>
        <div id="acces-salon">
          <Section
            title="État et accès du salon"
            description={
              salon.isActive
                ? "La suspension bloque les accès des gérantes et employées. Les données sont conservées."
                : "Les comptes encore actifs pourront à nouveau accéder au salon."
            }
          >
            <ActionForm
              kind="salonStatus"
              submit="Confirmer le changement d’état"
              danger={salon.isActive}
            >
              {salonField}
              <Field label="Nouvel état">
                <select
                  className={inputClass}
                  name="lifecycle"
                  defaultValue={salon.isActive ? "SUSPENDED" : "ACTIVE"}
                >
                  <option value="PREPARING">En préparation</option>
                  <option value="ACTIVE">Actif</option>
                  <option value="SUSPENDED">Suspendu</option>
                  <option value="ARCHIVED">Archivé</option>
                </select>
              </Field>
              <Field label="Motif">
                <textarea
                  className={inputClass}
                  name="reason"
                  required
                  maxLength={500}
                  rows={2}
                />
              </Field>
              <Field label={`Recopiez le nom : ${salon.name}`}>
                <input
                  className={inputClass}
                  name="confirmation"
                  required
                  maxLength={150}
                  autoComplete="off"
                />
              </Field>
            </ActionForm>
          </Section>
        </div>
        <Section title="Coordonnées du salon">
          <ActionForm kind="salonDetails" submit="Enregistrer les coordonnées">
            {salonField}
            <Field label="Nom du salon">
              <input
                className={inputClass}
                name="name"
                defaultValue={salon.name}
                required
                maxLength={150}
              />
            </Field>
            <Field label="Téléphone">
              <input
                className={inputClass}
                name="phone"
                defaultValue={salon.phone ?? ""}
                maxLength={40}
              />
            </Field>
            <Field label="Adresse">
              <textarea
                className={inputClass}
                name="address"
                defaultValue={salon.address ?? ""}
                maxLength={300}
              />
            </Field>
            <Field label="Fuseau horaire de référence">
              <select
                className={inputClass}
                name="timezone"
                defaultValue={salon.timezone}
              >
                {["Africa/Casablanca", "Europe/Paris", "UTC"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Devise de référence">
              <select
                className={inputClass}
                name="currency"
                defaultValue={salon.currency}
              >
                {["MAD", "EUR", "USD"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <p className="text-xs text-slate-500">
              Ces références ne convertissent ni les prix ni les rendez-vous
              existants. Le planning V1 reste configuré sur Casablanca.
            </p>
          </ActionForm>
        </Section>
      </div>
      <div className="mt-6">
        <SalonPayments
          salonId={salon.id}
          currency={salon.currency}
          payments={salon.subscriptionPayments}
        />
      </div>
    </>
  );
}
