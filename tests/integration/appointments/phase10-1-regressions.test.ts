import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";
import { getAppointmentDetail } from "@/features/appointments/detail/server";
import { removeAppointmentService } from "@/server/services/appointments/remove-appointment-service";
import { startAppointmentService } from "@/server/services/appointments/start-appointment-service";

import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

async function createBase() {
  const salon = await testPrisma.salon.create({
    data: { name: `Salon ${crypto.randomUUID()}` },
  });

  const admin = await testPrisma.user.create({
    data: {
      salonId: salon.id,
      email: `${crypto.randomUUID()}@test.local`,
      passwordHash: "test-hash",
      firstName: "Admin",
      role: "ADMIN",
      canManageSalon: true,
    },
  });

  const employee = await testPrisma.employee.create({
    data: { salonId: salon.id, firstName: "Sara" },
  });

  const client = await testPrisma.client.create({
    data: {
      salonId: salon.id,
      name: "Cliente",
      phone: `+2126${Date.now().toString().slice(-8)}`,
    },
  });

  const category = await testPrisma.serviceCategory.create({
    data: { salonId: salon.id, name: `Cat ${crypto.randomUUID()}` },
  });

  const currentUser: CurrentUser = {
    id: admin.id,
    salonId: salon.id,
    role: "ADMIN",
    canManageSalon: true,
    isActive: true,
  };

  return { salon, admin, employee, client, category, currentUser };
}

describe("Phase 10.1 regressions", () => {
  beforeEach(async () => cleanDatabase());

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("marks an unavailable employee as unavailable on the appointment detail", async () => {
    const c = await createBase();
    const start = new Date(Date.now() + 60 * 60_000);

    const appointment = await testPrisma.appointment.create({
      data: {
        salonId: c.salon.id,
        clientId: c.client.id,
        scheduledStart: start,
        estimatedDurationMinutes: 60,
        createdByUserId: c.admin.id,
      },
    });

    await testPrisma.employeeUnavailability.create({
      data: {
        employeeId: c.employee.id,
        type: "ABSENCE",
        startAt: new Date(start.getTime() - 15 * 60_000),
        endAt: new Date(start.getTime() + 90 * 60_000),
        createdByUserId: c.admin.id,
      },
    });

    const detail = await getAppointmentDetail(c.currentUser, appointment.id);
    const employee = detail?.employees.find(
      (item) => item.id === c.employee.id,
    );

    expect(employee?.isAvailable).toBe(false);
    expect(employee?.unavailableReason).toContain("Indisponible");
  });

  it("refuses to start a future appointment service", async () => {
    const c = await createBase();
    const service = await testPrisma.service.create({
      data: {
        salonId: c.salon.id,
        categoryId: c.category.id,
        name: `Service ${crypto.randomUUID()}`,
        defaultDurationMinutes: 60,
        defaultPrice: 100,
      },
    });

    const appointment = await testPrisma.appointment.create({
      data: {
        salonId: c.salon.id,
        clientId: c.client.id,
        scheduledStart: new Date(Date.now() + 60 * 60_000),
        estimatedDurationMinutes: 60,
        createdByUserId: c.admin.id,
      },
    });

    const appointmentService = await testPrisma.appointmentService.create({
      data: {
        appointmentId: appointment.id,
        serviceId: service.id,
        serviceNameSnapshot: service.name,
        durationMinutes: 60,
        price: 100,
        assignedEmployeeId: c.employee.id,
      },
    });

    await expect(
      startAppointmentService(c.currentUser, {
        appointmentServiceId: appointmentService.id,
      }),
    ).rejects.toThrow("avant l'heure prévue");
  });

  it("recalculates the appointment total after removing a service", async () => {
    const c = await createBase();

    const serviceA = await testPrisma.service.create({
      data: {
        salonId: c.salon.id,
        categoryId: c.category.id,
        name: `Service A ${crypto.randomUUID()}`,
        defaultDurationMinutes: 30,
        defaultPrice: 100,
      },
    });
    const serviceB = await testPrisma.service.create({
      data: {
        salonId: c.salon.id,
        categoryId: c.category.id,
        name: `Service B ${crypto.randomUUID()}`,
        defaultDurationMinutes: 30,
        defaultPrice: 250,
      },
    });

    const appointment = await testPrisma.appointment.create({
      data: {
        salonId: c.salon.id,
        clientId: c.client.id,
        scheduledStart: new Date(Date.now() + 60 * 60_000),
        estimatedDurationMinutes: 60,
        createdByUserId: c.admin.id,
      },
    });

    await testPrisma.appointmentService.create({
      data: {
        appointmentId: appointment.id,
        serviceId: serviceA.id,
        serviceNameSnapshot: serviceA.name,
        durationMinutes: 30,
        price: 100,
      },
    });
    const removable = await testPrisma.appointmentService.create({
      data: {
        appointmentId: appointment.id,
        serviceId: serviceB.id,
        serviceNameSnapshot: serviceB.name,
        durationMinutes: 30,
        price: 250,
      },
    });

    await removeAppointmentService(c.currentUser, {
      appointmentServiceId: removable.id,
    });

    const detail = await getAppointmentDetail(c.currentUser, appointment.id);

    expect(detail?.catalogTotal).toBe(100);
    expect(detail?.services).toHaveLength(1);
    expect(detail?.estimatedDurationMinutes).toBe(30);
  });
});
