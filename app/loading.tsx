import { SalonFlowLogo } from "@/features/brand/components/salonflow-logo";

export default function Loading() {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-slate-50 px-6"
      role="status"
      aria-live="polite"
      aria-label="Chargement de SalonFlow"
    >
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="sf-loading-mark rounded-full bg-white p-1.5 shadow-sm ring-1 ring-slate-200">
          <SalonFlowLogo size={74} showName={false} />
        </div>

        <p className="mt-6 font-[family-name:var(--font-salonflow-display)] text-3xl font-semibold text-slate-950">
          SalonFlow
        </p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Le 7ème Sens · Marrakech
        </p>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Préparation de votre espace de travail…
        </p>

        <div className="mt-6 flex items-center gap-1.5" aria-hidden="true">
          <span className="sf-loading-dot h-1.5 w-1.5 rounded-full bg-violet-700" />
          <span className="sf-loading-dot h-1.5 w-1.5 rounded-full bg-rose-500" />
          <span className="sf-loading-dot h-1.5 w-1.5 rounded-full bg-violet-700" />
        </div>

        <span className="sr-only">Chargement en cours…</span>
      </div>
    </main>
  );
}
