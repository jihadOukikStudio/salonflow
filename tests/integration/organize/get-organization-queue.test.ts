import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";
import { getOrganizationIssueCount } from "@/features/organize/server/get-organization-issue-count";
import { getOrganizationQueue } from "@/features/organize/server/get-organization-queue";

import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

function inMinutes(minutes: number) {
  return new Date(Date.now() + minutes * 60_000);
}

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
      firstName: "Admin",
      role: "ADMIN",
      canManageSalon: true,
    },
  });

  const currentEmployeeUser = await testPrisma.user.create({
    data: {
      salonId: salon.id,
      email: `${crypto.randomUUID()}@test.local`,
      passwordHash: "test-hash",
      firstName: "Amina",
      role: "EMPLOYEE",
      canManageSalon: false,
    },
  });

  const amina = await testPrisma.employee.create({
    data: {
      salonId: salon.id,
      userId: currentEmployeeUser.id,
      firstName: "Amina",
    },
  });

  const sara = await testPrisma.employee.create({
    data: {
      salonId: salon.id,
      firstName: "Sara",
    },
  });

  const lina = await testPrisma.employee.create({
    data: {
      salonId: salon.id,
      firstName: "Lina",
    },
  });

  const room1 = await testPrisma.room.create({
    data: {
      salonId: salon.id,
      name: "Salle de soins 1",
      type: "TREATMENT_ROOM",
      capacity: 1,
    },
  });

  const room2 = await testPrisma.room.create({
    data: {
      salonId: salon.id,
      name: "Salle de soins 2",
      type: "TREATMENT_ROOM",
      capacity: 1,
    },
  });

  const hamam = await testPrisma.room.create({
    data: {
      salonId: salon.id,
      name: "Hamam individuel",
      type: "HAMAM",
      capacity: 1,
    },
  });

  const client = await testPrisma.client.create({
    data: {
      salonId: salon.id,
      name: "Cliente",
      phone: `+212${crypto.randomUUID().replaceAll("-", "").slice(0, 9)}`,
    },
  });

  const queueAppointment = await testPrisma.appointment.create({
    data: {
      salonId: salon.id,
      clientId: client.id,
      scheduledStart: inMinutes(120),
      estimatedDurationMinutes: 60,
      createdByUserId: user.id,
      services: {
        create: {
          serviceNameSnapshot: "Soin visage",
          durationMinutes: 60,
          price: 300,
          requiredRoomTypeSnapshot: "TREATMENT_ROOM",
        },
      },
    },
    include: {
      services: true,
    },
  });

  const currentUser: CurrentUser = {
    id: currentEmployeeUser.id,
    salonId: salon.id,
    role: currentEmployeeUser.role,
    canManageSalon: currentEmployeeUser.canManageSalon,
    isActive: currentEmployeeUser.isActive,
  };

  return {
    salon,
    user,
    currentUser,
    amina,
    sara,
    lina,
    room1,
    room2,
    hamam,
    client,
    queueAppointment,
    queueService: queueAppointment.services[0]!,
  };
}

describe("getOrganizationQueue availability", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("returns only employees and rooms available for the appointment interval", async () => {
    const context = await createContext();

    const otherClient = await testPrisma.client.create({
      data: {
        salonId: context.salon.id,
        name: "Autre cliente",
        phone: `+212${crypto.randomUUID().replaceAll("-", "").slice(0, 9)}`,
      },
    });

    await testPrisma.appointment.create({
      data: {
        salonId: context.salon.id,
        clientId: otherClient.id,
        scheduledStart: inMinutes(120),
        estimatedDurationMinutes: 60,
        createdByUserId: context.user.id,
        services: {
          create: {
            serviceNameSnapshot: "Autre soin",
            durationMinutes: 60,
            price: 200,
            assignedEmployeeId: context.sara.id,
            roomId: context.room1.id,
            requiredRoomTypeSnapshot: "TREATMENT_ROOM",
          },
        },
      },
    });

    await testPrisma.employeeUnavailability.create({
      data: {
        employeeId: context.lina.id,
        type: "BREAK",
        startAt: inMinutes(130),
        endAt: inMinutes(150),
        createdByUserId: context.user.id,
      },
    });

    const queue = await getOrganizationQueue(context.currentUser);
    const item = queue.items.find(
      (candidate) => candidate.serviceId === context.queueService.id,
    );

    expect(item).toBeDefined();

    expect(item?.availableEmployees.map((employee) => employee.id)).toEqual([
      context.amina.id,
    ]);

    expect(item?.availableRooms.map((room) => room.id)).toEqual([
      context.room2.id,
    ]);

    expect(item?.availableRooms.map((room) => room.id)).not.toContain(
      context.hamam.id,
    );

    expect(item?.currentEmployeeCanTake).toBe(true);
  });

  it("hides Je prends eligibility when the connected employee is unavailable", async () => {
    const context = await createContext();

    await testPrisma.employeeUnavailability.create({
      data: {
        employeeId: context.amina.id,
        type: "ABSENCE",
        startAt: inMinutes(100),
        endAt: inMinutes(200),
        createdByUserId: context.user.id,
      },
    });

    const queue = await getOrganizationQueue(context.currentUser);
    const item = queue.items.find(
      (candidate) => candidate.serviceId === context.queueService.id,
    );

    expect(item?.currentEmployeeCanTake).toBe(false);
    expect(
      item?.availableEmployees.map((employee) => employee.id),
    ).not.toContain(context.amina.id);
  });

  it("keeps adjacent resources available", async () => {
    const context = await createContext();

    const queueStart = context.queueAppointment.scheduledStart;

    const otherClient = await testPrisma.client.create({
      data: {
        salonId: context.salon.id,
        name: "Cliente précédente",
        phone: `+212${crypto.randomUUID().replaceAll("-", "").slice(0, 9)}`,
      },
    });

    await testPrisma.appointment.create({
      data: {
        salonId: context.salon.id,
        clientId: otherClient.id,

        scheduledStart: new Date(queueStart.getTime() - 60 * 60_000),

        estimatedDurationMinutes: 60,
        createdByUserId: context.user.id,

        services: {
          create: {
            serviceNameSnapshot: "Avant",
            durationMinutes: 60,
            price: 100,
            assignedEmployeeId: context.sara.id,
            roomId: context.room1.id,
            requiredRoomTypeSnapshot: "TREATMENT_ROOM",
          },
        },
      },
    });

    const queue = await getOrganizationQueue(context.currentUser);

    const item = queue.items.find(
      (candidate) => candidate.serviceId === context.queueService.id,
    );

    expect(item?.availableEmployees.map((employee) => employee.id)).toContain(
      context.sara.id,
    );

    expect(item?.availableRooms.map((room) => room.id)).toContain(
      context.room1.id,
    );
  });
  it("compte une prestation une seule fois même si employée et salle manquent", async () => {
    const context = await createContext();

    expect(await getOrganizationIssueCount(context.salon.id)).toBe(1);

    await testPrisma.appointmentService.update({
      where: { id: context.queueService.id },
      data: { assignedEmployeeId: context.sara.id },
    });

    expect(await getOrganizationIssueCount(context.salon.id)).toBe(1);

    await testPrisma.appointmentService.update({
      where: { id: context.queueService.id },
      data: { roomId: context.room1.id },
    });

    expect(await getOrganizationIssueCount(context.salon.id)).toBe(0);
  });
});
