const CASABLANCA_TIME_ZONE = "Africa/Casablanca";

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
    timeZone: CASABLANCA_TIME_ZONE,
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
 * Valeur minimale ergonomique pour le formulaire : la minute suivante.
 * La règle de sécurité reste vérifiée côté serveur avec l'heure réelle.
 */
export function getMinimumBookableCasablancaDateTime(
  now: Date = new Date(),
): CasablancaDateTimeFields {
  return getCasablancaDateTimeFields(new Date(now.getTime() + 60_000));
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
