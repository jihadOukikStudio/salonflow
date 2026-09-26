import { describe, expect, it } from "vitest";
import { cancelAppointmentServiceActionSchema } from "@/features/appointments/schemas";

describe("cancelAppointmentServiceActionSchema", () => {
  it("accepts an optional cancellation reason", () => {
    const value = cancelAppointmentServiceActionSchema.parse({
      appointmentServiceId: "11111111-1111-4111-8111-111111111111",
      reason: "Cliente ne souhaite plus cette prestation",
    });
    expect(value.reason).toBe("Cliente ne souhaite plus cette prestation");
  });

  it("rejects an overly long reason", () => {
    expect(() =>
      cancelAppointmentServiceActionSchema.parse({
        appointmentServiceId: "11111111-1111-4111-8111-111111111111",
        reason: "x".repeat(501),
      }),
    ).toThrow();
  });
});
