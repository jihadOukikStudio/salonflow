import { Sparkles } from "lucide-react";

export default function Loading() {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-slate-50 px-6"
      role="status"
      aria-live="polite"
      aria-label="Chargement de SalonFlow"
    >
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="sf-loading-mark relative flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-violet-200 bg-white shadow-sm">
          <div className="absolute inset-2 rounded-[1rem] border border-[color:var(--sf-champagne)]/35" />
          <Sparkles
            aria-hidden="true"
            className="relative h-6 w-6 text-violet-700"
            strokeWidth={1.55}
          />
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.28em] text-violet-700">
          SalonFlow
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">
          Le salon s&apos;organise
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Préparation de votre espace de travail…
        </p>

        <div className="mt-6 flex items-center gap-1.5" aria-hidden="true">
          <span className="sf-loading-dot h-1.5 w-1.5 rounded-full bg-violet-700" />
          <span className="sf-loading-dot h-1.5 w-1.5 rounded-full bg-[color:var(--sf-champagne)]" />
          <span className="sf-loading-dot h-1.5 w-1.5 rounded-full bg-violet-700" />
        </div>

        <span className="sr-only">Chargement en cours…</span>
      </div>
    </main>
  );
}
