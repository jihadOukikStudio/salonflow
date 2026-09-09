import { getCasablancaDateTimeFields } from "@/features/appointments/lib/casablanca-local-datetime";
import { BusinessRuleError } from "@/server/services/errors";

export const SALON_OPENING_MINUTE = 10 * 60;
export const SALON_STANDARD_CLOSING_MINUTE = 21 * 60;
export const SALON_MAX_END_MINUTE = 21 * 60 + 30;

function minuteOfDay(timeValue: string): number {
  const [hours, minutes] = timeValue.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatMinuteOfDay(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export type BookingWindowValidation = {
  scheduledEnd: Date;
  latestStartMinute: number;
  latestStartTimeValue: string;
};

export function validateBookingWindow(
  scheduledStart: Date,
  durationMinutes: number,
  now: Date = new Date(),
): BookingWindowValidation {
  if (
    !(scheduledStart instanceof Date) ||
    Number.isNaN(scheduledStart.getTime()) ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes <= 0
  ) {
    throw new BusinessRuleError(
      "La date ou la durée du rendez-vous est invalide.",
    );
  }

  if (scheduledStart.getTime() <= now.getTime()) {
    throw new BusinessRuleError(
      "Impossible de créer ou déplacer un rendez-vous dans le passé.",
    );
  }

  const startLocal = getCasablancaDateTimeFields(scheduledStart);
  const startMinute = minuteOfDay(startLocal.timeValue);

  if (startMinute < SALON_OPENING_MINUTE) {
    throw new BusinessRuleError("Le salon ouvre à 10h00.");
  }

  if (startMinute > SALON_STANDARD_CLOSING_MINUTE) {
    throw new BusinessRuleError(
      "Un rendez-vous doit commencer entre 10h00 et 21h00.",
    );
  }

  if (startMinute % 15 !== 0) {
    throw new BusinessRuleError(
      "Choisissez un horaire par tranche de 15 minutes (ex. 10h00, 10h15, 10h30).",
    );
  }

  const latestStartMinute =
    Math.floor((SALON_MAX_END_MINUTE - durationMinutes) / 15) * 15;
  if (latestStartMinute < SALON_OPENING_MINUTE) {
    throw new BusinessRuleError(
      "La durée de ce rendez-vous dépasse l'amplitude maximale du salon (10h00–21h30).",
    );
  }

  const scheduledEnd = new Date(
    scheduledStart.getTime() + durationMinutes * 60_000,
  );
  const endLocal = getCasablancaDateTimeFields(scheduledEnd);
  const endMinute = minuteOfDay(endLocal.timeValue);

  if (
    endLocal.dateKey !== startLocal.dateKey ||
    endMinute > SALON_MAX_END_MINUTE
  ) {
    throw new BusinessRuleError(
      `Ce rendez-vous se terminerait après 21h30. Dernier début possible : ${formatMinuteOfDay(latestStartMinute)}.`,
    );
  }

  return {
    scheduledEnd,
    latestStartMinute,
    latestStartTimeValue: formatMinuteOfDay(latestStartMinute),
  };
}
