import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";
import { createAppointment } from "@/server/services/appointments/create-appointment";
import { assignEmployeeToService } from "@/server/services/appointments/assign-employee-to-service";
import { checkBookingFeasibilityInDb } from "@/server/services/appointments/check-booking-feasibility";
import { BusinessRuleError } from "@/server/services/errors";

import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

async function createContext() {
  const salon = await testPrisma.salon.create({
    data: { name: `Salon ${crypto.randomUUID()}` },
  });

  const admin = await testPrisma.user.create({
    data: {
      salonId: salon.id,
      email: `${crypto.randomUUID()}@test.local`,
      passwordHash: "test-hash",
      firstName: "Gérante",
      role: "ADMIN",
      canManageSalon: true,
    },
  });

  const currentUser: CurrentUser = {
    id: admin.id,
    salonId: salon.id,
    role: admin.role,
    canManageSalon: admin.canManageSalon,
    isActive: admin.isActive,
  };

  const category = await testPrisma.serviceCategory.create({
    data: { salonId: salon.id, name: "Coiffure" },
  });

  const brushing = await testPrisma.service.create({
    data: {
      salonId: salon.id,
      categoryId: category.id,
      name: "Brushing",
      defaultDurationMinutes: 60,
      defaultPrice: 100,
    },
  });

  const hamamCategory = await testPrisma.serviceCategory.create({
    data: { salonId: salon.id, name: "Hamam oriental" },
  });

  const hamam = await testPrisma.service.create({
    data: {
      salonId: salon.id,
      categoryId: hamamCategory.id,
      name: "Hamam traditionnel",
      defaultDurationMinutes: 60,
      defaultPrice: 190,
      requiredRoomType: "HAMAM",
    },
  });

  const amina = await testPrisma.employee.create({
    data: { salonId: salon.id, firstName: "Amina", isActive: true },
  });
  const sara = await testPrisma.employee.create({
    data: { salonId: salon.id, firstName: "Sara", isActive: true },
  });
  const fatima = await testPrisma.employee.create({
    data: { salonId: salon.id, firstName: "Fatima", isActive: true },
  });

  await testPrisma.room.createMany({
    data: [
      {
        salonId: salon.id,
        name: "Hamam individuel",
        type: "HAMAM",
        capacity: 1,
      },
      { salonId: salon.id, name: "Hamam duo", type: "HAMAM", capacity: 2 },
    ],
  });

  async function client(name: string) {
    return testPrisma.client.create({
      data: {
        salonId: salon.id,
        name,
        phone: `+2126${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`,
      },
    });
  }

  return {
    salon,
    admin,
    currentUser,
    brushing,
    hamam,
    amina,
    sara,
    fatima,
    client,
  };
}

describe("employee skills booking capacity", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("bloque un deuxième Brushing simultané quand une seule employée est compétente", async () => {
    const c = await createContext();
    await testPrisma.employeeSkill.create({
      data: { employeeId: c.amina.id, serviceId: c.brushing.id },
    });

    const clientA = await c.client("Cliente A");
    const clientB = await c.client("Cliente B");
    const start = new Date("2035-09-10T16:00:00.000Z");

    await createAppointment(c.currentUser, {
      clientId: clientA.id,
      scheduledStart: start,
      services: [{ serviceId: c.brushing.id }],
    });

    await expect(
      createAppointment(c.currentUser, {
        clientId: clientB.id,
        scheduledStart: start,
        services: [{ serviceId: c.brushing.id }],
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("accepte deux Brushings simultanés avec deux employées compétentes puis refuse le troisième", async () => {
    const c = await createContext();
    await testPrisma.employeeSkill.createMany({
      data: [
        { employeeId: c.amina.id, serviceId: c.brushing.id },
        { employeeId: c.sara.id, serviceId: c.brushing.id },
      ],
    });

    const start = new Date("2035-09-10T16:00:00.000Z");
    const clients = await Promise.all([
      c.client("A"),
      c.client("B"),
      c.client("C"),
    ]);

    await createAppointment(c.currentUser, {
      clientId: clients[0]!.id,
      scheduledStart: start,
      services: [{ serviceId: c.brushing.id }],
    });
    await createAppointment(c.currentUser, {
      clientId: clients[1]!.id,
      scheduledStart: start,
      services: [{ serviceId: c.brushing.id }],
    });

    await expect(
      createAppointment(c.currentUser, {
        clientId: clients[2]!.id,
        scheduledStart: start,
        services: [{ serviceId: c.brushing.id }],
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("ne compte pas une employée généraliste comme capacité Hamam dès que la compétence Hamam est configurée", async () => {
    const c = await createContext();
    await testPrisma.employeeSkill.create({
      data: { employeeId: c.fatima.id, serviceId: c.hamam.id },
    });

    const clientA = await c.client("Hamam A");
    const clientB = await c.client("Hamam B");
    const start = new Date("2035-09-10T16:00:00.000Z");

    await createAppointment(c.currentUser, {
      clientId: clientA.id,
      scheduledStart: start,
      services: [{ serviceId: c.hamam.id }],
    });

    await expect(
      createAppointment(c.currentUser, {
        clientId: clientB.id,
        scheduledStart: start,
        services: [{ serviceId: c.hamam.id }],
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("retire une employée compétente indisponible de la capacité", async () => {
    const c = await createContext();
    await testPrisma.employeeSkill.create({
      data: { employeeId: c.amina.id, serviceId: c.brushing.id },
    });

    await testPrisma.employeeUnavailability.create({
      data: {
        employeeId: c.amina.id,
        type: "ABSENCE",
        startAt: new Date("2035-09-10T15:00:00.000Z"),
        endAt: new Date("2035-09-10T18:00:00.000Z"),
        createdByUserId: c.admin.id,
      },
    });

    const result = await testPrisma.$transaction((tx) =>
      checkBookingFeasibilityInDb(tx, {
        salonId: c.salon.id,
        scheduledStart: new Date("2035-09-10T16:00:00.000Z"),
        serviceIds: [c.brushing.id],
      }),
    );

    expect(result.canCreate).toBe(false);
    expect(result.serviceEmployeeCapacity).toEqual([
      expect.objectContaining({
        serviceId: c.brushing.id,
        skillConfigured: true,
        qualifiedActive: 1,
        qualifiedAvailable: 0,
      }),
    ]);
  });

  it("interdit l'affectation d'une employée qui ne maîtrise pas la prestation", async () => {
    const c = await createContext();
    await testPrisma.employeeSkill.create({
      data: { employeeId: c.amina.id, serviceId: c.brushing.id },
    });

    const client = await c.client("Affectation");
    const appointment = await createAppointment(c.currentUser, {
      clientId: client.id,
      scheduledStart: new Date("2035-09-10T16:00:00.000Z"),
      services: [{ serviceId: c.brushing.id }],
    });

    await expect(
      assignEmployeeToService(c.currentUser, {
        appointmentServiceId: appointment.services[0]!.id,
        employeeId: c.sara.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);

    await expect(
      assignEmployeeToService(c.currentUser, {
        appointmentServiceId: appointment.services[0]!.id,
        employeeId: c.amina.id,
      }),
    ).resolves.toMatchObject({ assignedEmployeeId: c.amina.id });
  });

  it("sérialise deux créations concurrentes sur la dernière compétence disponible", async () => {
    const c = await createContext();
    await testPrisma.employeeSkill.create({
      data: { employeeId: c.amina.id, serviceId: c.brushing.id },
    });

    const clientA = await c.client("Concurrente A");
    const clientB = await c.client("Concurrente B");
    const start = new Date("2035-09-10T16:00:00.000Z");

    const results = await Promise.allSettled([
      createAppointment(c.currentUser, {
        clientId: clientA.id,
        scheduledStart: start,
        services: [{ serviceId: c.brushing.id }],
      }),
      createAppointment(c.currentUser, {
        clientId: clientB.id,
        scheduledStart: start,
        services: [{ serviceId: c.brushing.id }],
      }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
  });
});
