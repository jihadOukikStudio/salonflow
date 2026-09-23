type PlanningSummaryProps = {
  appointmentCount: number;
  organizationIssues: number;
  inProgressCount: number;
  completedCount: number;
};

export function PlanningSummary({
  appointmentCount,
  inProgressCount,
  completedCount,
}: PlanningSummaryProps) {
  const items = [
    { label: "Rendez-vous", value: appointmentCount },
    { label: "En cours", value: inProgressCount },
    { label: "Terminés", value: completedCount },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:max-w-2xl sm:gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4"
        >
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
            {item.label}
          </p>
          <p className="mt-1 text-xl font-semibold text-slate-950 sm:text-2xl">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
