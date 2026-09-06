import { describe, expect, it } from "vitest";

import {
  getCasablancaDayRange,
  parsePlanningDate,
  shiftPlanningDate,
} from "@/features/planning/server/casablanca-day";

describe("Casablanca planning date helpers", () => {
  it("keeps a valid YYYY-MM-DD date", () => {
    expect(parsePlanningDate("2026-09-05")).toBe("2026-09-05");
  });

  it("rejects impossible dates and falls back to current Casablanca date", () => {
    const now = new Date("2026-09-05T00:30:00.000Z");

    expect(parsePlanningDate("2026-02-31", now)).toBe("2026-09-05");
  });

  it("creates an exclusive next-day boundary", () => {
    const range = getCasablancaDayRange("2026-09-05");

    expect(range.end.getTime()).toBeGreaterThan(range.start.getTime());

    const durationHours =
      (range.end.getTime() - range.start.getTime()) / 3_600_000;

    expect([23, 24, 25]).toContain(durationHours);
  });

  it("shifts dates safely across month boundaries", () => {
    expect(shiftPlanningDate("2026-09-01", -1)).toBe("2026-08-31");

    expect(shiftPlanningDate("2026-12-31", 1)).toBe("2027-01-01");
  });
});
