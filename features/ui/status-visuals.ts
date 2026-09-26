export type AppointmentUiStatus =
  "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CLOSED" | "CANCELLED";

export type ServiceUiStatus = "TODO" | "IN_PROGRESS" | "DONE";

export type EmployeeUnavailabilityUiType =
  "ABSENCE" | "BREAK" | "LEAVE" | "UNAVAILABLE";

export const appointmentStatusUi: Record<
  AppointmentUiStatus,
  {
    label: string;
    card: string;
    badge: string;
    dot: string;
    text: string;
  }
> = {
  PLANNED: {
    label: "Prévu",
    card: "border-sky-200 bg-sky-50/95 before:bg-sky-500",
    badge: "border-sky-200 bg-sky-50 text-sky-800",
    dot: "bg-sky-500",
    text: "text-sky-700",
  },
  IN_PROGRESS: {
    label: "En cours",
    card: "border-violet-300 bg-violet-50/95 before:bg-violet-600",
    badge: "border-violet-200 bg-violet-50 text-violet-800",
    dot: "bg-violet-600",
    text: "text-violet-700",
  },
  COMPLETED: {
    label: "Terminé",
    card: "border-emerald-300 bg-emerald-50/95 before:bg-emerald-600",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    dot: "bg-emerald-600",
    text: "text-emerald-700",
  },
  CLOSED: {
    label: "Clôturé",
    card: "border-teal-200 bg-teal-50/90 before:bg-teal-600",
    badge: "border-teal-200 bg-teal-50 text-teal-800",
    dot: "bg-teal-600",
    text: "text-teal-700",
  },
  CANCELLED: {
    label: "Annulé",
    card: "border-slate-200 bg-slate-100/90 before:bg-slate-400",
    badge: "border-slate-200 bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
    text: "text-slate-500",
  },
};

export const serviceStatusUi: Record<
  ServiceUiStatus,
  { label: string; badge: string; dot: string; text: string }
> = {
  TODO: {
    label: "À faire",
    badge: "border-sky-200 bg-sky-50 text-sky-800",
    dot: "bg-sky-500",
    text: "text-sky-700",
  },
  IN_PROGRESS: {
    label: "En cours",
    badge: "border-violet-200 bg-violet-50 text-violet-800",
    dot: "bg-violet-600",
    text: "text-violet-700",
  },
  DONE: {
    label: "Terminée",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    dot: "bg-emerald-600",
    text: "text-emerald-700",
  },
};

export const employeeUnavailabilityUi: Record<
  EmployeeUnavailabilityUiType,
  {
    label: string;
    block: string;
    badge: string;
    dot: string;
    text: string;
  }
> = {
  ABSENCE: {
    label: "Absence",
    block: "border-rose-200 bg-rose-50/95 text-rose-950",
    badge: "border-rose-200 bg-rose-50 text-rose-800",
    dot: "bg-rose-500",
    text: "text-rose-700",
  },
  BREAK: {
    label: "Pause",
    block: "border-slate-300 bg-slate-100/95 text-slate-800",
    badge: "border-slate-200 bg-slate-100 text-slate-700",
    dot: "bg-slate-500",
    text: "text-slate-600",
  },
  LEAVE: {
    label: "Congé",
    block: "border-amber-200 bg-amber-50/95 text-amber-950",
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
    text: "text-amber-700",
  },
  UNAVAILABLE: {
    label: "Indisponible",
    block: "border-orange-200 bg-orange-50/95 text-orange-950",
    badge: "border-orange-200 bg-orange-50 text-orange-800",
    dot: "bg-orange-500",
    text: "text-orange-700",
  },
};

export function appointmentUi(status: string) {
  return (
    appointmentStatusUi[status as AppointmentUiStatus] ??
    appointmentStatusUi.PLANNED
  );
}

export function serviceUi(status: string) {
  return serviceStatusUi[status as ServiceUiStatus] ?? serviceStatusUi.TODO;
}

export function employeeUnavailabilityVisual(type: string) {
  return (
    employeeUnavailabilityUi[type as EmployeeUnavailabilityUiType] ??
    employeeUnavailabilityUi.UNAVAILABLE
  );
}
