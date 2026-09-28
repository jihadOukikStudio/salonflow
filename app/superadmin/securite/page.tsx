import { requirePlatformAdmin } from "@/server/platform/auth";
import { ActionForm } from "@/features/platform/action-form";
import { Field, inputClass, PageTitle, Section } from "@/features/platform/ui";
export default async function SecurityPage() {
  const actor = await requirePlatformAdmin();
  return (
    <>
      <PageTitle
        title="Sécurité du compte"
        description="Gérez les accès à votre compte plateforme et consultez l’état réel des protections de cette version."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Sessions">
          <p className="mb-4 text-sm leading-6 text-slate-600">
            Cette action déconnecte toutes vos sessions, y compris celle-ci.
            Vous devrez vous reconnecter avec votre mot de passe.
          </p>
          <ActionForm
            kind="revokeSessions"
            submit="Déconnecter toutes mes sessions"
            danger
          >
            <input type="hidden" name="userId" value={actor.id} />
            <Field label="Motif">
              <input
                name="reason"
                className={inputClass}
                required
                maxLength={500}
              />
            </Field>
          </ActionForm>
        </Section>
        <Section title="Protections et limites">
          <ul className="space-y-3 text-sm leading-6 text-slate-600">
            <li>Contrôle du rôle et de la session à chaque opération.</li>
            <li>
              Limitation persistante : 20 tentatives de connexion par email sur
              15 minutes.
            </li>
            <li>Expiration maximale d’une session : 8 heures.</li>
            <li className="rounded-lg bg-amber-50 p-3 text-amber-900">
              Double authentification : non configurée dans cette version.
            </li>
            <li>
              Récupération par email : non disponible. Aucun email automatique
              n’est envoyé.
            </li>
            <li>
              Sauvegardes et surveillance externe : état non vérifié par cette
              application.
            </li>
          </ul>
        </Section>
      </div>
    </>
  );
}
