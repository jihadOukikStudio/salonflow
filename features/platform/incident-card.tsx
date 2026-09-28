import type { getPlatformIncidents } from "@/server/platform/queries";
import { ActionForm } from "./action-form";
import { Badge, Field, inputClass, labels, dateLabel } from "./ui";
type Incident = Awaited<
  ReturnType<typeof getPlatformIncidents>
>["incidents"][number];
export function IncidentCard({ incident }: { incident: Incident }) {
  return (
    <article
      key={incident.id}
      className="rounded-xl border border-slate-200 p-4"
    >
      <div className="flex flex-wrap gap-2">
        <Badge value={incident.status} />
        <Badge value={incident.priority} />
      </div>
      {incident.status !== "RESOLVED" && (
        <h3 className="mt-3 font-semibold">{incident.title}</h3>
      )}
      <p className="mt-1 text-xs text-slate-500">
        {incident.salon?.name ?? "Plateforme"} · {dateLabel(incident.createdAt)}
      </p>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
        {incident.description}
      </p>
      {incident.resolution && (
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-teal-50 p-3 text-sm text-teal-900">
          Dernière résolution : {incident.resolution}
        </p>
      )}
      <div className="mt-4 space-y-2">
        {incident.messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-lg p-3 text-sm ${message.internal ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-700"}`}
          >
            <p className="mb-1 text-xs font-semibold">
              {message.internal ? "Note interne" : "Message partagé"} ·{" "}
              {dateLabel(message.createdAt)}
            </p>
            <p className="whitespace-pre-wrap break-words">{message.body}</p>
          </div>
        ))}
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-teal-800">
          Répondre ou ajouter une note
        </summary>
        <div className="mt-3">
          <ActionForm kind="incidentMessage" submit="Enregistrer le message">
            <input type="hidden" name="incidentId" value={incident.id} />
            <Field label="Visibilité">
              <select className={inputClass} name="internal">
                <option value="false">Réponse partagée avec le salon</option>
                <option value="true">Note interne plateforme</option>
              </select>
            </Field>
            <Field label="Message">
              <textarea
                className={inputClass}
                name="body"
                required
                rows={3}
                maxLength={3000}
              />
            </Field>
          </ActionForm>
        </div>
      </details>
      {incident.status !== "RESOLVED" && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-teal-800">
            Mettre à jour
          </summary>
          <div className="mt-3">
            <ActionForm kind="incidentStatus" submit="Enregistrer">
              <input type="hidden" name="incidentId" value={incident.id} />
              <Field label="Statut">
                <select
                  name="status"
                  className={inputClass}
                  defaultValue={incident.status}
                >
                  {["OPEN", "IN_PROGRESS", "RESOLVED"].map((s) => (
                    <option key={s} value={s}>
                      {labels[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Résolution (obligatoire pour clôturer)">
                <textarea
                  className={inputClass}
                  name="resolution"
                  defaultValue={incident.resolution ?? ""}
                  maxLength={3000}
                  rows={3}
                />
              </Field>
            </ActionForm>
          </div>
        </details>
      )}
      {incident.status === "RESOLVED" && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <ActionForm kind="incidentStatus" submit="Rouvrir l’incident">
            <input type="hidden" name="incidentId" value={incident.id} />
            <input type="hidden" name="status" value="OPEN" />
            <input
              type="hidden"
              name="resolution"
              value={incident.resolution ?? ""}
            />
            <p className="text-xs text-slate-600">
              L’incident reviendra dans la liste à traiter. Ses échanges et sa
              dernière résolution sont conservés.
            </p>
          </ActionForm>
        </div>
      )}
    </article>
  );
}
