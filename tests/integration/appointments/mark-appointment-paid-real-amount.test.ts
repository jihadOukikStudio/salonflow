import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";
import { markAppointmentPaid } from "@/server/services/appointments/mark-appointment-paid";

import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

async function createCompletedAppointment() {
  const salon = await testPrisma.salon.create({
    data: { name: `Salon ${crypto.randomUUID()}` },
  });
  const user = await testPrisma.user.create({
    data: {
      salonId: salon.id,
      email: `${crypto.randomUUID()}@test.local`,
      passwordHash: "test-hash",
      firstName: "Admin",
      role: "ADMIN",
      canManageSalon: true,
    },
  });
  const client = await testPrisma.client.create({
    data: {
      salonId: salon.id,
      name: "Cliente",
      phone: `+2126${Date.now().toString().slice(-8)}`,
    },
  });
  const appointment = await testPrisma.appointment.create({
    data: {
      salonId: salon.id,
      clientId: client.id,
      scheduledStart: new Date(Date.now() - 60_000),
      estimatedDurationMinutes: 30,
      status: "COMPLETED",
      createdByUserId: user.id,
      services: {
        create: {
          serviceNameSnapshot: "Test",
          durationMinutes: 30,
          price: 200,
          status: "DONE",
        },
      },
    },
  });
  const currentUser: CurrentUser = {
    id: user.id,
    salonId: salon.id,
    role: "ADMIN",
    canManageSalon: true,
    isActive: true,
  };
  return { appointment, currentUser };
}

describe("markAppointmentPaid real amount", () => {
  beforeEach(async () => cleanDatabase());
  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("stores the actual cash amount even when it differs from snapshot total", async () => {
    const { appointment, currentUser } = await createCompletedAppointment();
    const payment = await markAppointmentPaid(currentUser, {
      appointmentId: appointment.id,
      amount: 175,
    });
    expect(Number(payment.amount)).toBe(175);
    expect(payment.status).toBe("PAID");
  });

  it("rejects a negative amount", async () => {
    const { appointment, currentUser } = await createCompletedAppointment();
    await expect(
      markAppointmentPaid(currentUser, {
        appointmentId: appointment.id,
        amount: -10,
      }),
    ).rejects.toThrow("invalide");
  });
});
