import { describe, expect, it } from "vitest";

import {
  getAppointmentEnd,
  getAppointmentInterval,
  intervalsOverlap,
} from "@/server/services/resources/appointment-interval";

describe("appointment interval helpers", () => {
  it("calculates appointment end", () => {
    const start = new Date("2026-09-10T10:00:00.000Z");

    expect(getAppointmentEnd(start, 90)).toEqual(
      new Date("2026-09-10T11:30:00.000Z"),
    );
  });

  it("creates a complete interval", () => {
    const start = new Date("2026-09-10T10:00:00.000Z");

    expect(getAppointmentInterval(start, 60)).toEqual({
      startAt: start,
      endAt: new Date("2026-09-10T11:00:00.000Z"),
    });
  });

  it("detects an overlap", () => {
    expect(
      intervalsOverlap(
        {
          startAt: new Date("2026-09-10T10:00:00.000Z"),
          endAt: new Date("2026-09-10T11:00:00.000Z"),
        },
        {
          startAt: new Date("2026-09-10T10:30:00.000Z"),
          endAt: new Date("2026-09-10T11:30:00.000Z"),
        },
      ),
    ).toBe(true);
  });

  it("accepts adjacent intervals", () => {
    expect(
      intervalsOverlap(
        {
          startAt: new Date("2026-09-10T10:00:00.000Z"),
          endAt: new Date("2026-09-10T11:00:00.000Z"),
        },
        {
          startAt: new Date("2026-09-10T11:00:00.000Z"),
          endAt: new Date("2026-09-10T12:00:00.000Z"),
        },
      ),
    ).toBe(false);
  });

  it("rejects an invalid duration", () => {
    expect(() =>
      getAppointmentEnd(new Date("2026-09-10T10:00:00.000Z"), 0),
    ).toThrow();
  });

  it("rejects an invalid date", () => {
    expect(() => getAppointmentEnd(new Date("invalid"), 60)).toThrow();
  });
});
