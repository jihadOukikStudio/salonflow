"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { searchClientsAction } from "@/features/clients/server/actions";
import { createPlannedAppointmentAction } from "@/features/appointments/server/actions/appointment-actions";
import { casablancaLocalDateTimeToIso } from "@/features/appointments/lib/casablanca-local-datetime";
import type { NewAppointmentOptions, NewAppointmentClientOption } from "@/features/appointments/new/types";

const field = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100";

type DraftLine = {
  key: string;
  serviceId: string;
  time: string;
  employeeId: string;
  roomId: string;
  price: string;
};

type Props = NewAppointmentOptions & {
  dateKey: string;
  initialTime?: string;
  initialEmployeeId?: string;
  cancelHref: string;
};

export function PlanningAppointmentBuilder({ services, employees, rooms, dateKey, initialTime = "10:00", initialEmployeeId = "", cancelHref }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [clientQuery, setClientQuery] = useState("");
  const [clients, setClients] = useState<NewAppointmentClientOption[]>([]);
  const [client, setClient] = useState<NewAppointmentClientOption | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [clientNote, setClientNote] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);

  const serviceMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

  function addLine() {
    setLines((current) => [...current, { key: crypto.randomUUID(), serviceId: "", time: current.at(-1)?.time ?? initialTime, employeeId: current.length === 0 ? initialEmployeeId : "", roomId: "", price: "" }]);
  }

  function patchLine(key: string, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));
  }

  useEffect(() => {
    const query = clientQuery.trim();
    if (client || query.length < 2) {
      if (query.length < 2) setClients([]);
      return;
    }
    const timeout = window.setTimeout(() => {
      startTransition(async () => {
        const result = await searchClientsAction({ query });
        if (!result.ok) { setClients([]); return; }
        setClients(result.data.clients);
      });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [clientQuery, client]);

  function selectClient(item: NewAppointmentClientOption) {
    setClient(item);
    setClientQuery(`${item.name} · ${item.phone}`);
    setClientNote(item.internalNote ?? "");
    setClients([]);
    setError(null);
  }

  function clearSelectedClient() {
    setClient(null);
    setClientQuery("");
    setClientNote("");
    setClients([]);
  }

  function submit() {
    setError(null);
    const creatingClient = !client;
    if (creatingClient && (!newClientName.trim() || !newClientPhone.trim())) { setError("Cliente introuvable : renseignez son nom et son téléphone pour la créer avec le rendez-vous."); return; }
    if (lines.length === 0) { setError("Ajoutez au moins une prestation."); return; }

    const invalid = lines.find((line) => !line.serviceId || !line.time || !line.employeeId);
    if (invalid) { setError("Chaque prestation doit avoir une heure et une employée."); return; }
    const missingRoom = lines.find((line) => serviceMap.get(line.serviceId)?.requiredRoomType && !line.roomId);
    if (missingRoom) { setError("Affectez la salle requise avant de confirmer le rendez-vous."); return; }

    startTransition(async () => {
      const result = await createPlannedAppointmentAction({
        client: client
          ? { type: "existing", clientId: client.id, clientNote: clientNote || null }
          : { type: "new", name: newClientName.trim(), phone: newClientPhone.trim(), clientNote: clientNote || null },
        internalNote: note || null,
        services: lines.map((line) => ({
          serviceId: line.serviceId,
          scheduledStart: new Date(casablancaLocalDateTimeToIso(dateKey, line.time)),
          employeeId: line.employeeId,
          roomId: line.roomId || null,
          ...(line.price !== "" ? { price: Number(line.price) } : {}),
        })),
      });
      if (!result.ok) { setError(result.message); return; }
      router.push(`/appointments/${result.data.appointmentId}`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold text-slate-950">1. Cliente</h3>
          <p className="mt-1 text-sm text-slate-500">Tapez simplement le nom ou le téléphone. Si la cliente existe, sélectionnez-la. Sinon sa fiche sera créée à la confirmation.</p>
          <div className="relative mt-3">
            <input
              className={field}
              value={clientQuery}
              onChange={(e) => {
                if (client) clearSelectedClient();
                const value = e.target.value;
                setClientQuery(value);
                if (!client) {
                  if (/^[+\d\s().-]+$/.test(value)) setNewClientPhone(value);
                  else setNewClientName(value);
                }
              }}
              placeholder="Nom ou numéro de téléphone"
              autoComplete="off"
            />
            {clients.length > 0 ? (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {clients.map((item) => (
                  <button key={item.id} type="button" onClick={() => selectClient(item)} className="block min-h-11 w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50">
                    <strong>{item.name}</strong><span className="ml-2 text-slate-500">{item.phone}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {client ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <div className="flex items-start justify-between gap-3"><div><strong>{client.name}</strong><p className="text-slate-600">{client.phone}</p></div><button type="button" onClick={clearSelectedClient} className="font-semibold text-slate-700">Changer</button></div>
            </div>
          ) : clientQuery.trim().length >= 2 && clients.length === 0 && !pending ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-900">Cliente non trouvée ?</p>
              <p className="mt-1 text-xs text-slate-500">Renseignez les informations manquantes. La fiche sera créée automatiquement uniquement quand vous confirmerez le RDV.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input className={field} value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Nom de la cliente" />
                <input className={field} value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} placeholder="Téléphone" inputMode="tel" />
              </div>
            </div>
          ) : null}

          {(client || (newClientName.trim() && newClientPhone.trim())) ? (
            <div className="mt-3">
              <label className="text-sm font-semibold text-slate-800" htmlFor="client-note">Notes / préférences cliente</label>
              <textarea id="client-note" className={`${field} mt-1 min-h-20 py-3`} value={clientNote} onChange={(e) => setClientNote(e.target.value)} placeholder="Ex. préfère Lina, peau sensible, préfère le matin…" />
              <p className="mt-1 text-xs text-slate-500">Cette note appartient à la fiche cliente et restera visible pour ses prochains rendez-vous.</p>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-950">2. Prestations et affectations</h3><p className="mt-1 text-sm text-slate-500">Les choix sont préparés au fur et à mesure. Rien n'est confirmé avant le bouton final.</p></div><button type="button" onClick={addLine} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Ajouter</button></div>
          <div className="mt-4 space-y-3">
            {lines.length === 0 ? <button type="button" onClick={addLine} className="w-full rounded-2xl border border-dashed border-violet-300 bg-violet-50/40 p-6 text-sm font-semibold text-violet-800">+ Ajouter la première prestation</button> : null}
            {lines.map((line, index) => {
              const selected = serviceMap.get(line.serviceId);
              const capable = employees.filter((employee) => !line.serviceId || employee.serviceIds.includes(line.serviceId));
              const compatibleRooms = rooms.filter((room) => !selected?.requiredRoomType || room.type === selected.requiredRoomType);
              return <div key={line.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between"><strong className="text-sm">Prestation {index + 1}</strong><button type="button" aria-label="Supprimer la prestation" onClick={() => setLines((x) => x.filter((v) => v.key !== line.key))} className="rounded-lg p-2 text-rose-700"><Trash2 className="h-4 w-4" /></button></div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                  <select className={field} value={line.serviceId} onChange={(e) => { const s = serviceMap.get(e.target.value); patchLine(line.key, { serviceId: e.target.value, employeeId: capable.some((x) => x.id === line.employeeId) ? line.employeeId : "", roomId: "", price: s ? String(s.defaultPrice) : "" }); }}><option value="">Prestation…</option>{services.map((s) => <option key={s.id} value={s.id}>{s.categoryName} · {s.name}</option>)}</select>
                  <input className={field} type="time" step="900" value={line.time} onChange={(e) => patchLine(line.key, { time: e.target.value })} />
                  <select className={field} value={line.employeeId} onChange={(e) => patchLine(line.key, { employeeId: e.target.value })}><option value="">Employée…</option>{capable.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select>
                  <select className={field} value={line.roomId} onChange={(e) => patchLine(line.key, { roomId: e.target.value })}><option value="">{selected?.requiredRoomType ? "Salle requise…" : "Sans salle / optionnelle"}</option>{compatibleRooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select>
                  <input className={field} type="number" min="0" step="1" value={line.price} onChange={(e) => patchLine(line.key, { price: e.target.value })} placeholder="Prix DH" />
                </div>
                {selected ? <p className="mt-2 text-xs text-slate-500">Durée {selected.defaultDurationMinutes ?? "non configurée"} min · {selected.requiredRoomType ? "salle obligatoire" : "pas de salle obligatoire"}</p> : null}
              </div>;
            })}
          </div>
        </section>
      </div>

      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 lg:sticky lg:top-4">
        <p className="text-xs font-bold uppercase tracking-wider text-violet-700">RDV en préparation</p>
        <h3 className="mt-1 text-lg font-semibold">{client?.name ?? (newClientName || "Cliente à sélectionner")}</h3>
        <div className="mt-4 space-y-3">{lines.map((line) => { const service = serviceMap.get(line.serviceId); const employee = employees.find((e) => e.id === line.employeeId); const room = rooms.find((r) => r.id === line.roomId); return <div key={line.key} className="rounded-xl bg-slate-50 p-3 text-sm"><strong>{service?.name ?? "Prestation à choisir"}</strong><p className="mt-1 text-slate-600">{line.time || "--:--"} · {employee?.name ?? "Employée à affecter"}</p>{room ? <p className="text-slate-500">{room.name}</p> : null}</div>; })}</div>
        <textarea className={`${field} mt-4 min-h-24 py-3`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note interne du rendez-vous" />
        {error ? <div role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">{error}</div> : null}
        <div className="mt-4 grid gap-2"><button type="button" disabled={pending} onClick={submit} className="min-h-12 rounded-xl bg-violet-600 px-4 font-semibold text-white disabled:opacity-50">{pending ? "Contrôle final…" : "Confirmer le rendez-vous"}</button><button type="button" onClick={() => router.push(cancelHref)} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold">Annuler le brouillon</button></div>
        <p className="mt-3 text-xs leading-5 text-slate-500">À la confirmation, SalonFlow recontrôle en transaction les compétences, chevauchements, employées et salles. Si un conflit apparaît, le RDV n'est pas créé.</p>
      </aside>
    </div>
  );
}
