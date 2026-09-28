import { getSalonSupport } from "@/server/platform/support";
import { getCurrentUser } from "@/server/auth/get-current-user";
import { redirect } from "next/navigation";
import { ActionForm } from "@/features/platform/action-form";
import {
  Badge,
  Field,
  inputClass,
  PageTitle,
  Section,
  dateLabel,
} from "@/features/platform/ui";
import { supportAction } from "./actions";
export default async function SupportPage() {
  const user = await getCurrentUser();
  if (user.role !== "ADMIN") redirect("/");
  const incidents = await getSalonSupport();
  return (
    <main className="mx-auto max-w-6xl p-5 sm:p-8">
      <PageTitle
        title="Assistance SalonFlow"
        description="Signalez un problème et retrouvez les réponses concernant votre salon. Les échanges restent dans l’application."
      />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Section title="Vos demandes">
          <div className="space-y-4">
            {!incidents.length && (
              <p className="text-sm text-slate-500">
                Aucune demande pour le moment.
              </p>
            )}
            {incidents.map((incident) => (
              <article
                key={incident.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <Badge value={incident.status} />
                <h2 className="mt-3 font-semibold">{incident.title}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {dateLabel(incident.createdAt)}
                </p>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                  {incident.description}
                </p>
                {incident.resolution && (
                  <p className="mt-3 rounded-lg bg-teal-50 p-3 text-sm">
                    Résolution : {incident.resolution}
                  </p>
                )}
                {incident.messages.map((message) => (
                  <p
                    key={message.id}
                    className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm"
                  >
                    {message.body}
                  </p>
                ))}
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-teal-800">
                    Ajouter un message
                  </summary>
                  <div className="mt-3">
                    <ActionForm
                      actionHandler={supportAction}
                      kind="supportReply"
                      submit="Envoyer"
                    >
                      <input
                        type="hidden"
                        name="incidentId"
                        value={incident.id}
                      />
                      <Field label="Votre message">
                        <textarea
                          className={inputClass}
                          name="body"
                          required
                          maxLength={3000}
                          rows={3}
                        />
                      </Field>
                    </ActionForm>
                  </div>
                </details>
              </article>
            ))}
          </div>
        </Section>
        <Section title="Signaler un problème">
          <ActionForm
            actionHandler={supportAction}
            kind="supportCreate"
            submit="Envoyer la demande"
          >
            <Field label="Sujet">
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
                <option value="LOW">Faible</option>
                <option value="NORMAL">Normale</option>
                <option value="HIGH">Haute — travail perturbé</option>
                <option value="CRITICAL">Critique — travail bloqué</option>
              </select>
            </Field>
            <Field label="Que se passe-t-il ?">
              <textarea
                className={inputClass}
                name="description"
                required
                maxLength={3000}
                rows={6}
              />
            </Field>
            <p className="text-xs leading-5 text-slate-500">
              Précisez l’écran et les étapes du problème. Ne transmettez pas de
              mot de passe ni de données sensibles de clientes.
            </p>
          </ActionForm>
        </Section>
      </div>
    </main>
  );
}
