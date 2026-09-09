"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createEmployeeAction,
  updateEmployeeAction,
  setEmployeeActiveAction,
  saveEmployeeAccessAction,
  saveEmployeeSkillsAction,
} from "@/features/employees/server/actions";

const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-400 bg-white px-3 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:border-violet-600 focus:ring-2 focus:ring-violet-200 disabled:bg-slate-100";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

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

type SkillCategory = { id: string; name: string };
type SkillService = { id: string; categoryId: string; name: string };

export function EmployeesAdmin({
  employees,
  categories,
  services,
}: {
  employees: EmployeeRow[];
  categories: SkillCategory[];
  services: SkillService[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

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
        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-950">
          {message}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-semibold text-slate-950">
          Ajouter une employée
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          La fiche planning peut exister sans compte de connexion.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            className={inputClass}
            placeholder="Prénom *"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Nom"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Téléphone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <button
          type="button"
          disabled={pending || !firstName.trim()}
          className={`${buttonClass} mt-4 bg-violet-700 text-white hover:bg-violet-800`}
          onClick={() =>
            run(async () => {
              const result = await createEmployeeAction({
                firstName,
                lastName: lastName || null,
                phone: phone || null,
              });
              if (result.ok) {
                setFirstName("");
                setLastName("");
                setPhone("");
              }
              return result;
            }, "Employée ajoutée.")
          }
        >
          Ajouter l’employée
        </button>
      </section>

      <section className="space-y-4">
        {employees.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
            Aucune employée. Ajoutez la première employée ci-dessus.
          </div>
        ) : (
          employees.map((employee) => (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              pending={pending}
              run={run}
              categories={categories}
              services={services}
            />
          ))
        )}
      </section>
    </div>
  );
}

function EmployeeCard({
  employee,
  pending,
  run,
  categories,
  services,
}: {
  employee: EmployeeRow;
  pending: boolean;
  run: (
    action: () => Promise<
      { ok: true; data: unknown } | { ok: false; message: string; code: string }
    >,
    success: string,
  ) => void;
  categories: SkillCategory[];
  services: SkillService[];
}) {
  const [firstName, setFirstName] = useState(employee.firstName);
  const [lastName, setLastName] = useState(employee.lastName ?? "");
  const [phone, setPhone] = useState(employee.phone ?? "");
  const [email, setEmail] = useState(employee.user?.email ?? "");
  const [password, setPassword] = useState("");
  const [canManageSalon, setCanManageSalon] = useState(
    employee.user?.canManageSalon ?? false,
  );
  const [accessActive, setAccessActive] = useState(
    employee.user?.isActive ?? true,
  );
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>(
    employee.skills.map((skill) => skill.serviceId),
  );

  const servicesByCategory = categories
    .map((category) => ({
      ...category,
      services: services.filter(
        (service) => service.categoryId === category.id,
      ),
    }))
    .filter((category) => category.services.length > 0);

  function toggleSkill(serviceId: string) {
    setSelectedSkillIds((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId],
    );
  }

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">
            {employee.firstName} {employee.lastName ?? ""}
          </h3>
          <p className="text-sm text-slate-600">
            {employee.isActive ? "Active dans le planning" : "Désactivée"}
            {employee.user
              ? ` · accès ${employee.user.isActive ? "actif" : "désactivé"}`
              : " · aucun accès"}
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          className={`${buttonClass} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}
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
          {employee.isActive ? "Désactiver" : "Réactiver"}
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <input
          className={inputClass}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <input
          className={inputClass}
          value={lastName}
          placeholder="Nom"
          onChange={(e) => setLastName(e.target.value)}
        />
        <input
          className={inputClass}
          value={phone}
          placeholder="Téléphone"
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <button
        type="button"
        disabled={pending || !firstName.trim()}
        className={`${buttonClass} mt-3 bg-slate-900 text-white hover:bg-slate-800`}
        onClick={() =>
          run(
            () =>
              updateEmployeeAction({
                employeeId: employee.id,
                firstName,
                lastName: lastName || null,
                phone: phone || null,
              }),
            "Fiche employée enregistrée.",
          )
        }
      >
        Enregistrer la fiche
      </button>

      <details className="group mt-6 rounded-2xl border border-slate-200 bg-slate-50/60">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block font-semibold text-slate-950">
              Compétences prestations
            </span>
            <span className="mt-0.5 block text-xs font-medium text-slate-500">
              {selectedSkillIds.length > 0
                ? `${selectedSkillIds.length} compétence${selectedSkillIds.length > 1 ? "s" : ""}`
                : "À configurer"}
            </span>
          </span>
          <span className="text-lg text-slate-400 transition-transform group-open:rotate-180">
            ⌄
          </span>
        </summary>
        <div className="border-t border-slate-200 p-4">
          <p className="max-w-3xl text-sm leading-6 text-slate-600">
            Cochez uniquement les prestations que cette employée sait réellement
            réaliser. Ces compétences sont utilisées par l’anti-surbooking avant
            chaque réservation. Dès qu’une première compétence est enregistrée
            dans le salon, le contrôle devient strict : une prestation sans
            employée compétente sera bloquée jusqu’à configuration.
          </p>

          <div className="mt-4 space-y-4">
            {servicesByCategory.map((category) => (
              <fieldset
                key={category.id}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <legend className="px-2 text-sm font-bold text-slate-900">
                  {category.name}
                </legend>
                <div className="mt-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {category.services.map((service) => (
                    <label
                      key={service.id}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 hover:border-violet-300 hover:bg-violet-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSkillIds.includes(service.id)}
                        onChange={() => toggleSkill(service.id)}
                      />
                      <span>{service.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          <button
            type="button"
            disabled={pending}
            className={`${buttonClass} mt-4 bg-violet-700 text-white hover:bg-violet-800`}
            onClick={() =>
              run(
                () =>
                  saveEmployeeSkillsAction({
                    employeeId: employee.id,
                    serviceIds: selectedSkillIds,
                  }),
                "Compétences enregistrées. La capacité du planning a été recalibrée.",
              )
            }
          >
            Enregistrer les compétences
          </button>
        </div>
      </details>

      <div className="mt-6 border-t border-slate-200 pt-5">
        <h4 className="font-semibold text-slate-950">Compte de connexion</h4>
        <p className="mt-1 text-sm text-slate-600">
          Optionnel. Le mot de passe est obligatoire uniquement lors de la
          création du compte. S’il est ressaisi ensuite, il est réinitialisé.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            className={inputClass}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className={inputClass}
            type="password"
            placeholder={
              employee.user
                ? "Nouveau mot de passe (optionnel)"
                : "Mot de passe temporaire (12 caractères min.)"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-5 text-sm text-slate-800">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={canManageSalon}
              onChange={(e) => setCanManageSalon(e.target.checked)}
            />{" "}
            Gestion du salon
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={accessActive}
              onChange={(e) => setAccessActive(e.target.checked)}
            />{" "}
            Accès actif
          </label>
        </div>
        <button
          type="button"
          disabled={
            pending || !email.trim() || (!employee.user && password.length < 12)
          }
          className={`${buttonClass} mt-4 bg-violet-700 text-white hover:bg-violet-800`}
          onClick={() =>
            run(
              () =>
                saveEmployeeAccessAction({
                  employeeId: employee.id,
                  email,
                  ...(password ? { temporaryPassword: password } : {}),
                  canManageSalon,
                  isActive: accessActive,
                }),
              employee.user ? "Accès mis à jour." : "Compte de connexion créé.",
            )
          }
        >
          {employee.user ? "Enregistrer l’accès" : "Créer l’accès"}
        </button>
      </div>
    </article>
  );
}
