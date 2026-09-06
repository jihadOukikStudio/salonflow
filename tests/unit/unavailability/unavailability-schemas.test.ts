import { describe, expect, it } from "vitest";
import { createEmployeeUnavailabilityActionSchema } from "@/features/unavailability/schemas/unavailability-schemas";
describe("unavailability schemas", () => {
  it("rejects an inverted interval", () => {
    expect(() =>
      createEmployeeUnavailabilityActionSchema.parse({
        employeeId: crypto.randomUUID(),
        type: "ABSENCE",
        startAt: "2026-09-10T12:00:00+01:00",
        endAt: "2026-09-10T11:00:00+01:00",
      }),
    ).toThrow();
  });
});
