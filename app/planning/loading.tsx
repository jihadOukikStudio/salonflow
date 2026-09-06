function Skeleton({ className }: { className: string }) {
  return <div aria-hidden="true" className={`sf-skeleton ${className}`} />;
}

export default function PlanningLoading() {
  return (
    <main
      className="min-h-screen bg-slate-50"
      role="status"
      aria-live="polite"
      aria-label="Chargement du planning"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="h-10 w-56 rounded-2xl sm:w-72" />
            <Skeleton className="h-4 w-full max-w-md rounded-full" />
          </div>
          <Skeleton className="h-11 w-44 rounded-xl" />
        </div>

        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-28 shrink-0 rounded-xl" />
          ))}
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)]">
          <Skeleton className="h-11 rounded-xl" />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-2xl" />
            ))}
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-28 rounded-xl" />
          ))}
        </div>

        <div className="mt-5 space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-5 w-28 rounded-full" />
                  <Skeleton className="h-7 w-48 rounded-xl" />
                  <Skeleton className="h-4 w-64 max-w-full rounded-full" />
                </div>
                <Skeleton className="h-8 w-24 rounded-full" />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Skeleton className="h-12 rounded-xl" />
                <Skeleton className="h-12 rounded-xl" />
                <Skeleton className="h-12 rounded-xl" />
              </div>
            </div>
          ))}
        </div>

        <span className="sr-only">Chargement du planning en cours…</span>
      </div>
    </main>
  );
}
