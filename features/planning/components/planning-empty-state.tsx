import Link from "next/link";

export function PlanningEmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <h2 className="text-lg font-semibold text-slate-950">
        Aucun rendez-vous pour cette journée
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Le planning est vide. Vous pouvez créer un nouveau rendez-vous lorsque
        le formulaire sera branché.
      </p>

      <Link
        href="/appointments/new"
        className="mt-6 inline-flex rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Nouveau rendez-vous
      </Link>
    </div>
  );
}
