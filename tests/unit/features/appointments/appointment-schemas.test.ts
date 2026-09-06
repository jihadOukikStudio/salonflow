import { describe, expect, it } from "vitest";

import {
  addAppointmentServiceActionSchema,
  createAppointmentActionSchema,
  createParallelGroupActionSchema,
  updateAppointmentDetailsActionSchema,
  updateAppointmentScheduleActionSchema,
} from "@/features/appointments/schemas";

const appointmentId = "11111111-1111-4111-8111-111111111111";

const clientId = "22222222-2222-4222-8222-222222222222";

const serviceId = "33333333-3333-4333-8333-333333333333";

describe("appointment action schemas", () => {
  it("parses a valid appointment and converts ISO datetime to Date", () => {
    const result = createAppointmentActionSchema.parse({
      clientId,
      scheduledStart: "2026-09-10T10:00:00+02:00",
      internalNote: "  Cliente préfère le calme  ",
      services: [
        {
          serviceId,
          durationMinutes: 60,
          price: 250,
        },
      ],
    });

    expect(result.scheduledStart).toBeInstanceOf(Date);
    expect(result.internalNote).toBe("Cliente préfère le calme");
  });

  it("rejects duplicate services at the action boundary", () => {
    const result = createAppointmentActionSchema.safeParse({
      clientId,
      scheduledStart: "2026-09-10T10:00:00+02:00",
      services: [
        {
          serviceId,
        },
        {
          serviceId,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid UUIDs", () => {
    const result = addAppointmentServiceActionSchema.safeParse({
      appointmentId: "not-a-uuid",
      serviceId,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a negative price", () => {
    const result = addAppointmentServiceActionSchema.safeParse({
      appointmentId,
      serviceId,
      price: -1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a zero duration", () => {
    const result = addAppointmentServiceActionSchema.safeParse({
      appointmentId,
      serviceId,
      durationMinutes: 0,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid schedule datetime", () => {
    const result = updateAppointmentScheduleActionSchema.safeParse({
      appointmentId,
      scheduledStart: "10/09/2026 10:00",
    });

    expect(result.success).toBe(false);
  });

  it("requires at least one detail modification", () => {
    const result = updateAppointmentDetailsActionSchema.safeParse({
      appointmentId,
    });

    expect(result.success).toBe(false);
  });

  it("allows explicitly clearing the internal note", () => {
    const result = updateAppointmentDetailsActionSchema.safeParse({
      appointmentId,
      internalNote: null,
    });

    expect(result.success).toBe(true);
  });

  it("requires at least two unique services in a parallel group", () => {
    const result = createParallelGroupActionSchema.safeParse({
      appointmentId,
      appointmentServiceIds: [serviceId, serviceId],
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown payload keys", () => {
    const result = updateAppointmentScheduleActionSchema.safeParse({
      appointmentId,
      scheduledStart: "2026-09-10T10:00:00+02:00",
      salonId: "44444444-4444-4444-8444-444444444444",
    });

    expect(result.success).toBe(false);
  });
});
