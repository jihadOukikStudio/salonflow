const TIME_ZONE = "Africa/Casablanca";

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getTimeZoneParts(date: Date, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) => {
    const part = parts.find((item) => item.type === type);

    if (!part) {
      throw new Error(`Impossible de lire la partie de date "${type}".`);
    }

    return Number(part.value);
  };

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function zonedDateTimeToUtc(parts: DateParts, timeZone: string): Date {
  const targetAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  let candidate = new Date(targetAsUtc);

  // Deux passes suffisent pour stabiliser l'offset autour des transitions DST.
  for (let index = 0; index < 2; index += 1) {
    const actual = getTimeZoneParts(candidate, timeZone);

    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );

    const difference = targetAsUtc - actualAsUtc;
    candidate = new Date(candidate.getTime() + difference);
  }

  return candidate;
}

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

  const parts = getTimeZoneParts(now, TIME_ZONE);

  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
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

  return {
    start: zonedDateTimeToUtc(
      {
        year,
        month,
        day,
        hour: 0,
        minute: 0,
        second: 0,
      },
      TIME_ZONE,
    ),

    end: zonedDateTimeToUtc(
      {
        year: nextDay.getUTCFullYear(),
        month: nextDay.getUTCMonth() + 1,
        day: nextDay.getUTCDate(),
        hour: 0,
        minute: 0,
        second: 0,
      },
      TIME_ZONE,
    ),
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
