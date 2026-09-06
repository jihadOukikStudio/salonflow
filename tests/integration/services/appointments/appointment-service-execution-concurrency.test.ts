import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";

import { completeAppointmentService } from "@/server/services/appointments/complete-appointment-service";

import { cleanDatabase } from "../../helpers/database";
import { testPrisma } from "../../helpers/prisma";

async function createContext() {
  const salon = await testPrisma.salon.create({
    data: {
      name: `Salon ${crypto.randomUUID()}`,
    },
  });

  const user = await testPrisma.user.create({
    data: {
      salonId: salon.id,
      email: `${crypto.randomUUID()}@test.local`,
      passwordHash: "test-hash",
      firstName: "Amina",
      role: "EMPLOYEE",
      canManageSalon: false,
    },
  });

  const employee = await testPrisma.employee.create({
    data: {
      salonId: salon.id,
      userId: user.id,
      firstName: "Amina",
    },
  });

  const currentUser: CurrentUser = {
    id: user.id,
    salonId: salon.id,
    role: user.role,
    canManageSalon: user.canManageSalon,
    isActive: user.isActive,
  };

  const client = await testPrisma.client.create({
    data: {
      salonId: salon.id,
      name: "Cliente",
      phone: `+212${crypto.randomUUID().replaceAll("-", "").slice(0, 9)}`,
    },
  });

  /*
   * Les deux prestations ont déjà commencé.
   *
   * On utilise une date passée afin de respecter :
   * actualFinishedAt >= actualStartedAt.
   */
  const startedAt = new Date(Date.now() - 10 * 60 * 1000);

  const appointment = await testPrisma.appointment.create({
    data: {
      salonId: salon.id,
      clientId: client.id,

      scheduledStart: startedAt,
      estimatedDurationMinutes: 120,

      status: "IN_PROGRESS",

      createdByUserId: user.id,

      services: {
        create: [
          {
            serviceNameSnapshot: "Brushing",
            durationMinutes: 60,
            price: 100,

            status: "IN_PROGRESS",

            assignedEmployeeId: employee.id,
            performedByEmployeeId: employee.id,

            actualStartedAt: startedAt,
          },

          {
            serviceNameSnapshot: "Manucure",
            durationMinutes: 60,
            price: 150,

            status: "IN_PROGRESS",

            assignedEmployeeId: employee.id,
            performedByEmployeeId: employee.id,

            actualStartedAt: startedAt,
          },
        ],
      },
    },

    include: {
      services: true,
    },
  });

  const firstService = appointment.services[0];
  const secondService = appointment.services[1];

  if (!firstService || !secondService) {
    throw new Error("Les deux prestations de test n'ont pas été créées.");
  }

  return {
    salon,
    user,
    employee,
    currentUser,
    appointment,
    firstService,
    secondService,
  };
}

describe("appointment service execution concurrency", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("moves the appointment to COMPLETED when its last two services are completed concurrently", async () => {
    const context = await createContext();

    /*
     * Cas important :
     *
     * deux appareils / deux actions peuvent terminer
     * deux prestations différentes presque exactement
     * au même moment.
     */
    const results = await Promise.allSettled([
      completeAppointmentService(context.currentUser, {
        appointmentServiceId: context.firstService.id,
      }),

      completeAppointmentService(context.currentUser, {
        appointmentServiceId: context.secondService.id,
      }),
    ]);

    /*
     * Les deux prestations sont différentes :
     * les deux opérations doivent donc réussir.
     */
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(2);

    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(0);

    const services = await testPrisma.appointmentService.findMany({
      where: {
        appointmentId: context.appointment.id,
      },

      orderBy: {
        createdAt: "asc",
      },
    });

    expect(services).toHaveLength(2);

    expect(services.every((service) => service.status === "DONE")).toBe(true);

    expect(services.every((service) => service.actualFinishedAt !== null)).toBe(
      true,
    );

    /*
     * C'est précisément la régression que ce test protège.
     *
     * Sans verrou partagé du rendez-vous, les deux
     * transactions pourraient chacune voir l'autre
     * prestation encore IN_PROGRESS et laisser le RDV
     * bloqué dans cet état.
     */
    const appointment = await testPrisma.appointment.findUnique({
      where: {
        id: context.appointment.id,
      },
    });

    expect(appointment?.status).toBe("COMPLETED");

    const logs = await testPrisma.activityLog.count({
      where: {
        salonId: context.salon.id,

        action: "APPOINTMENT_SERVICE_COMPLETED",

        entityId: {
          in: [context.firstService.id, context.secondService.id],
        },
      },
    });

    expect(logs).toBe(2);
  });
});
