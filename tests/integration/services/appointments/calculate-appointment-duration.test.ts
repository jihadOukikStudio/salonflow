import { describe, expect, it } from "vitest";

import { calculateAppointmentDuration } from "@/server/services/appointments/calculate-appointment-duration";

describe("calculateAppointmentDuration", () => {
  it("returns 0 for an empty appointment", () => {
    expect(calculateAppointmentDuration([])).toBe(0);
  });

  it("adds durations when there is no parallel group", () => {
    const result = calculateAppointmentDuration([
      {
        id: "service-1",
        durationMinutes: 60,
        parallelGroupLinks: [],
      },
      {
        id: "service-2",
        durationMinutes: 45,
        parallelGroupLinks: [],
      },
      {
        id: "service-3",
        durationMinutes: 30,
        parallelGroupLinks: [],
      },
    ]);

    expect(result).toBe(135);
  });

  it("uses only the longest duration inside a parallel group", () => {
    const result = calculateAppointmentDuration([
      {
        id: "service-1",
        durationMinutes: 60,
        parallelGroupLinks: [],
      },
      {
        id: "service-2",
        durationMinutes: 30,
        parallelGroupLinks: [
          {
            parallelGroupId: "group-1",
          },
        ],
      },
      {
        id: "service-3",
        durationMinutes: 45,
        parallelGroupLinks: [
          {
            parallelGroupId: "group-1",
          },
        ],
      },
    ]);

    expect(result).toBe(105);
  });

  it("supports several independent parallel groups", () => {
    const result = calculateAppointmentDuration([
      {
        id: "service-1",
        durationMinutes: 30,
        parallelGroupLinks: [
          {
            parallelGroupId: "A",
          },
        ],
      },
      {
        id: "service-2",
        durationMinutes: 60,
        parallelGroupLinks: [
          {
            parallelGroupId: "A",
          },
        ],
      },
      {
        id: "service-3",
        durationMinutes: 20,
        parallelGroupLinks: [
          {
            parallelGroupId: "B",
          },
        ],
      },
      {
        id: "service-4",
        durationMinutes: 40,
        parallelGroupLinks: [
          {
            parallelGroupId: "B",
          },
        ],
      },
      {
        id: "service-5",
        durationMinutes: 15,
        parallelGroupLinks: [],
      },
    ]);

    expect(result).toBe(60 + 40 + 15);
  });

  it("rejects an invalid duration", () => {
    expect(() =>
      calculateAppointmentDuration([
        {
          id: "service-1",
          durationMinutes: 0,
          parallelGroupLinks: [],
        },
      ]),
    ).toThrow();
  });

  it("rejects a service belonging to several groups", () => {
    expect(() =>
      calculateAppointmentDuration([
        {
          id: "service-1",
          durationMinutes: 30,

          parallelGroupLinks: [
            {
              parallelGroupId: "A",
            },
            {
              parallelGroupId: "B",
            },
          ],
        },
      ]),
    ).toThrow();
  });
});
