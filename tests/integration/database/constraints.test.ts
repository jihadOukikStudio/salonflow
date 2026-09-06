import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

describe("database constraints", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("rejects a service duration <= 0 when duration is defined", async () => {
    const salon = await testPrisma.salon.create({
      data: {
        name: "Salon Test",
      },
    });

    const category = await testPrisma.serviceCategory.create({
      data: {
        salonId: salon.id,
        name: "Test",
      },
    });

    await expect(
      testPrisma.service.create({
        data: {
          salonId: salon.id,
          categoryId: category.id,
          name: "Invalid duration",
          defaultDurationMinutes: 0,
          defaultPrice: 100,
        },
      }),
    ).rejects.toThrow();
  });

  it("allows a service duration to be null", async () => {
    const salon = await testPrisma.salon.create({
      data: {
        name: "Salon Test",
      },
    });

    const category = await testPrisma.serviceCategory.create({
      data: {
        salonId: salon.id,
        name: "Test",
      },
    });

    await expect(
      testPrisma.service.create({
        data: {
          salonId: salon.id,
          categoryId: category.id,
          name: "Unknown duration",
          defaultDurationMinutes: null,
          defaultPrice: 100,
        },
      }),
    ).resolves.toBeDefined();
  });

  it("rejects a negative service price", async () => {
    const salon = await testPrisma.salon.create({
      data: {
        name: "Salon Test",
      },
    });

    const category = await testPrisma.serviceCategory.create({
      data: {
        salonId: salon.id,
        name: "Test",
      },
    });

    await expect(
      testPrisma.service.create({
        data: {
          salonId: salon.id,
          categoryId: category.id,
          name: "Invalid price",
          defaultPrice: -1,
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects an appointment duration <= 0", async () => {
    const salon = await testPrisma.salon.create({
      data: {
        name: "Salon Test",
      },
    });

    const user = await testPrisma.user.create({
      data: {
        salonId: salon.id,
        email: "admin@test.local",
        passwordHash: "hash",
        firstName: "Admin",
        role: "ADMIN",
      },
    });

    const client = await testPrisma.client.create({
      data: {
        salonId: salon.id,
        phone: "+212600000001",
      },
    });

    await expect(
      testPrisma.appointment.create({
        data: {
          salonId: salon.id,
          clientId: client.id,
          scheduledStart: new Date(),
          estimatedDurationMinutes: 0,
          createdByUserId: user.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects an appointment service duration <= 0", async () => {
    const salon = await testPrisma.salon.create({
      data: {
        name: "Salon Test",
      },
    });

    const user = await testPrisma.user.create({
      data: {
        salonId: salon.id,
        email: "admin@test.local",
        passwordHash: "hash",
        firstName: "Admin",
        role: "ADMIN",
      },
    });

    const client = await testPrisma.client.create({
      data: {
        salonId: salon.id,
        phone: "+212600000001",
      },
    });

    const appointment = await testPrisma.appointment.create({
      data: {
        salonId: salon.id,
        clientId: client.id,
        scheduledStart: new Date(),
        estimatedDurationMinutes: 60,
        createdByUserId: user.id,
      },
    });

    await expect(
      testPrisma.appointmentService.create({
        data: {
          appointmentId: appointment.id,
          serviceNameSnapshot: "Test",
          durationMinutes: 0,
          price: 100,
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects a negative appointment service price", async () => {
    const salon = await testPrisma.salon.create({
      data: {
        name: "Salon Test",
      },
    });

    const user = await testPrisma.user.create({
      data: {
        salonId: salon.id,
        email: "admin@test.local",
        passwordHash: "hash",
        firstName: "Admin",
        role: "ADMIN",
      },
    });

    const client = await testPrisma.client.create({
      data: {
        salonId: salon.id,
        phone: "+212600000001",
      },
    });

    const appointment = await testPrisma.appointment.create({
      data: {
        salonId: salon.id,
        clientId: client.id,
        scheduledStart: new Date(),
        estimatedDurationMinutes: 60,
        createdByUserId: user.id,
      },
    });

    await expect(
      testPrisma.appointmentService.create({
        data: {
          appointmentId: appointment.id,
          serviceNameSnapshot: "Test",
          durationMinutes: 60,
          price: -1,
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects actualFinishedAt before actualStartedAt", async () => {
    const salon = await testPrisma.salon.create({
      data: {
        name: "Salon Test",
      },
    });

    const user = await testPrisma.user.create({
      data: {
        salonId: salon.id,
        email: "admin@test.local",
        passwordHash: "hash",
        firstName: "Admin",
        role: "ADMIN",
      },
    });

    const client = await testPrisma.client.create({
      data: {
        salonId: salon.id,
        phone: "+212600000001",
      },
    });

    const appointment = await testPrisma.appointment.create({
      data: {
        salonId: salon.id,
        clientId: client.id,
        scheduledStart: new Date(),
        estimatedDurationMinutes: 60,
        createdByUserId: user.id,
      },
    });

    const startedAt = new Date("2026-09-04T10:00:00.000Z");
    const finishedAt = new Date("2026-09-04T09:00:00.000Z");

    await expect(
      testPrisma.appointmentService.create({
        data: {
          appointmentId: appointment.id,
          serviceNameSnapshot: "Test",
          durationMinutes: 60,
          price: 100,
          actualStartedAt: startedAt,
          actualFinishedAt: finishedAt,
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects a room capacity <= 0", async () => {
    const salon = await testPrisma.salon.create({
      data: {
        name: "Salon Test",
      },
    });

    await expect(
      testPrisma.room.create({
        data: {
          salonId: salon.id,
          name: "Invalid room",
          type: "HAMAM",
          capacity: 0,
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects a room unavailability with endAt <= startAt", async () => {
    const salon = await testPrisma.salon.create({
      data: {
        name: "Salon Test",
      },
    });

    const user = await testPrisma.user.create({
      data: {
        salonId: salon.id,
        email: "admin@test.local",
        passwordHash: "hash",
        firstName: "Admin",
        role: "ADMIN",
      },
    });

    const room = await testPrisma.room.create({
      data: {
        salonId: salon.id,
        name: "Hamam Test",
        type: "HAMAM",
      },
    });

    const startAt = new Date("2026-09-04T10:00:00.000Z");
    const endAt = new Date("2026-09-04T09:00:00.000Z");

    await expect(
      testPrisma.roomUnavailability.create({
        data: {
          roomId: room.id,
          startAt,
          endAt,
          createdByUserId: user.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects an employee unavailability with endAt <= startAt", async () => {
    const salon = await testPrisma.salon.create({
      data: {
        name: "Salon Test",
      },
    });

    const user = await testPrisma.user.create({
      data: {
        salonId: salon.id,
        email: "admin@test.local",
        passwordHash: "hash",
        firstName: "Admin",
        role: "ADMIN",
      },
    });

    const employee = await testPrisma.employee.create({
      data: {
        salonId: salon.id,
        firstName: "Employée",
      },
    });

    const startAt = new Date("2026-09-04T10:00:00.000Z");
    const endAt = new Date("2026-09-04T09:00:00.000Z");

    await expect(
      testPrisma.employeeUnavailability.create({
        data: {
          employeeId: employee.id,
          type: "ABSENCE",
          startAt,
          endAt,
          createdByUserId: user.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects a negative payment amount", async () => {
    const salon = await testPrisma.salon.create({
      data: {
        name: "Salon Test",
      },
    });

    const user = await testPrisma.user.create({
      data: {
        salonId: salon.id,
        email: "admin@test.local",
        passwordHash: "hash",
        firstName: "Admin",
        role: "ADMIN",
      },
    });

    const client = await testPrisma.client.create({
      data: {
        salonId: salon.id,
        phone: "+212600000001",
      },
    });

    const appointment = await testPrisma.appointment.create({
      data: {
        salonId: salon.id,
        clientId: client.id,
        scheduledStart: new Date(),
        estimatedDurationMinutes: 60,
        createdByUserId: user.id,
      },
    });

    await expect(
      testPrisma.payment.create({
        data: {
          appointmentId: appointment.id,
          amount: -1,
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects a PAID payment without paidAt", async () => {
    const salon = await testPrisma.salon.create({
      data: {
        name: "Salon Test",
      },
    });

    const user = await testPrisma.user.create({
      data: {
        salonId: salon.id,
        email: "admin@test.local",
        passwordHash: "hash",
        firstName: "Admin",
        role: "ADMIN",
      },
    });

    const client = await testPrisma.client.create({
      data: {
        salonId: salon.id,
        phone: "+212600000001",
      },
    });

    const appointment = await testPrisma.appointment.create({
      data: {
        salonId: salon.id,
        clientId: client.id,
        scheduledStart: new Date(),
        estimatedDurationMinutes: 60,
        createdByUserId: user.id,
      },
    });

    await expect(
      testPrisma.payment.create({
        data: {
          appointmentId: appointment.id,
          amount: 100,
          status: "PAID",
          paidAt: null,
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects a PENDING payment with paidAt", async () => {
    const salon = await testPrisma.salon.create({
      data: {
        name: "Salon Test",
      },
    });

    const user = await testPrisma.user.create({
      data: {
        salonId: salon.id,
        email: "admin@test.local",
        passwordHash: "hash",
        firstName: "Admin",
        role: "ADMIN",
      },
    });

    const client = await testPrisma.client.create({
      data: {
        salonId: salon.id,
        phone: "+212600000001",
      },
    });

    const appointment = await testPrisma.appointment.create({
      data: {
        salonId: salon.id,
        clientId: client.id,
        scheduledStart: new Date(),
        estimatedDurationMinutes: 60,
        createdByUserId: user.id,
      },
    });

    await expect(
      testPrisma.payment.create({
        data: {
          appointmentId: appointment.id,
          amount: 100,
          status: "PENDING",
          paidAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });
});
