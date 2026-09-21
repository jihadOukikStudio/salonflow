import { formatSalonDateTime } from "@/features/appointments/lib/casablanca-local-datetime";
export function formatPlanningTime(value: string): string {
  return formatSalonDateTime(value, "fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPlanningMoney(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 2,
  }).format(value);
}
