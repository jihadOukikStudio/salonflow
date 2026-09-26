export const CASABLANCA_TIME_ZONE = "Africa/Casablanca";

/**
 * Le Maroc a abandonné définitivement GMT+1 le 20/09/2026.
 * Les runtimes (Node/Chromium/Safari) peuvent embarquer une base IANA antérieure
 * au décret 2.26.530 et continuer à considérer Africa/Casablanca en UTC+1.
 * Après la bascule légale, on utilise donc explicitement UTC (GMT).
 */
export const MOROCCO_PERMANENT_GMT_FROM = new Date("2026-09-20T01:00:00.000Z");

export function getSalonTimeZone(date: Date): string {
  return date.getTime() >= MOROCCO_PERMANENT_GMT_FROM.getTime()
    ? "UTC"
    : CASABLANCA_TIME_ZONE;
}

export function formatSalonDateTime(
  value: Date | string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: getSalonTimeZone(date),
  }).format(date);
}

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export type CasablancaDateTimeFields = {
  dateKey: string;
  timeValue: string;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function readZonedParts(date: Date): DateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: getSalonTimeZone(date),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((item) => item.type === type);

    if (!part) {
      throw new Error("Impossible de convertir la date du rendez-vous.");
    }

    return Number(part.value);
  };

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

function sameParts(left: DateTimeParts, right: DateTimeParts): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute
  );
}

export function getCasablancaDateTimeFields(
  date: Date = new Date(),
): CasablancaDateTimeFields {
  const parts = readZonedParts(date);

  return {
    dateKey: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    timeValue: `${pad(parts.hour)}:${pad(parts.minute)}`,
  };
}

/**
 * Valeur minimale ergonomique pour le formulaire : prochain quart d'heure
 * selon l'heure métier de Marrakech. La règle de sécurité reste vérifiée
 * côté serveur avec l'instant réel.
 */
export function getMinimumBookableCasablancaDateTime(
  now: Date = new Date(),
): CasablancaDateTimeFields {
  const nextMinute = new Date(now.getTime() + 60_000);
  const fields = getCasablancaDateTimeFields(nextMinute);
  const [hours, minutes] = fields.timeValue.split(":").map(Number);
  const roundedMinutes = Math.ceil((hours * 60 + minutes) / 15) * 15;
  const dayOffset = Math.floor(roundedMinutes / (24 * 60));
  const minuteOfDay = roundedMinutes % (24 * 60);
  const roundedTime = `${String(Math.floor(minuteOfDay / 60)).padStart(2, "0")}:${String(minuteOfDay % 60).padStart(2, "0")}`;

  if (dayOffset === 0) {
    return { dateKey: fields.dateKey, timeValue: roundedTime };
  }

  const date = new Date(`${fields.dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return {
    dateKey: date.toISOString().slice(0, 10),
    timeValue: roundedTime,
  };
}

export function getSuggestedNextServiceDateTime(
  services: Array<{
    scheduledStart: string;
    durationMinutes: number;
    cancelledAt?: string | null;
  }>,
  now: Date = new Date(),
): CasablancaDateTimeFields {
  const minimum = getMinimumBookableCasablancaDateTime(now);
  const minimumInstant = new Date(
    casablancaLocalDateTimeToIso(minimum.dateKey, minimum.timeValue),
  );

  const latestActiveEnd = services
    .filter((service) => !service.cancelledAt)
    .reduce<Date | null>((latest, service) => {
      const start = new Date(service.scheduledStart);
      const end = new Date(start.getTime() + service.durationMinutes * 60_000);
      return latest === null || end > latest ? end : latest;
    }, null);

  const candidate =
    latestActiveEnd && latestActiveEnd > minimumInstant
      ? latestActiveEnd
      : minimumInstant;

  const fields = getCasablancaDateTimeFields(candidate);
  const [hours, minutes] = fields.timeValue.split(":").map(Number);
  const rounded = Math.ceil((hours * 60 + minutes) / 15) * 15;
  const dayOffset = Math.floor(rounded / (24 * 60));
  const minuteOfDay = rounded % (24 * 60);
  const timeValue = `${pad(Math.floor(minuteOfDay / 60))}:${pad(minuteOfDay % 60)}`;

  if (dayOffset === 0) return { dateKey: fields.dateKey, timeValue };

  const date = new Date(`${fields.dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return { dateKey: date.toISOString().slice(0, 10), timeValue };
}

export function casablancaLocalDateTimeToIso(
  dateKey: string,
  timeValue: string,
): string {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue);

  if (!dateMatch || !timeMatch) {
    throw new Error("La date ou l'heure du rendez-vous est invalide.");
  }

  const target: DateTimeParts = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
  };

  const validationDate = new Date(
    Date.UTC(target.year, target.month - 1, target.day),
  );

  if (
    validationDate.getUTCFullYear() !== target.year ||
    validationDate.getUTCMonth() !== target.month - 1 ||
    validationDate.getUTCDate() !== target.day ||
    target.hour < 0 ||
    target.hour > 23 ||
    target.minute < 0 ||
    target.minute > 59
  ) {
    throw new Error("La date ou l'heure du rendez-vous est invalide.");
  }

  const targetAsUtc = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    0,
    0,
  );

  // Depuis le 20/09/2026 à 02:00 heure légale, Marrakech est définitivement
  // en GMT. Pour les horaires métier du salon (>= 10:00), l'heure murale est
  // donc exactement l'heure UTC. Ne pas dépendre d'une tzdata potentiellement
  // obsolète du navigateur ou du serveur.
  const permanentGmtLocalStart = Date.UTC(2026, 8, 20, 2, 0, 0, 0);
  if (targetAsUtc >= permanentGmtLocalStart) {
    return new Date(targetAsUtc).toISOString();
  }

  let candidate = new Date(targetAsUtc);

  for (let index = 0; index < 3; index += 1) {
    const actual = readZonedParts(candidate);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      0,
      0,
    );

    candidate = new Date(candidate.getTime() + (targetAsUtc - actualAsUtc));
  }

  if (!sameParts(readZonedParts(candidate), target)) {
    throw new Error(
      "Cette heure n'existe pas dans le fuseau de Marrakech. Choisissez une autre heure.",
    );
  }

  return candidate.toISOString();
}

export function isFutureCasablancaLocalDateTime(
  dateKey: string,
  timeValue: string,
  now: Date = new Date(),
): boolean {
  const value = new Date(casablancaLocalDateTimeToIso(dateKey, timeValue));
  return value.getTime() > now.getTime();
}
