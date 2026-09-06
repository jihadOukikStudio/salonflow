import { describe, expect, it } from "vitest";

import {
  casablancaLocalDateTimeToIso,
  getCasablancaDateTimeFields,
  getMinimumBookableCasablancaDateTime,
  isFutureCasablancaLocalDateTime,
} from "@/features/appointments/lib/casablanca-local-datetime";

function casablancaParts(iso: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const values = Object.fromEntries(
    formatter
      .formatToParts(new Date(iso))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}`;
}

describe("casablancaLocalDateTimeToIso", () => {
  it("conserve la date et l'heure murale de Marrakech", () => {
    const iso = casablancaLocalDateTimeToIso("2026-09-05", "10:30");
    expect(casablancaParts(iso)).toBe("2026-09-05 10:30");
  });

  it("refuse une date invalide", () => {
    expect(() => casablancaLocalDateTimeToIso("2026-02-31", "10:30")).toThrow(
      "invalide",
    );
  });

  it("refuse une heure invalide", () => {
    expect(() => casablancaLocalDateTimeToIso("2026-09-05", "25:00")).toThrow(
      "invalide",
    );
  });
});

describe("booking date guards", () => {
  it("lit la date et l'heure à Marrakech", () => {
    const fields = getCasablancaDateTimeFields(
      new Date("2026-09-05T13:10:00.000Z"),
    );

    expect(fields.dateKey).toBe("2026-09-05");
    expect(fields.timeValue).toBe("14:10");
  });

  it("propose au minimum la minute suivante", () => {
    const fields = getMinimumBookableCasablancaDateTime(
      new Date("2026-09-05T13:10:30.000Z"),
    );

    expect(fields.timeValue).toBe("14:11");
  });

  it("refuse un créneau passé et accepte un créneau futur", () => {
    const now = new Date("2026-09-05T13:10:00.000Z");

    expect(isFutureCasablancaLocalDateTime("2026-09-05", "14:09", now)).toBe(
      false,
    );
    expect(isFutureCasablancaLocalDateTime("2026-09-05", "14:11", now)).toBe(
      true,
    );
  });
});
