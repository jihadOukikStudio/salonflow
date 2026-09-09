import { describe, expect, it } from "vitest";

import { casablancaLocalDateTimeToIso } from "@/features/appointments/lib/casablanca-local-datetime";
import { validateBookingWindow } from "@/server/services/appointments/booking-window";
import { BusinessRuleError } from "@/server/services/errors";

function local(dateKey: string, timeValue: string) {
  return new Date(casablancaLocalDateTimeToIso(dateKey, timeValue));
}

describe("validateBookingWindow", () => {
  const now = local("2026-09-09", "12:00");

  it("refuse un rendez-vous dans le passé", () => {
    expect(() =>
      validateBookingWindow(local("2026-09-09", "11:45"), 30, now),
    ).toThrow(BusinessRuleError);
  });

  it("refuse un début avant 10h", () => {
    expect(() =>
      validateBookingWindow(local("2026-09-10", "09:45"), 30, now),
    ).toThrow("Le salon ouvre à 10h00.");
  });

  it("refuse un début après 21h", () => {
    expect(() =>
      validateBookingWindow(local("2026-09-10", "21:15"), 15, now),
    ).toThrow("Un rendez-vous doit commencer entre 10h00 et 21h00.");
  });

  it("refuse un horaire qui n'est pas aligné sur 15 minutes", () => {
    expect(() =>
      validateBookingWindow(local("2026-09-10", "10:22"), 30, now),
    ).toThrow(/tranche de 15 minutes/);
  });

  it("accepte une fin exacte à 21h30", () => {
    const result = validateBookingWindow(local("2026-09-10", "20:00"), 90, now);
    expect(result.latestStartTimeValue).toBe("20:00");
  });

  it("refuse un dépassement et indique le dernier début possible", () => {
    expect(() =>
      validateBookingWindow(local("2026-09-10", "20:15"), 90, now),
    ).toThrow(/Dernier début possible : 20:00/);
  });
});
