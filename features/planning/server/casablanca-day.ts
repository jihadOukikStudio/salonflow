import {
  casablancaLocalDateTimeToIso,
  getCasablancaDateTimeFields,
} from "@/features/appointments/lib/casablanca-local-datetime";

export function parsePlanningDate(
  value: string | undefined,
  now = new Date(),
): string {
  if (value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);

      const validationDate = new Date(Date.UTC(year, month - 1, day));

      if (
        validationDate.getUTCFullYear() === year &&
        validationDate.getUTCMonth() === month - 1 &&
        validationDate.getUTCDate() === day
      ) {
        return value;
      }
    }
  }

  return getCasablancaDateTimeFields(now).dateKey;
}

export function getCasablancaDayRange(dateKey: string): {
  start: Date;
  end: Date;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  if (!match) {
    throw new Error("Date de planning invalide.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));

  const nextDateKey = [
    String(nextDay.getUTCFullYear()).padStart(4, "0"),
    String(nextDay.getUTCMonth() + 1).padStart(2, "0"),
    String(nextDay.getUTCDate()).padStart(2, "0"),
  ].join("-");

  return {
    start: new Date(casablancaLocalDateTimeToIso(dateKey, "00:00")),
    end: new Date(casablancaLocalDateTimeToIso(nextDateKey, "00:00")),
  };
}

export function shiftPlanningDate(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day + days));

  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}
