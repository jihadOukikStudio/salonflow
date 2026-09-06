import Link from "next/link";

import { formatPlanningTime } from "@/features/planning/components/planning-formatters";
import type {
  PlanningAppointmentItem,
  PlanningRoomItem,
} from "@/features/planning/server";

type RoomPlanningViewProps = {
  rooms: PlanningRoomItem[];
  appointments: PlanningAppointmentItem[];
};

export function RoomPlanningView({
  rooms,
  appointments,
}: RoomPlanningViewProps) {
  const missingRooms = appointments.flatMap((appointment) =>
    appointment.services
      .filter(
        (service) => service.requiredRoomType !== null && service.room === null,
      )
      .map((service) => ({ appointment, service })),
  );

  return (
    <div className="space-y-4">
      {missingRooms.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-amber-950">
                Salles à affecter
              </h2>
              <p className="mt-1 text-sm text-amber-800">
                {missingRooms.length} prestation
                {missingRooms.length > 1 ? "s" : ""} nécessite une salle.
              </p>
            </div>
            <Link
              href="/organize"
              className="rounded-xl bg-amber-900 px-3 py-2 text-sm font-semibold text-white"
            >
              Organiser
            </Link>
          </div>
        </section>
      ) : null}

      {rooms.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-medium text-slate-800">Aucune salle active.</p>
          <Link
            href="/rooms"
            className="mt-3 inline-block text-sm font-semibold text-violet-700"
          >
            Gérer les salles
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {rooms.map((room) => {
            const assignments = appointments.flatMap((appointment) =>
              appointment.services
                .filter((service) => service.room?.id === room.id)
                .map((service) => ({ appointment, service })),
            );

            return (
              <section
                key={room.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <header className="border-b border-slate-100 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-slate-950">
                        {room.name}
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        {room.type === "HAMAM" ? "Hamam" : "Salle de soins"} ·
                        capacité {room.capacity}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-slate-500">
                      {assignments.length} utilisation
                      {assignments.length > 1 ? "s" : ""}
                    </span>
                  </div>
                </header>

                {room.unavailabilities.length > 0 ? (
                  <div className="space-y-2 border-b border-slate-100 bg-rose-50/60 p-3">
                    {room.unavailabilities.map((item) => (
                      <div key={item.id} className="text-sm text-rose-900">
                        <span className="font-semibold">Indisponible</span>{" "}
                        {formatPlanningTime(item.startAt)}–
                        {formatPlanningTime(item.endAt)}
                        {item.reason ? ` · ${item.reason}` : ""}
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="divide-y divide-slate-100">
                  {assignments.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">
                      Aucune utilisation ce jour.
                    </p>
                  ) : (
                    assignments.map(({ appointment, service }) => (
                      <Link
                        key={service.id}
                        href={`/appointments/${appointment.id}`}
                        className="block p-4 transition hover:bg-slate-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-950">
                              {service.name}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              {appointment.client.name} ·{" "}
                              {appointment.client.phone}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-slate-700">
                            {formatPlanningTime(appointment.scheduledStart)}–
                            {formatPlanningTime(appointment.scheduledEnd)}
                          </span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
