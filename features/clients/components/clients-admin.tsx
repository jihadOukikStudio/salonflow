"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateClientAdminAction,
  setClientActiveAdminAction,
} from "@/features/clients/server/actions/client-admin-actions";

const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-400 bg-white px-3 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:border-violet-600 focus:ring-2 focus:ring-violet-200";

type ClientRow = {
  id: string;
  name: string | null;
  phone: string;
  internalNote: string | null;
  isActive: boolean;
  _count: { appointments: number };
  appointments: Array<{
    id: string;
    scheduledStart: Date | string;
    status: string;
  }>;
};

export function ClientsAdmin({
  clients,
  canManage,
}: {
  clients: ClientRow[];
  canManage: boolean;
}) {
  return (
    <div className="space-y-4">
      {clients.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
          Aucune cliente trouvée.
        </div>
      ) : (
        clients.map((client) => (
          <ClientCard key={client.id} client={client} canManage={canManage} />
        ))
      )}
    </div>
  );
}

function ClientCard({
  client,
  canManage,
}: {
  client: ClientRow;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState(client.name ?? "");
  const [phone, setPhone] = useState(client.phone);
  const [note, setNote] = useState(client.internalNote ?? "");

  function run(
    action: () => Promise<
      { ok: true; data: unknown } | { ok: false; message: string; code: string }
    >,
    success: string,
  ) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return setMessage(result.message);
      setMessage(success);
      router.refresh();
    });
  }

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            {client.name?.trim() || "Cliente sans nom"}
          </h2>
          <p className="text-sm text-slate-600">
            {client.phone} · {client._count.appointments} rendez-vous ·{" "}
            {client.isActive ? "active" : "inactive"}
          </p>
        </div>
        {canManage ? (
          <button
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  setClientActiveAdminAction({
                    clientId: client.id,
                    isActive: !client.isActive,
                  }),
                client.isActive ? "Cliente désactivée." : "Cliente réactivée.",
              )
            }
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800"
          >
            {client.isActive ? "Désactiver" : "Réactiver"}
          </button>
        ) : null}
      </div>
      {message ? (
        <p className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-950">
          {message}
        </p>
      ) : null}
      {canManage ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom"
          />
          <input
            className={inputClass}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Téléphone"
          />
          <textarea
            className={`${inputClass} min-h-24 py-3 sm:col-span-2`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note interne"
          />
          <button
            disabled={pending || !name.trim() || !phone.trim()}
            onClick={() =>
              run(
                () =>
                  updateClientAdminAction({
                    clientId: client.id,
                    name,
                    phone,
                    internalNote: note || null,
                  }),
                "Fiche cliente enregistrée.",
              )
            }
            className="w-fit rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Enregistrer
          </button>
        </div>
      ) : null}
      {client.appointments.length > 0 ? (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-slate-900">
            Derniers rendez-vous
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {client.appointments.map((a) => (
              <Link
                key={a.id}
                href={`/appointments/${a.id}`}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {new Date(a.scheduledStart).toLocaleDateString("fr-FR")} ·{" "}
                {a.status}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}
