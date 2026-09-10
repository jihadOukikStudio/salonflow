import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";
import { PermissionDeniedError } from "@/server/permissions";
import { addAppointmentService } from "@/server/services/appointments/add-appointment-service";
import { checkAddServiceFeasibility } from "@/server/services/appointments/check-add-service-feasibility";
import { checkBookingFeasibilityInDb } from "@/server/services/appointments/check-booking-feasibility";
import { createAppointment } from "@/server/services/appointments/create-appointment";
import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";
import { validateEmployeeAvailability } from "@/server/services/resources/validate-employee-availability";
import { validateRoomAvailability } from "@/server/services/resources/validate-room-availability";

import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

type RoomKind = "HAMAM" | "TREATMENT_ROOM";
type AppointmentKind =
  "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CLOSED" | "CANCELLED";

async function createBase(params?: {
  employeeCount?: number;
  treatmentRoomCount?: number;
  hamamCount?: number;
}) {
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

  const responsible = await testPrisma.user.create({
    data: {
      salonId: salon.id,
      email: `${crypto.randomUUID()}@test.local`,
      passwordHash: "test-hash",
      firstName: "Responsable",
      role: "EMPLOYEE",
      canManageSalon: true,
    },
  });

  const standard = await testPrisma.user.create({
    data: {
      salonId: salon.id,
      email: `${crypto.randomUUID()}@test.local`,
      passwordHash: "test-hash",
      firstName: "Employée",
      role: "EMPLOYEE",
      canManageSalon: false,
    },
  });

  const currentUser = (user: typeof admin): CurrentUser => ({
    id: user.id,
    salonId: salon.id,
    role: user.role,
    canManageSalon: user.canManageSalon,
    isActive: user.isActive,
  });

  const employees = [];
  for (let index = 0; index < (params?.employeeCount ?? 2); index += 1) {
    employees.push(
      await testPrisma.employee.create({
        data: {
          salonId: salon.id,
          firstName: `Employée ${index + 1}`,
        },
      }),
    );
  }

  const rooms = [];
  for (let index = 0; index < (params?.treatmentRoomCount ?? 2); index += 1) {
    rooms.push(
      await testPrisma.room.create({
        data: {
          salonId: salon.id,
          name: `Salle de soins ${index + 1}`,
          type: "TREATMENT_ROOM",
          capacity: 1,
        },
      }),
    );
  }
  for (let index = 0; index < (params?.hamamCount ?? 2); index += 1) {
    rooms.push(
      await testPrisma.room.create({
        data: {
          salonId: salon.id,
          name: index === 0 ? "Hamam individuel" : `Hamam ${index + 1}`,
          type: "HAMAM",
          capacity: index === 0 ? 1 : 2,
        },
      }),
    );
  }

  const category = await testPrisma.serviceCategory.create({
    data: { salonId: salon.id, name: `Catégorie ${crypto.randomUUID()}` },
  });

  const makeService = async (params: {
    name: string;
    duration: number;
    roomType?: RoomKind | null;
    price?: number;
  }) =>
    testPrisma.service.create({
      data: {
        salonId: salon.id,
        categoryId: category.id,
        name: `${params.name} ${crypto.randomUUID()}`,
        defaultDurationMinutes: params.duration,
        defaultPrice: params.price ?? 100,
        requiredRoomType: params.roomType ?? null,
      },
    });

  const services = {
    s15: await makeService({ name: "Express 15", duration: 15 }),
    s30: await makeService({ name: "Prestation 30", duration: 30 }),
    s45: await makeService({ name: "Prestation 45", duration: 45 }),
    s60: await makeService({ name: "Prestation 60", duration: 60 }),
    s90: await makeService({ name: "Prestation 90", duration: 90 }),
    treatment30: await makeService({
      name: "Soin 30",
      duration: 30,
      roomType: "TREATMENT_ROOM",
    }),
    hamam60: await makeService({
      name: "Hamam 60",
      duration: 60,
      roomType: "HAMAM",
    }),
  };

  let clientCounter = 0;
  const makeClient = async (name = "Cliente") => {
    clientCounter += 1;
    return testPrisma.client.create({
      data: {
        salonId: salon.id,
        name: `${name} ${clientCounter}`,
        phone: `+2126${String(clientCounter).padStart(8, "0")}`,
      },
    });
  };

  return {
    salon,
    admin,
    responsible,
    standard,
    adminUser: currentUser(admin),
    responsibleUser: currentUser(responsible),
    standardUser: currentUser(standard),
    employees,
    rooms,
    category,
    services,
    makeService,
    makeClient,
  };
}

async function createStoredAppointment(params: {
  salonId: string;
  userId: string;
  clientId: string;
  start: string;
  duration: number;
  status?: AppointmentKind;
  serviceName?: string;
  serviceDuration?: number;
  assignedEmployeeId?: string | null;
  roomId?: string | null;
  requiredRoomType?: RoomKind | null;
}) {
  return testPrisma.appointment.create({
    data: {
      salonId: params.salonId,
      clientId: params.clientId,
      scheduledStart: new Date(params.start),
      estimatedDurationMinutes: params.duration,
      status: params.status ?? "PLANNED",
      createdByUserId: params.userId,
      services: {
        create: {
          serviceNameSnapshot: params.serviceName ?? "Prestation existante",
          durationMinutes: params.serviceDuration ?? params.duration,
          price: 100,
          assignedEmployeeId: params.assignedEmployeeId ?? null,
          roomId: params.roomId ?? null,
          requiredRoomTypeSnapshot: params.requiredRoomType ?? null,
        },
      },
    },
    include: { services: true },
  });
}

async function feasibility(
  salonId: string,
  start: string,
  serviceIds: string[],
) {
  return testPrisma.$transaction((tx) =>
    checkBookingFeasibilityInDb(tx, {
      salonId,
      scheduledStart: new Date(start),
      serviceIds,
    }),
  );
}

function roomOfType<T extends { type: string }>(rooms: T[], type: RoomKind) {
  const room = rooms.find((item) => item.type === type);
  if (!room) throw new Error(`Missing room ${type}`);
  return room;
}

function employeeAt<T>(employees: T[], index: number) {
  const employee = employees[index];
  if (!employee) throw new Error(`Missing employee ${index}`);
  return employee;
}

describe("Phase 11.2.1 — anti-surbooking regression suite", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  describe("création et combinaison de prestations", () => {
    it("accepte une création normale quand la capacité existe", async () => {
      const c = await createBase({ employeeCount: 2 });
      const client = await c.makeClient();

      const result = await createAppointment(c.adminUser, {
        clientId: client.id,
        scheduledStart: new Date("2099-09-10T10:00:00.000Z"),
        services: [{ serviceId: c.services.s30.id }],
      });

      expect(result.estimatedDurationMinutes).toBe(30);
      expect(result.services).toHaveLength(1);
    });

    it("gère le cas 1+2 possibles, 3 impossible, puis 4 possible", async () => {
      const c = await createBase({ employeeCount: 1 });
      const existingClient = await c.makeClient("Suivante");

      await createStoredAppointment({
        salonId: c.salon.id,
        userId: c.admin.id,
        clientId: existingClient.id,
        start: "2099-09-10T11:30:00.000Z",
        duration: 60,
      });

      const oneAndTwo = await feasibility(
        c.salon.id,
        "2099-09-10T10:00:00.000Z",
        [c.services.s30.id, c.services.s45.id],
      );
      expect(oneAndTwo.canCreate).toBe(true);
      expect(oneAndTwo.durationMinutes).toBe(75);

      const withThird = await feasibility(
        c.salon.id,
        "2099-09-10T10:00:00.000Z",
        [c.services.s30.id, c.services.s45.id, c.services.s60.id],
      );
      expect(withThird.canCreate).toBe(false);
      expect(withThird.level).toBe("BLOCKED");

      const withFourthInstead = await feasibility(
        c.salon.id,
        "2099-09-10T10:00:00.000Z",
        [c.services.s30.id, c.services.s45.id, c.services.s15.id],
      );
      expect(withFourthInstead.canCreate).toBe(true);
      expect(withFourthInstead.durationMinutes).toBe(90);
    });

    it("bloque une prestation longue qui empiète sur le rendez-vous suivant", async () => {
      const c = await createBase({ employeeCount: 1 });
      const client = await c.makeClient();
      await createStoredAppointment({
        salonId: c.salon.id,
        userId: c.admin.id,
        clientId: client.id,
        start: "2099-09-10T11:00:00.000Z",
        duration: 60,
      });

      const result = await feasibility(c.salon.id, "2099-09-10T10:00:00.000Z", [
        c.services.s90.id,
      ]);
      expect(result.canCreate).toBe(false);
    });

    it("accepte une prestation courte qui finit exactement au début du rendez-vous suivant", async () => {
      const c = await createBase({ employeeCount: 1 });
      const client = await c.makeClient();
      await createStoredAppointment({
        salonId: c.salon.id,
        userId: c.admin.id,
        clientId: client.id,
        start: "2099-09-10T11:00:00.000Z",
        duration: 60,
      });

      const result = await feasibility(c.salon.id, "2099-09-10T10:30:00.000Z", [
        c.services.s30.id,
      ]);
      expect(result.canCreate).toBe(true);
      expect(result.scheduledEnd).toBe("2099-09-10T11:00:00.000Z");
    });

    it("bloque un chevauchement d'une minute", async () => {
      const c = await createBase({ employeeCount: 1 });
      const client = await c.makeClient();
      await createStoredAppointment({
        salonId: c.salon.id,
        userId: c.admin.id,
        clientId: client.id,
        start: "2099-09-10T11:00:00.000Z",
        duration: 60,
      });

      const service31 = await c.makeService({
        name: "31 minutes",
        duration: 31,
      });
      const result = await feasibility(c.salon.id, "2099-09-10T10:30:00.000Z", [
        service31.id,
      ]);
      expect(result.canCreate).toBe(false);
    });

    it("conserve les overrides de durée supportés par createAppointment", async () => {
      const c = await createBase({ employeeCount: 1 });
      const existingClient = await c.makeClient("Suivante");
      const newClient = await c.makeClient("Nouvelle");

      await createStoredAppointment({
        salonId: c.salon.id,
        userId: c.admin.id,
        clientId: existingClient.id,
        start: "2099-09-10T10:30:00.000Z",
        duration: 60,
      });

      const created = await createAppointment(c.adminUser, {
        clientId: newClient.id,
        scheduledStart: new Date("2099-09-10T10:00:00.000Z"),
        services: [{ serviceId: c.services.s60.id, durationMinutes: 15 }],
      });

      expect(created.estimatedDurationMinutes).toBe(15);
    });
  });

  describe("capacité employées et indisponibilités", () => {
    it("compte un RDV non affecté comme capacité consommée", async () => {
      const c = await createBase({ employeeCount: 1 });
      const client = await c.makeClient();
      await createStoredAppointment({
        salonId: c.salon.id,
        userId: c.admin.id,
        clientId: client.id,
        start: "2099-09-10T10:00:00.000Z",
        duration: 60,
        assignedEmployeeId: null,
      });

      const result = await feasibility(c.salon.id, "2099-09-10T10:30:00.000Z", [
        c.services.s30.id,
      ]);
      expect(result.canCreate).toBe(false);
      expect(result.employeeCapacity.reservedByAppointments).toBe(1);
    });

    it("n'utilise pas une employée absente comme capacité disponible", async () => {
      const c = await createBase({ employeeCount: 1 });
      const employee = employeeAt(c.employees, 0);
      await testPrisma.employeeUnavailability.create({
        data: {
          employeeId: employee.id,
          type: "ABSENCE",
          startAt: new Date("2099-09-10T09:00:00.000Z"),
          endAt: new Date("2099-09-10T12:00:00.000Z"),
          createdByUserId: c.admin.id,
        },
      });

      const result = await feasibility(c.salon.id, "2099-09-10T10:00:00.000Z", [
        c.services.s30.id,
      ]);
      expect(result.canCreate).toBe(false);
      expect(result.employeeCapacity.unavailable).toBe(1);
    });

    it.each(["BREAK", "LEAVE", "UNAVAILABLE"] as const)(
      "respecte une indisponibilité employée de type %s",
      async (type) => {
        const c = await createBase({ employeeCount: 1 });
        const employee = employeeAt(c.employees, 0);
        await testPrisma.employeeUnavailability.create({
          data: {
            employeeId: employee.id,
            type,
            startAt: new Date("2099-09-10T10:15:00.000Z"),
            endAt: new Date("2099-09-10T10:45:00.000Z"),
            createdByUserId: c.admin.id,
          },
        });

        const result = await feasibility(
          c.salon.id,
          "2099-09-10T10:00:00.000Z",
          [c.services.s60.id],
        );
        expect(result.canCreate).toBe(false);
      },
    );

    it("reste possible si une autre employée est disponible", async () => {
      const c = await createBase({ employeeCount: 2 });
      const employee = employeeAt(c.employees, 0);
      await testPrisma.employeeUnavailability.create({
        data: {
          employeeId: employee.id,
          type: "ABSENCE",
          startAt: new Date("2099-09-10T09:00:00.000Z"),
          endAt: new Date("2099-09-10T12:00:00.000Z"),
          createdByUserId: c.admin.id,
        },
      });

      const result = await feasibility(c.salon.id, "2099-09-10T10:00:00.000Z", [
        c.services.s30.id,
      ]);
      expect(result.canCreate).toBe(true);
      expect(result.employeeCapacity.remaining).toBe(1);
    });

    it("bloque si toutes les employées sont déjà consommées par des RDV", async () => {
      const c = await createBase({ employeeCount: 2 });
      const clientA = await c.makeClient("A");
      const clientB = await c.makeClient("B");
      await createStoredAppointment({
        salonId: c.salon.id,
        userId: c.admin.id,
        clientId: clientA.id,
        start: "2099-09-10T10:00:00.000Z",
        duration: 60,
      });
      await createStoredAppointment({
        salonId: c.salon.id,
        userId: c.admin.id,
        clientId: clientB.id,
        start: "2099-09-10T10:00:00.000Z",
        duration: 60,
      });

      const result = await feasibility(c.salon.id, "2099-09-10T10:15:00.000Z", [
        c.services.s30.id,
      ]);
      expect(result.canCreate).toBe(false);
    });
  });

  describe("Hamam et salles de soins", () => {
    it("bloque quand le seul Hamam est réservé", async () => {
      const c = await createBase({ employeeCount: 2, hamamCount: 1 });
      const hamam = roomOfType(c.rooms, "HAMAM");
      const client = await c.makeClient();
      await createStoredAppointment({
        salonId: c.salon.id,
        userId: c.admin.id,
        clientId: client.id,
        start: "2099-09-10T10:00:00.000Z",
        duration: 60,
        roomId: hamam.id,
        requiredRoomType: "HAMAM",
      });

      const result = await feasibility(c.salon.id, "2099-09-10T10:30:00.000Z", [
        c.services.hamam60.id,
      ]);
      expect(result.canCreate).toBe(false);
      expect(
        result.roomCapacity.find((room) => room.type === "HAMAM")?.remaining,
      ).toBe(0);
    });

    it("ne traite pas la capacité 2 du Hamam duo comme deux RDV indépendants", async () => {
      const c = await createBase({ employeeCount: 2, hamamCount: 1 });
      const hamam = roomOfType(c.rooms, "HAMAM");
      await testPrisma.room.update({
        where: { id: hamam.id },
        data: { capacity: 2 },
      });
      const client = await c.makeClient();
      await createStoredAppointment({
        salonId: c.salon.id,
        userId: c.admin.id,
        clientId: client.id,
        start: "2099-09-10T10:00:00.000Z",
        duration: 60,
        roomId: hamam.id,
        requiredRoomType: "HAMAM",
      });

      const result = await feasibility(c.salon.id, "2099-09-10T10:30:00.000Z", [
        c.services.hamam60.id,
      ]);
      expect(result.canCreate).toBe(false);
    });

    it("reste possible avec une deuxième salle de soins libre", async () => {
      const c = await createBase({ employeeCount: 2, treatmentRoomCount: 2 });
      const treatmentRooms = c.rooms.filter(
        (room) => room.type === "TREATMENT_ROOM",
      );
      const first = treatmentRooms[0];
      if (!first) throw new Error("Missing treatment room");
      const client = await c.makeClient();
      await createStoredAppointment({
        salonId: c.salon.id,
        userId: c.admin.id,
        clientId: client.id,
        start: "2099-09-10T10:00:00.000Z",
        duration: 60,
        roomId: first.id,
        requiredRoomType: "TREATMENT_ROOM",
      });

      const result = await feasibility(c.salon.id, "2099-09-10T10:30:00.000Z", [
        c.services.treatment30.id,
      ]);
      expect(result.canCreate).toBe(true);
      expect(
        result.roomCapacity.find((room) => room.type === "TREATMENT_ROOM")
          ?.remaining,
      ).toBe(1);
    });

    it("bloque quand toutes les salles de soins sont réservées", async () => {
      const c = await createBase({ employeeCount: 3, treatmentRoomCount: 2 });
      const treatmentRooms = c.rooms.filter(
        (room) => room.type === "TREATMENT_ROOM",
      );
      for (let index = 0; index < treatmentRooms.length; index += 1) {
        const room = treatmentRooms[index];
        if (!room) continue;
        const client = await c.makeClient();
        await createStoredAppointment({
          salonId: c.salon.id,
          userId: c.admin.id,
          clientId: client.id,
          start: "2099-09-10T10:00:00.000Z",
          duration: 60,
          roomId: room.id,
          requiredRoomType: "TREATMENT_ROOM",
        });
      }

      const result = await feasibility(c.salon.id, "2099-09-10T10:30:00.000Z", [
        c.services.treatment30.id,
      ]);
      expect(result.canCreate).toBe(false);
    });

    it("respecte l'indisponibilité d'une salle", async () => {
      const c = await createBase({ employeeCount: 2, treatmentRoomCount: 1 });
      const room = roomOfType(c.rooms, "TREATMENT_ROOM");
      await testPrisma.roomUnavailability.create({
        data: {
          roomId: room.id,
          startAt: new Date("2099-09-10T10:15:00.000Z"),
          endAt: new Date("2099-09-10T10:45:00.000Z"),
          reason: "Maintenance",
          createdByUserId: c.admin.id,
        },
      });

      const result = await feasibility(c.salon.id, "2099-09-10T10:00:00.000Z", [
        c.services.treatment30.id,
      ]);
      expect(result.canCreate).toBe(false);
    });
  });

  describe("statuts qui libèrent la capacité", () => {
    it.each(["CANCELLED", "CLOSED"] as const)(
      "ignore un rendez-vous %s pour la capacité",
      async (status) => {
        const c = await createBase({ employeeCount: 1 });
        const client = await c.makeClient();
        await createStoredAppointment({
          salonId: c.salon.id,
          userId: c.admin.id,
          clientId: client.id,
          start: "2099-09-10T10:00:00.000Z",
          duration: 60,
          status,
        });

        const result = await feasibility(
          c.salon.id,
          "2099-09-10T10:30:00.000Z",
          [c.services.s30.id],
        );
        expect(result.canCreate).toBe(true);
      },
    );
  });

  describe("ajout de prestation pendant le rendez-vous", () => {
    it("prévisualise un ajout possible sur PLANNED", async () => {
      const c = await createBase({ employeeCount: 2 });
      const client = await c.makeClient();
      const appointment = await createStoredAppointment({
        salonId: c.salon.id,
        userId: c.admin.id,
        clientId: client.id,
        start: "2099-09-10T10:00:00.000Z",
        duration: 30,
      });

      const result = await checkAddServiceFeasibility(c.adminUser, {
        appointmentId: appointment.id,
        serviceId: c.services.s30.id,
      });
      expect(result.canAdd).toBe(true);
      expect(result.newDurationMinutes).toBe(60);
    });

    it("prévisualise un ajout possible sur IN_PROGRESS quand la capacité existe", async () => {
      const c = await createBase({ employeeCount: 2 });
      const client = await c.makeClient();
      const appointment = await createStoredAppointment({
        salonId: c.salon.id,
        userId: c.admin.id,
        clientId: client.id,
        start: "2099-09-10T10:00:00.000Z",
        duration: 30,
        status: "IN_PROGRESS",
      });

      const result = await checkAddServiceFeasibility(c.adminUser, {
        appointmentId: appointment.id,
        serviceId: c.services.s30.id,
      });
      expect(result.canAdd).toBe(true);
    });

    it("bloque la prévisualisation d'un ajout IN_PROGRESS qui entre en conflit avec le RDV suivant", async () => {
      const c = await createBase({ employeeCount: 1 });
      const employee = employeeAt(c.employees, 0);
      const currentClient = await c.makeClient("Actuelle");
      const nextClient = await c.makeClient("Suivante");
      const appointment = await createStoredAppointment({
        salonId: c.salon.id,
        userId: c.admin.id,
        clientId: currentClient.id,
        start: "2099-09-10T10:00:00.000Z",
        duration: 30,
        status: "IN_PROGRESS",
        assignedEmployeeId: employee.id,
      });
      await createStoredAppointment({
        salonId: c.salon.id,
        userId: c.admin.id,
        clientId: nextClient.id,
        start: "2099-09-10T10:30:00.000Z",
        duration: 60,
        assignedEmployeeId: employee.id,
      });

      const result = await checkAddServiceFeasibility(c.adminUser, {
        appointmentId: appointment.id,
        serviceId: c.services.s30.id,
      });
      expect(result.canAdd).toBe(false);
      expect(result.level).toBe("BLOCKED");
    });

    it("bloque la prévisualisation IN_PROGRESS si aucune salle compatible n'est libre", async () => {
      const c = await createBase({ employeeCount: 2, treatmentRoomCount: 1 });
      const room = roomOfType(c.rooms, "TREATMENT_ROOM");
      const currentClient = await c.makeClient("Actuelle");
      const otherClient = await c.makeClient("Autre");
      const appointment = await createStoredAppointment({
        salonId: c.salon.id,
        userId: c.admin.id,
        clientId: currentClient.id,
        start: "2099-09-10T10:00:00.000Z",
        duration: 30,
        status: "IN_PROGRESS",
      });
      await createStoredAppointment({
        salonId: c.salon.id,
        userId: c.admin.id,
        clientId: otherClient.id,
        start: "2099-09-10T10:00:00.000Z",
        duration: 60,
        roomId: room.id,
        requiredRoomType: "TREATMENT_ROOM",
      });

      const result = await checkAddServiceFeasibility(c.adminUser, {
        appointmentId: appointment.id,
        serviceId: c.services.treatment30.id,
      });
      expect(result.canAdd).toBe(false);
    });

    it("autorise l'ajout réel sur un rendez-vous COMPLETED non payé et le rouvre", async () => {
      const c = await createBase();
      const client = await c.makeClient();
      const appointment = await createStoredAppointment({
        salonId: c.salon.id,
        userId: c.admin.id,
        clientId: client.id,
        start: "2099-09-10T10:00:00.000Z",
        duration: 30,
        status: "COMPLETED",
      });

      const result = await addAppointmentService(c.adminUser, {
        appointmentId: appointment.id,
        serviceId: c.services.s30.id,
      });

      expect(result.status).toBe("IN_PROGRESS");
      expect(result.services).toHaveLength(2);
      expect(result.estimatedDurationMinutes).toBe(60);
    });

    it("refuse l'ajout réel sur un rendez-vous COMPLETED déjà encaissé", async () => {
      const c = await createBase();
      const client = await c.makeClient();
      const appointment = await createStoredAppointment({
        salonId: c.salon.id,
        userId: c.admin.id,
        clientId: client.id,
        start: "2099-09-10T10:00:00.000Z",
        duration: 30,
        status: "COMPLETED",
      });

      await testPrisma.payment.create({
        data: {
          appointmentId: appointment.id,
          amount: 100,
          method: "CASH",
          status: "PAID",
          paidAt: new Date(),
          recordedByUserId: c.admin.id,
        },
      });

      await expect(
        addAppointmentService(c.adminUser, {
          appointmentId: appointment.id,
          serviceId: c.services.s30.id,
        }),
      ).rejects.toBeInstanceOf(BusinessRuleError);
    });

    it.each(["CLOSED", "CANCELLED"] as const)(
      "refuse l'ajout réel sur un rendez-vous %s",
      async (status) => {
        const c = await createBase();
        const client = await c.makeClient();
        const appointment = await createStoredAppointment({
          salonId: c.salon.id,
          userId: c.admin.id,
          clientId: client.id,
          start: "2099-09-10T10:00:00.000Z",
          duration: 30,
          status,
        });

        await expect(
          addAppointmentService(c.adminUser, {
            appointmentId: appointment.id,
            serviceId: c.services.s30.id,
          }),
        ).rejects.toBeInstanceOf(BusinessRuleError);
      },
    );
  });

  describe("concurrence réelle", () => {
    it("n'autorise qu'une création sur la dernière capacité disponible", async () => {
      const c = await createBase({ employeeCount: 1 });
      const clientA = await c.makeClient("A");
      const clientB = await c.makeClient("B");

      const results = await Promise.allSettled([
        createAppointment(c.adminUser, {
          clientId: clientA.id,
          scheduledStart: new Date("2099-09-10T10:00:00.000Z"),
          services: [{ serviceId: c.services.s30.id }],
        }),
        createAppointment(c.adminUser, {
          clientId: clientB.id,
          scheduledStart: new Date("2099-09-10T10:00:00.000Z"),
          services: [{ serviceId: c.services.s30.id }],
        }),
      ]);

      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
      expect(
        await testPrisma.appointment.count({ where: { salonId: c.salon.id } }),
      ).toBe(1);
    });

    it("sérialise deux ajouts concurrents de la même prestation", async () => {
      const c = await createBase({ employeeCount: 2 });
      const client = await c.makeClient();
      const appointment = await createStoredAppointment({
        salonId: c.salon.id,
        userId: c.admin.id,
        clientId: client.id,
        start: "2099-09-10T10:00:00.000Z",
        duration: 30,
      });

      const results = await Promise.allSettled([
        addAppointmentService(c.adminUser, {
          appointmentId: appointment.id,
          serviceId: c.services.s30.id,
        }),
        addAppointmentService(c.adminUser, {
          appointmentId: appointment.id,
          serviceId: c.services.s30.id,
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

  describe("sécurité, multi-salon et permissions", () => {
    it("isole strictement la capacité de deux salons", async () => {
      const salonA = await createBase({ employeeCount: 1 });
      const salonB = await createBase({ employeeCount: 1 });
      const clientA = await salonA.makeClient();
      await createStoredAppointment({
        salonId: salonA.salon.id,
        userId: salonA.admin.id,
        clientId: clientA.id,
        start: "2099-09-10T10:00:00.000Z",
        duration: 60,
      });

      const result = await feasibility(
        salonB.salon.id,
        "2099-09-10T10:30:00.000Z",
        [salonB.services.s30.id],
      );
      expect(result.canCreate).toBe(true);
    });

    it("n'expose pas une prestation d'un autre salon dans la faisabilité d'ajout", async () => {
      const salonA = await createBase();
      const salonB = await createBase();
      const client = await salonA.makeClient();
      const appointment = await createStoredAppointment({
        salonId: salonA.salon.id,
        userId: salonA.admin.id,
        clientId: client.id,
        start: "2099-09-10T10:00:00.000Z",
        duration: 30,
      });

      await expect(
        checkAddServiceFeasibility(salonA.adminUser, {
          appointmentId: appointment.id,
          serviceId: salonB.services.s30.id,
        }),
      ).rejects.toBeInstanceOf(ResourceNotFoundError);
    });

    it("autorise la Responsable à créer un RDV", async () => {
      const c = await createBase({ employeeCount: 1 });
      const client = await c.makeClient();
      await expect(
        createAppointment(c.responsibleUser, {
          clientId: client.id,
          scheduledStart: new Date("2099-09-10T10:00:00.000Z"),
          services: [{ serviceId: c.services.s30.id }],
        }),
      ).resolves.toBeDefined();
    });

    it("refuse la création structurelle à une employée standard", async () => {
      const c = await createBase({ employeeCount: 1 });
      const client = await c.makeClient();
      await expect(
        createAppointment(c.standardUser, {
          clientId: client.id,
          scheduledStart: new Date("2099-09-10T10:00:00.000Z"),
          services: [{ serviceId: c.services.s30.id }],
        }),
      ).rejects.toBeInstanceOf(PermissionDeniedError);
    });

    it("refuse la prévisualisation d'ajout structurel à une employée standard", async () => {
      const c = await createBase();
      const client = await c.makeClient();
      const appointment = await createStoredAppointment({
        salonId: c.salon.id,
        userId: c.admin.id,
        clientId: client.id,
        start: "2099-09-10T10:00:00.000Z",
        duration: 30,
      });

      await expect(
        checkAddServiceFeasibility(c.standardUser, {
          appointmentId: appointment.id,
          serviceId: c.services.s30.id,
        }),
      ).rejects.toBeInstanceOf(PermissionDeniedError);
    });
  });

  describe("validateurs de ressources — filet de sécurité bas niveau", () => {
    it("accepte deux créneaux adjacents pour une employée", async () => {
      const c = await createBase({ employeeCount: 1 });
      const employee = employeeAt(c.employees, 0);
      const client = await c.makeClient();
      await createStoredAppointment({
        salonId: c.salon.id,
        userId: c.admin.id,
        clientId: client.id,
        start: "2099-09-10T09:00:00.000Z",
        duration: 60,
        assignedEmployeeId: employee.id,
      });

      await expect(
        testPrisma.$transaction((tx) =>
          validateEmployeeAvailability(tx, {
            salonId: c.salon.id,
            employeeId: employee.id,
            scheduledStart: new Date("2099-09-10T10:00:00.000Z"),
            estimatedDurationMinutes: 60,
          }),
        ),
      ).resolves.toBeUndefined();
    });

    it("refuse un chevauchement d'une minute pour une salle", async () => {
      const c = await createBase({ treatmentRoomCount: 1 });
      const room = roomOfType(c.rooms, "TREATMENT_ROOM");
      const client = await c.makeClient();
      await createStoredAppointment({
        salonId: c.salon.id,
        userId: c.admin.id,
        clientId: client.id,
        start: "2099-09-10T09:00:00.000Z",
        duration: 60,
        roomId: room.id,
        requiredRoomType: "TREATMENT_ROOM",
      });

      await expect(
        testPrisma.$transaction((tx) =>
          validateRoomAvailability(tx, {
            salonId: c.salon.id,
            roomId: room.id,
            scheduledStart: new Date("2099-09-10T09:59:00.000Z"),
            estimatedDurationMinutes: 30,
            requiredRoomType: "TREATMENT_ROOM",
          }),
        ),
      ).rejects.toBeInstanceOf(BusinessRuleError);
    });
  });
});
