"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bath,
  BedSingle,
  CalendarOff,
  ChevronDown,
  CirclePlus,
  Pencil,
  Search,
  Users,
  X,
} from "lucide-react";

import {
  createRoomAction,
  updateRoomAction,
} from "@/features/rooms/server/actions/room-actions";
import {
  createRoomUnavailabilityAction,
  deleteRoomUnavailabilityAction,
} from "@/features/unavailability/server/actions/unavailability-actions";
import {
  casablancaLocalDateTimeToIso,
  formatSalonDateTime,
} from "@/features/appointments/lib/casablanca-local-datetime";

const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-[16px] text-slate-950 outline-none placeholder:text-slate-400 focus:border-violet-600 focus:ring-2 focus:ring-violet-100 sm:text-sm";
const primary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-40";
const secondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40";

type Room = {
  id: string;
  name: string;
  type: "HAMAM" | "TREATMENT_ROOM";
  capacity: number;
  isActive: boolean;
  unavailabilities: Array<{
    id: string;
    startAt: Date | string;
    endAt: Date | string;
    reason: string | null;
  }>;
};

function typeLabel(type: Room["type"]) {
  return type === "HAMAM" ? "Hammam" : "Salle de soins";
}
function formatDateTime(value: Date | string) {
  return formatSalonDateTime(value, "fr-MA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RoomsAdmin({
  rooms,
  isAdmin,
  canManage,
}: {
  rooms: Room[];
  isAdmin: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [creating, setCreating] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("fr");
    return rooms.filter((room) => {
      if (filter === "ACTIVE" && !room.isActive) return false;
      if (filter === "INACTIVE" && room.isActive) return false;
      if (!q) return true;
      return `${room.name} ${typeLabel(room.type)}`
        .toLocaleLowerCase("fr")
        .includes(q);
    });
  }, [rooms, query, filter]);

  const activeCount = rooms.filter((room) => room.isActive).length;
  const inactiveCount = rooms.length - activeCount;

  function run(
    action: () => Promise<
      { ok: true; data: unknown } | { ok: false; message: string; code: string }
    >,
    success: string,
    after?: () => void,
  ) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setMessage(success);
      after?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {message ? (
        <div role="status" className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-950">
          {message}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-3 gap-2 sm:max-w-md sm:flex-1">
            <Stat label="Toutes" value={rooms.length} active={filter === "ALL"} onClick={() => setFilter("ALL")} />
            <Stat label="Actives" value={activeCount} active={filter === "ACTIVE"} onClick={() => setFilter("ACTIVE")} />
            <Stat label="Inactives" value={inactiveCount} active={filter === "INACTIVE"} onClick={() => setFilter("INACTIVE")} />
          </div>
          {isAdmin ? (
            <button className={primary} onClick={() => setCreating(true)}>
              <CirclePlus className="h-4 w-4" /> Ajouter une salle
            </button>
          ) : null}
        </div>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input
            className={`${inputClass} pl-9`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher une salle…"
            aria-label="Rechercher une salle"
          />
        </div>
      </section>

      {visible.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <BedSingle className="mx-auto h-7 w-7 text-slate-300" />
          <p className="mt-2 font-semibold text-slate-900">
            {rooms.length ? "Aucune salle ne correspond" : "Aucune salle configurée"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {rooms.length ? "Modifiez votre recherche ou le filtre." : "Ajoutez les espaces réellement utilisés par le salon."}
          </p>
        </div>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {visible.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              isAdmin={isAdmin}
              canManage={canManage}
              pending={pending}
              run={run}
            />
          ))}
        </section>
      )}

      {creating ? (
        <CreateRoomPanel
          pending={pending}
          onClose={() => setCreating(false)}
          run={run}
        />
      ) : null}
    </div>
  );
}

function Stat({label,value,active,onClick}:{label:string;value:number;active:boolean;onClick:()=>void}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-3 py-3 text-left transition ${
        active ? "border-violet-300 bg-violet-50 ring-1 ring-violet-100" : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <span className="block text-xl font-bold text-slate-950">{value}</span>
      <span className="text-xs font-medium text-slate-500">{label}</span>
    </button>
  );
}

function CreateRoomPanel({
  pending,
  onClose,
  run,
}: {
  pending: boolean;
  onClose: () => void;
  run: (
    action: () => Promise<{ ok: true; data: unknown } | { ok: false; message: string; code: string }>,
    success: string,
    after?: () => void,
  ) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<Room["type"]>("TREATMENT_ROOM");
  const [capacity, setCapacity] = useState(1);

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/35" onMouseDown={onClose}>
      <aside
        className="ml-auto flex h-full w-full max-w-md flex-col overflow-y-auto bg-[#fcfaf8] p-4 shadow-2xl sm:p-6"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">Configuration</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">Ajouter une salle</h2>
            <p className="mt-1 text-sm text-slate-500">Créez uniquement les espaces réellement réservables.</p>
          </div>
          <button aria-label="Fermer" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <Field label="Nom">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Salle soin 1" autoFocus />
          </Field>
          <Field label="Type">
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as Room["type"])}>
              <option value="TREATMENT_ROOM">Salle de soins</option>
              <option value="HAMAM">Hammam</option>
            </select>
          </Field>
          <Field label="Capacité">
            <div className="flex items-center rounded-xl border border-slate-300 bg-white">
              <button type="button" className="h-11 w-12 text-xl" onClick={() => setCapacity((v) => Math.max(1, v - 1))}>−</button>
              <input aria-label="Capacité" type="number" min={1} max={20} className="h-11 min-w-0 flex-1 border-x border-slate-200 text-center text-base outline-none" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
              <button type="button" className="h-11 w-12 text-xl" onClick={() => setCapacity((v) => Math.min(20, v + 1))}>+</button>
            </div>
          </Field>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-8">
          <button className={secondary} onClick={onClose}>Annuler</button>
          <button
            className={primary}
            disabled={pending || !name.trim() || capacity < 1}
            onClick={() => run(() => createRoomAction({ name, type, capacity }), "Salle ajoutée.", onClose)}
          >
            Ajouter
          </button>
        </div>
      </aside>
    </div>
  );
}

function RoomCard({
  room,
  isAdmin,
  canManage,
  pending,
  run,
}: {
  room: Room;
  isAdmin: boolean;
  canManage: boolean;
  pending: boolean;
  run: (
    action: () => Promise<{ ok: true; data: unknown } | { ok: false; message: string; code: string }>,
    success: string,
    after?: () => void,
  ) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(room.name);
  const [capacity, setCapacity] = useState(room.capacity);
  const [active, setActive] = useState(room.isActive);
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [reason, setReason] = useState("");

  const nextUnavailable = room.unavailabilities[0];

  return (
    <article className={`rounded-3xl border bg-white p-4 shadow-sm sm:p-5 ${room.isActive ? "border-slate-200" : "border-slate-200 opacity-75"}`}>
      <div className="flex items-start gap-3">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${room.type === "HAMAM" ? "bg-cyan-50 text-cyan-700" : "bg-violet-50 text-violet-700"}`}>
          {room.type === "HAMAM" ? <Bath className="h-5 w-5" /> : <BedSingle className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-semibold text-slate-950">{room.name}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${room.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {room.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
            <span>{typeLabel(room.type)}</span>
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {room.capacity} {room.capacity > 1 ? "personnes" : "personne"}</span>
          </div>
        </div>
        {isAdmin ? (
          <button className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label={`Modifier ${room.name}`} onClick={() => setEditing((v) => !v)}>
            {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          </button>
        ) : null}
      </div>

      {nextUnavailable ? (
        <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-3 text-sm text-amber-950">
          <div className="flex gap-2">
            <CalendarOff className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Indisponibilité prévue</p>
              <p className="mt-0.5 text-xs">
                {formatDateTime(nextUnavailable.startAt)} → {formatDateTime(nextUnavailable.endAt)}
                {nextUnavailable.reason ? ` · ${nextUnavailable.reason}` : ""}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Capacité">
              <input className={inputClass} type="number" min={1} max={20} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
            </Field>
          </div>
          <label className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">
            Salle active
            <input type="checkbox" className="h-5 w-5 accent-violet-700" checked={active} onChange={(e) => setActive(e.target.checked)} />
          </label>
          {!active && room.isActive ? (
            <p className="mt-2 text-xs text-slate-500">Une salle affectée à un futur rendez-vous ne pourra pas être désactivée.</p>
          ) : null}
          <button
            disabled={pending || !name.trim() || capacity < 1}
            className={`${primary} mt-3 w-full sm:w-auto`}
            onClick={() =>
              run(
                () => updateRoomAction({ roomId: room.id, name, capacity, isActive: active }),
                "Salle enregistrée.",
                () => setEditing(false),
              )
            }
          >
            Enregistrer
          </button>
        </div>
      ) : null}

      <div className="mt-4 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => setShowUnavailable((v) => !v)}
          className="flex min-h-10 w-full items-center justify-between gap-3 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <CalendarOff className="h-4 w-4 text-slate-400" />
            Indisponibilités
            {room.unavailabilities.length ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{room.unavailabilities.length}</span> : null}
          </span>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition ${showUnavailable ? "rotate-180" : ""}`} />
        </button>

        {showUnavailable ? (
          <div className="pt-3">
            {canManage && room.isActive ? (
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">Bloquer temporairement la salle</p>
                <p className="mt-1 text-xs text-slate-500">Ex. maintenance, panne, nettoyage exceptionnel. La salle ne sera plus proposée pendant cette période.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Début">
                    <input type="datetime-local" className={inputClass} value={startAt} onChange={(e) => setStartAt(e.target.value)} />
                  </Field>
                  <Field label="Fin">
                    <input type="datetime-local" className={inputClass} value={endAt} onChange={(e) => setEndAt(e.target.value)} />
                  </Field>
                </div>
                <Field label="Raison (optionnelle)" className="mt-3">
                  <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. climatisation en panne" />
                </Field>
                <button
                  disabled={pending || !startAt || !endAt}
                  className={`${secondary} mt-3 w-full sm:w-auto`}
                  onClick={() =>
                    run(
                      () =>
                        createRoomUnavailabilityAction({
                          roomId: room.id,
                          startAt: casablancaLocalDateTimeToIso(startAt.slice(0, 10), startAt.slice(11, 16)),
                          endAt: casablancaLocalDateTimeToIso(endAt.slice(0, 10), endAt.slice(11, 16)),
                          reason: reason.trim() || null,
                        }),
                      "Indisponibilité salle enregistrée.",
                      () => {
                        setStartAt("");
                        setEndAt("");
                        setReason("");
                      },
                    )
                  }
                >
                  Ajouter l’indisponibilité
                </button>
              </div>
            ) : null}

            <div className="mt-3 space-y-2">
              {room.unavailabilities.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500">Aucune indisponibilité à venir.</p>
              ) : (
                room.unavailabilities.map((item) => (
                  <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-slate-700">
                      <p className="font-semibold">{formatDateTime(item.startAt)} → {formatDateTime(item.endAt)}</p>
                      {item.reason ? <p className="mt-0.5 text-slate-500">{item.reason}</p> : null}
                    </div>
                    {canManage ? (
                      <button
                        disabled={pending}
                        onClick={() => run(() => deleteRoomUnavailabilityAction({ id: item.id }), "Indisponibilité supprimée.")}
                        className="min-h-9 self-start rounded-lg px-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 sm:self-auto"
                      >
                        Supprimer
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}
