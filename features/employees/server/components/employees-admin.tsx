"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Plus,
  Search,
  X,
} from "lucide-react";

import {
  createEmployeeAction,
  updateEmployeeAction,
  setEmployeeActiveAction,
  saveEmployeeAccessAction,
  saveEmployeeSkillsAction,
} from "@/features/employees/server/actions";

type EmployeeRow = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  isActive: boolean;
  skills: Array<{ serviceId: string }>;
  user: {
    id: string;
    email: string;
    canManageSalon: boolean;
    isActive: boolean;
  } | null;
};
type Category = { id: string; name: string };
type Service = { id: string; categoryId: string; name: string };
type Detail = {
  id: string;
  appointmentId: string;
  serviceName: string;
  clientName: string;
  finishedAt: string;
};
type ActivityItem = {
  employeeId: string;
  name: string;
  completedServices: number;
  appointmentCount: number;
  details: Detail[];
};
type TeamActivity = {
  today: ActivityItem[];
  week: ActivityItem[];
  month: ActivityItem[];
};
type Period = keyof TeamActivity;

const input =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100";
const primary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50";
const secondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";

export function EmployeesAdmin({
  employees,
  categories,
  services,
  activity,
}: {
  employees: EmployeeRow[];
  categories: Category[];
  services: Service[];
  activity: TeamActivity;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = (
    fn: () => Promise<
      { ok: true; data: unknown } | { ok: false; message: string; code: string }
    >,
    ok: string,
  ) => {
    setMessage(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) {
        setMessage(r.message);
        return;
      }
      setMessage(ok);
      router.refresh();
    });
  };

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("fr");
    if (!q) return employees;
    return employees.filter((e) =>
      [e.firstName, e.lastName ?? "", e.phone ?? "", e.user?.email ?? ""]
        .join(" ")
        .toLocaleLowerCase("fr")
        .includes(q),
    );
  }, [employees, query]);

  const selected = employees.find((e) => e.id === selectedId) ?? null;
  if (selected)
    return (
      <EmployeeSheet
        employee={selected}
        categories={categories}
        services={services}
        activity={activity}
        pending={pending}
        run={run}
        onBack={() => setSelectedId(null)}
        message={message}
      />
    );

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/planning"
            className="text-sm font-semibold text-slate-500 hover:text-slate-900"
          >
            ← Planning
          </Link>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            Équipe
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {employees.filter((e) => e.isActive).length} employées actives
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/employees/unavailability" className={secondary}>
            <CalendarDays className="h-4 w-4" />
            Indisponibilités
          </Link>
          <button className={primary} onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Ajouter
          </button>
        </div>
      </header>

      {message ? <Notice>{message}</Notice> : null}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className={`${input} pl-10`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher par nom ou téléphone…"
        />
      </div>

      {creating ? (
        <CreateCard
          pending={pending}
          run={run}
          close={() => setCreating(false)}
        />
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {visible.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Aucune employée trouvée.
          </div>
        ) : (
          visible.map((e, index) => {
            const a = activity.today.find((x) => x.employeeId === e.id);
            const names = e.skills
              .map((k) => services.find((s) => s.id === k.serviceId)?.name)
              .filter(Boolean) as string[];
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setSelectedId(e.id)}
                className={`group flex w-full items-center gap-3 p-4 text-left transition hover:bg-rose-50/40 sm:p-5 ${index ? "border-t border-slate-100" : ""}`}
              >
                <Avatar e={e} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-semibold text-slate-950">
                      {e.firstName} {e.lastName ?? ""}
                    </h2>
                    {!e.isActive ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        Désactivée
                      </span>
                    ) : null}
                    {e.user?.canManageSalon ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        Responsable
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                    {names
                      .slice(0, 3)
                      .map((n) => <span key={n}>{n}</span>)
                      .reduce<React.ReactNode[]>(
                        (acc, node, i) => [
                          ...acc,
                          ...(i ? [<span key={`dot-${i}`}>·</span>] : []),
                          node,
                        ],
                        [],
                      )}
                    {names.length > 3 ? (
                      <span>· +{names.length - 3}</span>
                    ) : null}
                    {!names.length ? (
                      <span>Compétences à configurer</span>
                    ) : null}
                  </div>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="font-semibold text-slate-900">
                    {a?.completedServices ?? 0} prestation
                    {(a?.completedServices ?? 0) > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-slate-500">
                    {a?.appointmentCount ?? 0} RDV aujourd’hui
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-rose-600" />
              </button>
            );
          })
        )}
      </section>
    </div>
  );
}

function EmployeeSheet({
  employee,
  categories,
  services,
  activity,
  pending,
  run,
  onBack,
  message,
}: {
  employee: EmployeeRow;
  categories: Category[];
  services: Service[];
  activity: TeamActivity;
  pending: boolean;
  run: (
    fn: () => Promise<
      { ok: true; data: unknown } | { ok: false; message: string; code: string }
    >,
    ok: string,
  ) => void;
  onBack: () => void;
  message: string | null;
}) {
  const [tab, setTab] = useState<"activity" | "profile" | "skills">("activity");
  const [period, setPeriod] = useState<Period>("today");
  const [firstName, setFirstName] = useState(employee.firstName);
  const [lastName, setLastName] = useState(employee.lastName ?? "");
  const [phone, setPhone] = useState(employee.phone ?? "");
  const [email, setEmail] = useState(employee.user?.email ?? "");
  const [password, setPassword] = useState("");
  const [manager, setManager] = useState(
    employee.user?.canManageSalon ?? false,
  );
  const [accessActive, setAccessActive] = useState(
    employee.user?.isActive ?? true,
  );
  const [skillIds, setSkillIds] = useState(
    employee.skills.map((s) => s.serviceId),
  );
  const item = activity[period].find((a) => a.employeeId === employee.id);
  const periodLabel = {
    today: "Aujourd’hui",
    week: "Cette semaine",
    month: "Ce mois",
  }[period];

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950"
      >
        <ArrowLeft className="h-4 w-4" />
        Équipe
      </button>
      {message ? <Notice>{message}</Notice> : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Avatar e={employee} large />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold text-slate-950">
                {employee.firstName} {employee.lastName ?? ""}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {employee.user?.canManageSalon ? "Responsable" : "Employée"} ·{" "}
                {employee.isActive ? "Active" : "Désactivée"}
              </p>
            </div>
          </div>
          <Link href="/employees/unavailability" className={secondary}>
            <CalendarDays className="h-4 w-4" />
            Gérer les indisponibilités
          </Link>
        </div>

        <nav className="mt-6 flex overflow-x-auto border-b border-slate-200">
          <Tab active={tab === "activity"} onClick={() => setTab("activity")}>
            Activité
          </Tab>
          <Tab active={tab === "profile"} onClick={() => setTab("profile")}>
            Profil
          </Tab>
          <Tab active={tab === "skills"} onClick={() => setTab("skills")}>
            Compétences
          </Tab>
        </nav>

        {tab === "activity" ? (
          <div className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Activité</h2>
                <p className="text-sm text-slate-500">
                  Uniquement les prestations terminées.
                </p>
              </div>
              <div className="flex rounded-xl bg-slate-100 p-1">
                {(["today", "week", "month"] as Period[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => setPeriod(k)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold ${period === k ? "bg-white text-rose-800 shadow-sm" : "text-slate-500"}`}
                  >
                    {k === "today" ? "Jour" : k === "week" ? "Semaine" : "Mois"}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Kpi value={item?.completedServices ?? 0} label="Prestations" />
              <Kpi value={item?.appointmentCount ?? 0} label="RDV concernés" />
            </div>
            <div className="mt-7">
              <h3 className="font-bold text-slate-950">{periodLabel}</h3>
              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                {!item?.details.length ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    Aucune prestation terminée sur cette période.
                  </div>
                ) : (
                  item.details.map((d, i) => (
                    <Link
                      href={`/appointments/${d.appointmentId}`}
                      key={d.id}
                      className={`flex items-center gap-3 p-4 hover:bg-slate-50 ${i ? "border-t border-slate-100" : ""}`}
                    >
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                        <Check className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {d.serviceName}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {d.clientName}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                        <Clock3 className="h-3.5 w-3.5" />
                        {new Intl.DateTimeFormat("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Africa/Casablanca",
                        }).format(new Date(d.finishedAt))}
                      </div>
                    </Link>
                  ))
                )}
              </div>
              {(item?.completedServices ?? 0) > (item?.details.length ?? 0) ? (
                <p className="mt-2 text-xs text-slate-400">
                  Les 12 dernières prestations sont affichées.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {tab === "profile" ? (
          <div className="pt-6">
            <h2 className="text-lg font-bold text-slate-950">Profil</h2>
            <p className="mt-1 text-sm text-slate-500">
              Informations utilisées dans le planning.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Prénom
                <input
                  className={`${input} mt-1`}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Nom
                <input
                  className={`${input} mt-1`}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Téléphone
                <input
                  className={`${input} mt-1`}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
            </div>
            <button
              disabled={pending || !firstName.trim()}
              className={`${primary} mt-4`}
              onClick={() =>
                run(
                  () =>
                    updateEmployeeAction({
                      employeeId: employee.id,
                      firstName,
                      lastName: lastName || null,
                      phone: phone || null,
                    }),
                  "Profil enregistré.",
                )
              }
            >
              Enregistrer
            </button>

            <details className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer list-none font-semibold text-slate-800">
                Accès et paramètres avancés
              </summary>
              <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    className={input}
                    type="email"
                    placeholder="Email de connexion"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <input
                    className={input}
                    type="password"
                    placeholder={
                      employee.user
                        ? "Nouveau mot de passe (optionnel)"
                        : "Mot de passe temporaire"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={manager}
                    onChange={(e) => setManager(e.target.checked)}
                  />
                  Responsable — gestion opérationnelle du salon
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={accessActive}
                    onChange={(e) => setAccessActive(e.target.checked)}
                  />
                  Compte actif
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={
                      pending ||
                      !email.trim() ||
                      (!employee.user && password.length < 12)
                    }
                    className={secondary}
                    onClick={() =>
                      run(
                        () =>
                          saveEmployeeAccessAction({
                            employeeId: employee.id,
                            email,
                            ...(password
                              ? { temporaryPassword: password }
                              : {}),
                            canManageSalon: manager,
                            isActive: accessActive,
                          }),
                        employee.user ? "Accès mis à jour." : "Compte créé.",
                      )
                    }
                  >
                    {employee.user ? "Enregistrer l’accès" : "Créer le compte"}
                  </button>
                  <button
                    disabled={pending}
                    className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-red-700 hover:bg-red-50"
                    onClick={() =>
                      run(
                        () =>
                          setEmployeeActiveAction({
                            employeeId: employee.id,
                            isActive: !employee.isActive,
                          }),
                        employee.isActive
                          ? "Employée désactivée."
                          : "Employée réactivée.",
                      )
                    }
                  >
                    {employee.isActive
                      ? "Désactiver l’employée"
                      : "Réactiver l’employée"}
                  </button>
                </div>
              </div>
            </details>
          </div>
        ) : null}

        {tab === "skills" ? (
          <div className="pt-6">
            <h2 className="text-lg font-bold text-slate-950">Compétences</h2>
            <p className="mt-1 text-sm text-slate-500">
              Elles déterminent les prestations auxquelles l’employée peut être
              affectée.
            </p>
            <div className="mt-5 space-y-4">
              {categories.map((c) => {
                const list = services.filter((s) => s.categoryId === c.id);
                if (!list.length) return null;
                return (
                  <div key={c.id}>
                    <p className="mb-2 text-sm font-bold text-slate-800">
                      {c.name}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {list.map((s) => {
                        const checked = skillIds.includes(s.id);
                        return (
                          <button
                            type="button"
                            key={s.id}
                            onClick={() =>
                              setSkillIds((cur) =>
                                checked
                                  ? cur.filter((x) => x !== s.id)
                                  : [...cur, s.id],
                              )
                            }
                            className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold ${checked ? "border-rose-300 bg-rose-50 text-rose-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
                          >
                            {checked ? <Check className="h-3.5 w-3.5" /> : null}
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              disabled={pending}
              className={`${primary} mt-6`}
              onClick={() =>
                run(
                  () =>
                    saveEmployeeSkillsAction({
                      employeeId: employee.id,
                      serviceIds: skillIds,
                    }),
                  "Compétences enregistrées.",
                )
              }
            >
              Enregistrer les compétences
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function CreateCard({
  pending,
  run,
  close,
}: {
  pending: boolean;
  run: (
    fn: () => Promise<
      { ok: true; data: unknown } | { ok: false; message: string; code: string }
    >,
    ok: string,
  ) => void;
  close: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  return (
    <section className="rounded-3xl border border-rose-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-bold text-slate-950">Ajouter une employée</h2>
          <p className="mt-1 text-sm text-slate-500">
            Le compte de connexion et les compétences pourront être ajoutés
            ensuite.
          </p>
        </div>
        <button onClick={close} className="rounded-lg p-2 hover:bg-slate-100">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <input
          className={input}
          placeholder="Prénom *"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <input
          className={input}
          placeholder="Nom"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
        <input
          className={input}
          placeholder="Téléphone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <button
        disabled={pending || !firstName.trim()}
        className={`${primary} mt-4`}
        onClick={() =>
          run(async () => {
            const r = await createEmployeeAction({
              firstName,
              lastName: lastName || null,
              phone: phone || null,
            });
            if (r.ok) close();
            return r;
          }, "Employée ajoutée.")
        }
      >
        Ajouter
      </button>
    </section>
  );
}

function Avatar({ e, large = false }: { e: EmployeeRow; large?: boolean }) {
  const t = `${e.firstName[0] ?? ""}${e.lastName?.[0] ?? ""}`.toUpperCase();
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-rose-100 to-orange-50 font-bold text-rose-800 ring-1 ring-rose-100 ${large ? "h-16 w-16 text-lg" : "h-11 w-11 text-sm"}`}
    >
      {t || <CircleUserRound />}
    </div>
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
      className={`min-h-12 whitespace-nowrap border-b-2 px-4 text-sm font-semibold ${active ? "border-rose-500 text-rose-800" : "border-transparent text-slate-500"}`}
    >
      {children}
    </button>
  );
}
function Kpi({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5">
      <p className="text-3xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-950">
      {children}
    </div>
  );
}
