import { describe, expect, it } from "vitest";

import { markAppointmentPaidActionSchema } from "@/features/appointments/schemas";

describe("markAppointmentPaidActionSchema", () => {
  it("accepts a non-negative real cash amount", () => {
    const parsed = markAppointmentPaidActionSchema.parse({
      appointmentId: crypto.randomUUID(),
      amount: 325.5,
    });
    expect(parsed.amount).toBe(325.5);
  });

  it("rejects a negative amount", () => {
    expect(() =>
      markAppointmentPaidActionSchema.parse({
        appointmentId: crypto.randomUUID(),
        amount: -1,
      }),
    ).toThrow();
  });
});
