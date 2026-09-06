type PlanningSummaryProps = {
  appointmentCount: number;
  organizationIssues: number;
  inProgressCount: number;
  completedCount: number;
};

export function PlanningSummary({
  appointmentCount,
  organizationIssues,
  inProgressCount,
  completedCount,
}: PlanningSummaryProps) {
  const items = [
    { label: "Rendez-vous", value: appointmentCount },
    { label: "À organiser", value: organizationIssues },
    { label: "En cours", value: inProgressCount },
    { label: "Terminés", value: completedCount },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {item.label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
