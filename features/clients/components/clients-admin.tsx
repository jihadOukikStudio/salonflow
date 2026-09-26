"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Heart,
  Phone,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import { formatSalonDateTime } from "@/features/appointments/lib/casablanca-local-datetime";
import { appointmentUi } from "@/features/ui/status-visuals";
import {
  setClientActiveAdminAction,
  updateClientAdminAction,
} from "@/features/clients/server/actions/client-admin-actions";

const field =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100";
const primary =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-rose-700 px-4 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:opacity-50";

type Person = { firstName: string; lastName: string | null };
type ServiceRow = {
  id: string;
  serviceNameSnapshot: string;
  price: number;
  assignedEmployee: Person | null;
  performedByEmployee: Person | null;
};
type AppointmentRow = {
  id: string;
  scheduledStart: Date | string;
  status: string;
  payment: { status: string; amount: number } | null;
  services: ServiceRow[];
};
type ClientRow = {
  id: string;
  name: string | null;
  phone: string;
  internalNote: string | null;
  isActive: boolean;
  _count: { appointments: number };
  appointments: AppointmentRow[];
};

const statusLabels: Record<string, string> = {
  PLANNED: "Prévu",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminé",
  CLOSED: "Clôturé",
  CANCELLED: "Annulé",
};

function date(value: Date | string) {
  return formatSalonDateTime(value, "fr-MA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function fullName(value: Person | null) {
  return value
    ? [value.firstName, value.lastName].filter(Boolean).join(" ")
    : "Non affectée";
}
function money(value: number) {
  return `${new Intl.NumberFormat("fr-MA", {
    maximumFractionDigits: 2,
  }).format(value)} DH`;
}
function initials(name: string | null) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (!parts.length) return "?";
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export function ClientsAdmin({
  clients,
  canManage,
}: {
  clients: ClientRow[];
  canManage: boolean;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("fr");
    return clients.filter((client) => {
      if (!showInactive && !client.isActive) return false;
      if (!q) return true;
      return `${client.name ?? ""} ${client.phone}`
        .toLocaleLowerCase("fr")
        .includes(q);
    });
  }, [clients, query, showInactive]);

  const selected = clients.find((client) => client.id === selectedId) ?? null;
  if (selected) {
    return (
      <ClientSheet
        client={selected}
        canManage={canManage}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  const activeCount = clients.filter((client) => client.isActive).length;
  const withNotesCount = clients.filter(
    (client) => client.isActive && client.internalNote,
  ).length;

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Clientes actives
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-950">
            {activeCount}
          </p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700">
            <Heart className="h-3.5 w-3.5" /> Préférences enregistrées
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-950">
            {withNotesCount}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className={`${field} pl-10`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nom ou numéro de téléphone…"
              autoFocus
            />
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Voir les inactives
          </label>
        </div>
        <p className="mt-2 px-1 text-xs text-slate-500">
          {visible.length} cliente{visible.length > 1 ? "s" : ""} affichée
          {visible.length > 1 ? "s" : ""}
        </p>
      </section>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {visible.length === 0 ? (
          <div className="p-10 text-center">
            <UserRound className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">
              Aucune cliente trouvée
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">
              Vérifiez le nom ou le téléphone. Une nouvelle cliente est créée
              naturellement pendant la prise de rendez-vous.
            </p>
          </div>
        ) : (
          visible.map((client, index) => {
            const last = client.appointments.find(
              (appointment) => appointment.status !== "CANCELLED",
            );
            return (
              <button
                key={client.id}
                onClick={() => setSelectedId(client.id)}
                className={`group flex w-full items-center gap-3 p-4 text-left transition hover:bg-rose-50/40 sm:p-5 ${
                  index ? "border-t border-slate-100" : ""
                }`}
              >
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-50 text-sm font-bold text-rose-800">
                  {initials(client.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-slate-950">
                      {client.name?.trim() || "Cliente sans nom"}
                    </p>
                    {!client.isActive ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        Inactive
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
                    <Phone className="h-3.5 w-3.5" /> {client.phone}
                  </p>
                  {client.internalNote ? (
                    <p className="mt-1.5 line-clamp-1 text-xs font-medium text-rose-700">
                      ♥ {client.internalNote}
                    </p>
                  ) : null}
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-sm font-semibold text-slate-800">
                    {client._count.appointments} RDV
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {last
                      ? `Dernière visite · ${date(last.scheduledStart)}`
                      : "Aucune visite"}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-rose-600" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function ClientSheet({
  client,
  canManage,
  onBack,
}: {
  client: ClientRow;
  canManage: boolean;
  onBack: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "history">("overview");
  const [name, setName] = useState(client.name ?? "");
  const [phone, setPhone] = useState(client.phone);
  const [note, setNote] = useState(client.internalNote ?? "");
  const [editing, setEditing] = useState(false);

  const completed = client.appointments.filter(
    (appointment) =>
      appointment.status === "COMPLETED" || appointment.status === "CLOSED",
  );
  const serviceCount = completed.reduce(
    (count, appointment) => count + appointment.services.length,
    0,
  );
  const last =
    client.appointments.find(
      (appointment) => appointment.status !== "CANCELLED",
    ) ?? null;

  const run = (
    action: () => Promise<
      { ok: true; data: unknown } | { ok: false; message: string; code: string }
    >,
    success: string,
  ) => {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setMessage(success);
      setEditing(false);
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950"
      >
        <ArrowLeft className="h-4 w-4" /> Clientes
      </button>

      {message ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-950">
          {message}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-rose-50 text-lg font-bold text-rose-800">
                {initials(client.name)}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold text-slate-950">
                    {client.name?.trim() || "Cliente sans nom"}
                  </h2>
                  {!client.isActive ? (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
                      Inactive
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                  <Phone className="h-3.5 w-3.5" /> {client.phone}
                </p>
              </div>
            </div>
            {canManage ? (
              <button
                onClick={() => setEditing((value) => !value)}
                className="min-h-10 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {editing ? "Annuler" : "Modifier la fiche"}
              </button>
            ) : null}
          </div>
        </div>

        <nav className="flex border-y border-slate-100 bg-slate-50/60 px-3 sm:px-5">
          <Tab active={tab === "overview"} onClick={() => setTab("overview")}>
            Aperçu
          </Tab>
          <Tab active={tab === "history"} onClick={() => setTab("history")}>
            Historique ({client._count.appointments})
          </Tab>
        </nav>

        {tab === "overview" ? (
          <div className="p-5 sm:p-6">
            {editing ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">
                  Nom
                  <input
                    className={`${field} mt-1`}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Téléphone
                  <input
                    className={`${field} mt-1`}
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                  Préférences & notes permanentes
                  <textarea
                    className={`${field} mt-1 min-h-32 resize-y py-3`}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={2000}
                    placeholder="Ex. Coloration habituelle 6.3, préfère Lina, cuir chevelu sensible…"
                  />
                  <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">
                    À réserver aux informations utiles pour les prochains
                    rendez-vous. Les remarques propres à une prestation restent
                    sur le rendez-vous.
                  </span>
                </label>
                <div className="sm:col-span-2">
                  <button
                    disabled={pending || !name.trim() || !phone.trim()}
                    className={primary}
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
                  >
                    Enregistrer la fiche
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 sm:p-5">
                  <div className="flex items-center gap-2 text-rose-800">
                    <Heart className="h-4 w-4" />
                    <h3 className="text-sm font-bold">
                      Préférences & habitudes
                    </h3>
                  </div>
                  {client.internalNote ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                      {client.internalNote}
                    </p>
                  ) : (
                    <div className="mt-2">
                      <p className="text-sm text-slate-600">
                        Aucune préférence permanente enregistrée.
                      </p>
                      {canManage ? (
                        <button
                          onClick={() => setEditing(true)}
                          className="mt-2 text-sm font-semibold text-rose-700 hover:underline"
                        >
                          + Ajouter une préférence
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Kpi
                    icon={<CalendarDays className="h-4 w-4" />}
                    value={client._count.appointments}
                    label="Rendez-vous"
                  />
                  <Kpi
                    icon={<Sparkles className="h-4 w-4" />}
                    value={serviceCount}
                    label="Prestations terminées"
                  />
                  <Kpi
                    value={last ? date(last.scheduledStart) : "—"}
                    label="Dernière visite"
                    small
                    wide
                  />
                </div>

                {last ? (
                  <div className="mt-7">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Activité récente
                        </p>
                        <h3 className="mt-1 font-bold text-slate-950">
                          Dernière visite
                        </h3>
                      </div>
                      <button
                        onClick={() => setTab("history")}
                        className="text-xs font-semibold text-rose-700 hover:underline"
                      >
                        Tout l’historique
                      </button>
                    </div>
                    <AppointmentCard appointment={last} />
                  </div>
                ) : null}
              </>
            )}

            {canManage ? (
              <details className="mt-8 border-t border-slate-100 pt-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-500">
                  Paramètres avancés
                </summary>
                <button
                  disabled={pending}
                  className="mt-3 text-sm font-semibold text-red-700"
                  onClick={() =>
                    run(
                      () =>
                        setClientActiveAdminAction({
                          clientId: client.id,
                          isActive: !client.isActive,
                        }),
                      client.isActive
                        ? "Cliente désactivée."
                        : "Cliente réactivée.",
                    )
                  }
                >
                  {client.isActive
                    ? "Désactiver la cliente"
                    : "Réactiver la cliente"}
                </button>
              </details>
            ) : null}
          </div>
        ) : (
          <div className="p-5 sm:p-6">
            {client.appointments.length ? (
              <div className="space-y-3">
                {client.appointments.map((appointment) => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                  />
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">
                Aucun rendez-vous.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function AppointmentCard({ appointment }: { appointment: AppointmentRow }) {
  return (
    <Link
      href={`/appointments/${appointment.id}`}
      className="mt-3 block rounded-2xl border border-slate-200 p-4 transition hover:border-rose-200 hover:bg-rose-50/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950">
            {date(appointment.scheduledStart)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold ${appointmentUi(appointment.status).badge}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${appointmentUi(appointment.status).dot}`}
              />
              {statusLabels[appointment.status] ?? appointment.status}
            </span>
          </p>
        </div>
        {appointment.payment?.status === "PAID" ? (
          <p className="font-bold text-slate-950">
            {money(appointment.payment.amount)}
          </p>
        ) : null}
      </div>
      {appointment.services.length ? (
        <div className="mt-3 divide-y divide-slate-100 rounded-xl bg-slate-50 px-3">
          {appointment.services.map((service) => (
            <div
              key={service.id}
              className="flex items-center justify-between gap-3 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">
                  {service.serviceNameSnapshot}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {fullName(
                    service.performedByEmployee ?? service.assignedEmployee,
                  )}
                </p>
              </div>
              <span className="shrink-0 font-medium text-slate-700">
                {money(service.price)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-rose-700">
        Voir le rendez-vous <ChevronRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`min-h-12 border-b-2 px-4 text-sm font-semibold ${
        active
          ? "border-rose-500 text-rose-800"
          : "border-transparent text-slate-500 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

function Kpi({
  value,
  label,
  icon,
  small = false,
  wide = false,
}: {
  value: number | string;
  label: string;
  icon?: React.ReactNode;
  small?: boolean;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl bg-slate-50 p-3 sm:p-4 ${wide ? "col-span-2 sm:col-span-1" : ""}`}
    >
      <div className="flex items-center gap-1.5 text-slate-500">
        {icon}
        <p className="text-[11px] font-medium sm:text-xs">{label}</p>
      </div>
      <p
        className={`mt-2 ${
          small ? "text-sm sm:text-base" : "text-xl sm:text-2xl"
        } font-bold text-slate-950`}
      >
        {value}
      </p>
    </div>
  );
}
