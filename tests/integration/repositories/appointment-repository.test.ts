import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { appointmentRepository } from "@/server/repositories/appointment-repository";

import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

async function createSalonContext(name: string) {
  const salon = await testPrisma.salon.create({
    data: {
      name,
    },
  });

  const user = await testPrisma.user.create({
    data: {
      salonId: salon.id,
      email: `${name.toLowerCase().replaceAll(" ", "-")}@test.local`,
      passwordHash: "test-hash",
      firstName: "Admin",
      role: "ADMIN",
      canManageSalon: true,
    },
  });

  const client = await testPrisma.client.create({
    data: {
      salonId: salon.id,
      phone: `+2126${Math.floor(Math.random() * 1_000_000_000)
        .toString()
        .padStart(9, "0")}`,
      name: `Client ${name}`,
    },
  });

  return {
    salon,
    user,
    client,
  };
}

async function createAppointment(params: {
  salonId: string;
  clientId: string;
  userId: string;
  scheduledStart?: Date;
}) {
  return testPrisma.appointment.create({
    data: {
      salonId: params.salonId,
      clientId: params.clientId,
      createdByUserId: params.userId,
      scheduledStart:
        params.scheduledStart ?? new Date("2026-09-10T10:00:00.000Z"),
      estimatedDurationMinutes: 60,
    },
  });
}

describe("appointmentRepository salon isolation", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("returns an appointment belonging to the requested salon", async () => {
    const context = await createSalonContext("Salon A");

    const appointment = await createAppointment({
      salonId: context.salon.id,
      clientId: context.client.id,
      userId: context.user.id,
    });

    const result = await appointmentRepository.findById({
      salonId: context.salon.id,
      appointmentId: appointment.id,
    });

    expect(result?.id).toBe(appointment.id);
    expect(result?.salonId).toBe(context.salon.id);
  });

  it("does not return an appointment belonging to another salon", async () => {
    const salonA = await createSalonContext("Salon A");
    const salonB = await createSalonContext("Salon B");

    const appointmentB = await createAppointment({
      salonId: salonB.salon.id,
      clientId: salonB.client.id,
      userId: salonB.user.id,
    });

    const result = await appointmentRepository.findById({
      salonId: salonA.salon.id,
      appointmentId: appointmentB.id,
    });

    expect(result).toBeNull();
  });

  it("only lists appointments belonging to the requested salon", async () => {
    const salonA = await createSalonContext("Salon A");
    const salonB = await createSalonContext("Salon B");

    await createAppointment({
      salonId: salonA.salon.id,
      clientId: salonA.client.id,
      userId: salonA.user.id,
      scheduledStart: new Date("2026-09-10T10:00:00.000Z"),
    });

    await createAppointment({
      salonId: salonB.salon.id,
      clientId: salonB.client.id,
      userId: salonB.user.id,
      scheduledStart: new Date("2026-09-10T11:00:00.000Z"),
    });

    const appointments = await appointmentRepository.list({
      salonId: salonA.salon.id,
      from: new Date("2026-09-10T00:00:00.000Z"),
      to: new Date("2026-09-11T00:00:00.000Z"),
    });

    expect(appointments).toHaveLength(1);
    expect(appointments[0]?.salonId).toBe(salonA.salon.id);
  });

  it("does not update an appointment belonging to another salon", async () => {
    const salonA = await createSalonContext("Salon A");
    const salonB = await createSalonContext("Salon B");

    const appointmentB = await createAppointment({
      salonId: salonB.salon.id,
      clientId: salonB.client.id,
      userId: salonB.user.id,
    });

    const result = await appointmentRepository.update({
      salonId: salonA.salon.id,
      appointmentId: appointmentB.id,
      internalNote: "HACKED",
    });

    expect(result.count).toBe(0);

    const unchanged = await testPrisma.appointment.findUnique({
      where: {
        id: appointmentB.id,
      },
    });

    expect(unchanged?.internalNote).toBeNull();
  });

  it("updates an appointment belonging to its own salon", async () => {
    const context = await createSalonContext("Salon A");

    const appointment = await createAppointment({
      salonId: context.salon.id,
      clientId: context.client.id,
      userId: context.user.id,
    });

    const result = await appointmentRepository.update({
      salonId: context.salon.id,
      appointmentId: appointment.id,
      internalNote: "Cliente en retard",
    });

    expect(result.count).toBe(1);

    const updated = await testPrisma.appointment.findUnique({
      where: {
        id: appointment.id,
      },
    });

    expect(updated?.internalNote).toBe("Cliente en retard");
  });

  it("does not cancel an appointment belonging to another salon", async () => {
    const salonA = await createSalonContext("Salon A");
    const salonB = await createSalonContext("Salon B");

    const appointmentB = await createAppointment({
      salonId: salonB.salon.id,
      clientId: salonB.client.id,
      userId: salonB.user.id,
    });

    const result = await appointmentRepository.cancel({
      salonId: salonA.salon.id,
      appointmentId: appointmentB.id,
      cancelledByUserId: salonA.user.id,
      cancelledAt: new Date(),
    });

    expect(result.count).toBe(0);

    const unchanged = await testPrisma.appointment.findUnique({
      where: {
        id: appointmentB.id,
      },
    });

    expect(unchanged?.status).toBe("PLANNED");
    expect(unchanged?.cancelledAt).toBeNull();
  });

  it("cancels an appointment belonging to its own salon", async () => {
    const context = await createSalonContext("Salon A");

    const appointment = await createAppointment({
      salonId: context.salon.id,
      clientId: context.client.id,
      userId: context.user.id,
    });

    const cancelledAt = new Date("2026-09-10T09:00:00.000Z");

    const result = await appointmentRepository.cancel({
      salonId: context.salon.id,
      appointmentId: appointment.id,
      cancelledByUserId: context.user.id,
      cancelledAt,
    });

    expect(result.count).toBe(1);

    const cancelled = await testPrisma.appointment.findUnique({
      where: {
        id: appointment.id,
      },
    });

    expect(cancelled?.status).toBe("CANCELLED");
    expect(cancelled?.cancelledByUserId).toBe(context.user.id);
    expect(cancelled?.cancelledAt).toEqual(cancelledAt);
  });

  it("does not expose an appointment service from another salon", async () => {
    const salonA = await createSalonContext("Salon A");
    const salonB = await createSalonContext("Salon B");

    const appointmentB = await createAppointment({
      salonId: salonB.salon.id,
      clientId: salonB.client.id,
      userId: salonB.user.id,
    });

    const appointmentServiceB = await testPrisma.appointmentService.create({
      data: {
        appointmentId: appointmentB.id,
        serviceNameSnapshot: "Massage",
        durationMinutes: 60,
        price: 350,
      },
    });

    const result = await appointmentRepository.findServiceById({
      salonId: salonA.salon.id,
      appointmentServiceId: appointmentServiceB.id,
    });

    expect(result).toBeNull();
  });

  it("returns an appointment service belonging to its own salon", async () => {
    const context = await createSalonContext("Salon A");

    const appointment = await createAppointment({
      salonId: context.salon.id,
      clientId: context.client.id,
      userId: context.user.id,
    });

    const appointmentService = await testPrisma.appointmentService.create({
      data: {
        appointmentId: appointment.id,
        serviceNameSnapshot: "Massage",
        durationMinutes: 60,
        price: 350,
      },
    });

    const result = await appointmentRepository.findServiceById({
      salonId: context.salon.id,
      appointmentServiceId: appointmentService.id,
    });

    expect(result?.id).toBe(appointmentService.id);
    expect(result?.appointment.salonId).toBe(context.salon.id);
  });
  it("filters appointments by status when statuses are provided", async () => {
    const context = await createSalonContext("Salon A");

    const planned = await createAppointment({
      salonId: context.salon.id,
      clientId: context.client.id,
      userId: context.user.id,
      scheduledStart: new Date("2026-09-10T10:00:00.000Z"),
    });

    const cancelled = await createAppointment({
      salonId: context.salon.id,
      clientId: context.client.id,
      userId: context.user.id,
      scheduledStart: new Date("2026-09-10T11:00:00.000Z"),
    });

    await testPrisma.appointment.update({
      where: { id: cancelled.id },
      data: { status: "CANCELLED" },
    });

    const appointments = await appointmentRepository.list({
      salonId: context.salon.id,
      from: new Date("2026-09-10T00:00:00.000Z"),
      to: new Date("2026-09-11T00:00:00.000Z"),
      statuses: ["PLANNED"],
    });

    expect(appointments).toHaveLength(1);
    expect(appointments[0]?.id).toBe(planned.id);
    expect(appointments[0]?.status).toBe("PLANNED");
  });

  it("updates all supported appointment fields when provided", async () => {
    const context = await createSalonContext("Salon A");

    const appointment = await createAppointment({
      salonId: context.salon.id,
      clientId: context.client.id,
      userId: context.user.id,
    });

    const newStart = new Date("2026-09-11T14:00:00.000Z");

    const result = await appointmentRepository.update({
      salonId: context.salon.id,
      appointmentId: appointment.id,
      scheduledStart: newStart,
      estimatedDurationMinutes: 90,
      internalNote: "Nouvelle note",
      status: "IN_PROGRESS",
    });

    expect(result.count).toBe(1);

    const updated = await testPrisma.appointment.findUnique({
      where: { id: appointment.id },
    });

    expect(updated?.scheduledStart).toEqual(newStart);
    expect(updated?.estimatedDurationMinutes).toBe(90);
    expect(updated?.internalNote).toBe("Nouvelle note");
    expect(updated?.status).toBe("IN_PROGRESS");
  });
});
