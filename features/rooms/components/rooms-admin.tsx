"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createRoomAction,
  updateRoomAction,
} from "@/features/rooms/server/actions/room-actions";
import {
  createRoomUnavailabilityAction,
  deleteRoomUnavailabilityAction,
} from "@/features/unavailability/server/actions/unavailability-actions";
import { casablancaLocalDateTimeToIso } from "@/features/appointments/lib/casablanca-local-datetime";
const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-400 bg-white px-3 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:border-violet-600 focus:ring-2 focus:ring-violet-200";
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
  const [name, setName] = useState("");
  const [type, setType] = useState<"HAMAM" | "TREATMENT_ROOM">(
    "TREATMENT_ROOM",
  );
  const [capacity, setCapacity] = useState(1);
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
    <div className="space-y-6">
      {message ? (
        <div className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-950">
          {message}
        </div>
      ) : null}
      {isAdmin ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">
            Ajouter une salle
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <input
              className={inputClass}
              placeholder="Nom"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select
              className={inputClass}
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
            >
              <option value="HAMAM">Hamam</option>
              <option value="TREATMENT_ROOM">Salle de soins</option>
            </select>
            <input
              className={inputClass}
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </div>
          <button
            disabled={pending || !name.trim()}
            onClick={() =>
              run(
                () => createRoomAction({ name, type, capacity }),
                "Salle ajoutée.",
              )
            }
            className="mt-4 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Ajouter
          </button>
        </section>
      ) : null}
      <section className="space-y-4">
        {rooms.map((room) => (
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
    a: () => Promise<
      { ok: true; data: unknown } | { ok: false; message: string; code: string }
    >,
    s: string,
  ) => void;
}) {
  const [name, setName] = useState(room.name);
  const [capacity, setCapacity] = useState(room.capacity);
  const [active, setActive] = useState(room.isActive);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [reason, setReason] = useState("");
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">{room.name}</h3>
          <p className="text-sm text-slate-600">
            {room.type === "HAMAM" ? "Hamam" : "Salle de soins"} · capacité{" "}
            {room.capacity} · {room.isActive ? "active" : "inactive"}
          </p>
        </div>
      </div>
      {isAdmin ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className={inputClass}
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
          />
          <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />{" "}
            Salle active
          </label>
          <button
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  updateRoomAction({
                    roomId: room.id,
                    name,
                    capacity,
                    isActive: active,
                  }),
                "Salle enregistrée.",
              )
            }
            className="w-fit rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Enregistrer
          </button>
        </div>
      ) : null}
      {canManage && room.isActive ? (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <h4 className="font-semibold text-slate-950">Indisponibilité</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <input
              type="datetime-local"
              className={inputClass}
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
            <input
              type="datetime-local"
              className={inputClass}
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Raison"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <button
            disabled={pending || !startAt || !endAt}
            onClick={() =>
              run(
                () =>
                  createRoomUnavailabilityAction({
                    roomId: room.id,
                    startAt: casablancaLocalDateTimeToIso(
                      startAt.slice(0, 10),
                      startAt.slice(11, 16),
                    ),
                    endAt: casablancaLocalDateTimeToIso(
                      endAt.slice(0, 10),
                      endAt.slice(11, 16),
                    ),
                    reason: reason || null,
                  }),
                "Indisponibilité salle enregistrée.",
              )
            }
            className="mt-3 rounded-xl border border-violet-300 px-4 py-2 text-sm font-semibold text-violet-800"
          >
            Ajouter l’indisponibilité
          </button>
        </div>
      ) : null}
      <div className="mt-4 space-y-2">
        {room.unavailabilities.map((u) => (
          <div
            key={u.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2"
          >
            <span className="text-xs text-slate-700">
              {new Date(u.startAt).toLocaleString("fr-FR")} →{" "}
              {new Date(u.endAt).toLocaleString("fr-FR")}
              {u.reason ? ` · ${u.reason}` : ""}
            </span>
            {canManage ? (
              <button
                disabled={pending}
                onClick={() =>
                  run(
                    () => deleteRoomUnavailabilityAction({ id: u.id }),
                    "Indisponibilité supprimée.",
                  )
                }
                className="text-xs font-semibold text-red-700"
              >
                Supprimer
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </article>
  );
}
