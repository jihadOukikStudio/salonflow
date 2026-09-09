import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { casablancaLocalDateTimeToIso } from "@/features/appointments/lib/casablanca-local-datetime";
import { checkBookingFeasibilityInDb } from "@/server/services/appointments/check-booking-feasibility";
import { findNextAvailableSlotsInDb } from "@/server/services/appointments/find-next-available-slots";

import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

async function createContext(params?: {
  serviceName?: string;
  durationMinutes?: number;
  requiredRoomType?: "HAMAM" | "TREATMENT_ROOM" | null;
  withRoom?: boolean;
}) {
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

  const employee = await testPrisma.employee.create({
    data: {
      salonId: salon.id,
      firstName: "Amina",
      isActive: true,
    },
  });

  const category = await testPrisma.serviceCategory.create({
    data: {
      salonId: salon.id,
      name: `Catégorie ${crypto.randomUUID()}`,
    },
  });

  const service = await testPrisma.service.create({
    data: {
      salonId: salon.id,
      categoryId: category.id,
      name: params?.serviceName ?? "Brushing",
      defaultDurationMinutes: params?.durationMinutes ?? 30,
      defaultPrice: 100,
      requiredRoomType: params?.requiredRoomType ?? null,
    },
  });

  await testPrisma.employeeSkill.create({
    data: {
      employeeId: employee.id,
      serviceId: service.id,
    },
  });

  const client = await testPrisma.client.create({
    data: {
      salonId: salon.id,
      name: "Cliente",
      phone: `+2126${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`,
    },
  });

  const room =
    params?.withRoom && params.requiredRoomType
      ? await testPrisma.room.create({
          data: {
            salonId: salon.id,
            name: `${params.requiredRoomType} ${crypto.randomUUID()}`,
            type: params.requiredRoomType,
            capacity: 1,
          },
        })
      : null;

  return { salon, user, employee, category, service, client, room };
}

function local(dateKey: string, timeValue: string) {
  return new Date(casablancaLocalDateTimeToIso(dateKey, timeValue));
}

async function createExistingAppointment(input: {
  salonId: string;
  userId: string;
  clientId: string;
  serviceId: string;
  serviceName: string;
  employeeId: string;
  scheduledStart: Date;
  durationMinutes: number;
  requiredRoomType?: "HAMAM" | "TREATMENT_ROOM" | null;
  roomId?: string | null;
}) {
  return testPrisma.appointment.create({
    data: {
      salonId: input.salonId,
      clientId: input.clientId,
      scheduledStart: input.scheduledStart,
      estimatedDurationMinutes: input.durationMinutes,
      createdByUserId: input.userId,
      services: {
        create: {
          serviceId: input.serviceId,
          serviceNameSnapshot: input.serviceName,
          durationMinutes: input.durationMinutes,
          price: 100,
          assignedEmployeeId: input.employeeId,
          requiredRoomTypeSnapshot: input.requiredRoomType ?? null,
          roomId: input.roomId ?? null,
        },
      },
    },
  });
}

describe("Phase 12.7.4 — prochains créneaux sans conflit", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("propose 10:30 et jamais 10:15 si l'unique employée Brushing est occupée jusqu'à 10:30", async () => {
    const c = await createContext({
      serviceName: "Brushing",
      durationMinutes: 30,
    });

    await createExistingAppointment({
      salonId: c.salon.id,
      userId: c.user.id,
      clientId: c.client.id,
      serviceId: c.service.id,
      serviceName: c.service.name,
      employeeId: c.employee.id,
      scheduledStart: local("2035-09-10", "10:00"),
      durationMinutes: 30,
    });

    const blocked = await testPrisma.$transaction((tx) =>
      checkBookingFeasibilityInDb(tx, {
        salonId: c.salon.id,
        scheduledStart: local("2035-09-10", "10:00"),
        serviceIds: [c.service.id],
      }),
    );
    expect(blocked.canCreate).toBe(false);

    const slots = await testPrisma.$transaction((tx) =>
      findNextAvailableSlotsInDb(tx, {
        salonId: c.salon.id,
        scheduledStart: local("2035-09-10", "10:00"),
        serviceIds: [c.service.id],
      }),
    );

    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]?.dateKey).toBe("2035-09-10");
    expect(slots[0]?.timeValue).toBe("10:30");
    expect(slots.some((slot) => slot.timeValue === "10:15")).toBe(false);
  });

  it("respecte à la fois l'employée compétente et la salle Hamam", async () => {
    const c = await createContext({
      serviceName: "Hamam",
      durationMinutes: 60,
      requiredRoomType: "HAMAM",
      withRoom: true,
    });

    if (!c.room) throw new Error("Salle Hamam manquante");

    await createExistingAppointment({
      salonId: c.salon.id,
      userId: c.user.id,
      clientId: c.client.id,
      serviceId: c.service.id,
      serviceName: c.service.name,
      employeeId: c.employee.id,
      scheduledStart: local("2035-09-10", "10:00"),
      durationMinutes: 60,
      requiredRoomType: "HAMAM",
      roomId: c.room.id,
    });

    const slots = await testPrisma.$transaction((tx) =>
      findNextAvailableSlotsInDb(tx, {
        salonId: c.salon.id,
        scheduledStart: local("2035-09-10", "10:00"),
        serviceIds: [c.service.id],
      }),
    );

    expect(slots[0]?.timeValue).toBe("11:00");

    for (const slot of slots) {
      const feasibility = await testPrisma.$transaction((tx) =>
        checkBookingFeasibilityInDb(tx, {
          salonId: c.salon.id,
          scheduledStart: new Date(slot.scheduledStart),
          serviceIds: [c.service.id],
        }),
      );
      expect(feasibility.canCreate).toBe(true);
    }
  });

  it("respecte une indisponibilité de l'unique employée compétente", async () => {
    const c = await createContext({
      serviceName: "Application racines",
      durationMinutes: 30,
    });

    await testPrisma.employeeUnavailability.create({
      data: {
        employeeId: c.employee.id,
        type: "UNAVAILABLE",
        startAt: local("2035-09-10", "10:00"),
        endAt: local("2035-09-10", "10:45"),
        createdByUserId: c.user.id,
      },
    });

    const slots = await testPrisma.$transaction((tx) =>
      findNextAvailableSlotsInDb(tx, {
        salonId: c.salon.id,
        scheduledStart: local("2035-09-10", "10:00"),
        serviceIds: [c.service.id],
      }),
    );

    expect(slots[0]?.timeValue).toBe("10:45");
  });

  it("ne propose rien si aucune employée active ne maîtrise la prestation", async () => {
    const c = await createContext({
      serviceName: "Brushing",
      durationMinutes: 30,
    });

    const otherService = await testPrisma.service.create({
      data: {
        salonId: c.salon.id,
        categoryId: c.category.id,
        name: "Technique non attribuée",
        defaultDurationMinutes: 30,
        defaultPrice: 100,
      },
    });

    // Le salon est déjà en mode compétences via la compétence Brushing créée
    // par createContext, mais personne ne maîtrise cette seconde prestation.
    const slots = await testPrisma.$transaction((tx) =>
      findNextAvailableSlotsInDb(tx, {
        salonId: c.salon.id,
        scheduledStart: local("2035-09-10", "10:00"),
        serviceIds: [otherService.id],
      }),
    );

    expect(slots).toEqual([]);
  });

  it("ne propose jamais un créneau qui finit après 21:30", async () => {
    const c = await createContext({
      serviceName: "Soin long",
      durationMinutes: 90,
    });

    // Indisponible jusqu'à 20:00 : 20:00 -> 21:30 est la dernière limite autorisée.
    await testPrisma.employeeUnavailability.create({
      data: {
        employeeId: c.employee.id,
        type: "UNAVAILABLE",
        startAt: local("2035-09-10", "10:00"),
        endAt: local("2035-09-10", "20:00"),
        createdByUserId: c.user.id,
      },
    });

    const slots = await testPrisma.$transaction((tx) =>
      findNextAvailableSlotsInDb(tx, {
        salonId: c.salon.id,
        scheduledStart: local("2035-09-10", "19:45"),
        serviceIds: [c.service.id],
      }),
    );

    expect(
      slots.every((slot) => {
        if (slot.dateKey !== "2035-09-10") {
          return true;
        }

        const [hours, minutes] = slot.timeValue.split(":").map(Number);
        const startMinute = hours * 60 + minutes;

        return startMinute + 90 <= 21 * 60 + 30;
      }),
    ).toBe(true);

    expect(
      slots.some(
        (slot) => slot.dateKey === "2035-09-10" && slot.timeValue === "20:00",
      ),
    ).toBe(true);
  });

  it("retourne au maximum trois propositions et chacune repasse le moteur autoritaire", async () => {
    const c = await createContext({
      serviceName: "Brushing",
      durationMinutes: 30,
    });

    await createExistingAppointment({
      salonId: c.salon.id,
      userId: c.user.id,
      clientId: c.client.id,
      serviceId: c.service.id,
      serviceName: c.service.name,
      employeeId: c.employee.id,
      scheduledStart: local("2035-09-10", "10:00"),
      durationMinutes: 30,
    });

    const slots = await testPrisma.$transaction((tx) =>
      findNextAvailableSlotsInDb(tx, {
        salonId: c.salon.id,
        scheduledStart: local("2035-09-10", "10:00"),
        serviceIds: [c.service.id],
      }),
    );

    expect(slots.length).toBeLessThanOrEqual(3);

    for (const slot of slots) {
      const feasibility = await testPrisma.$transaction((tx) =>
        checkBookingFeasibilityInDb(tx, {
          salonId: c.salon.id,
          scheduledStart: new Date(slot.scheduledStart),
          serviceIds: [c.service.id],
        }),
      );
      expect(feasibility.canCreate).toBe(true);
    }
  });
});
