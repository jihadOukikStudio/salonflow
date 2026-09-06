import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";

import {
  getClients,
  setClientActive,
  updateClient,
} from "@/server/services/clients/client-admin";
import {
  createRoom,
  getRooms,
  updateRoom,
} from "@/server/services/rooms/room-admin";
import {
  createEmployeeUnavailability,
  createRoomUnavailability,
  deleteEmployeeUnavailability,
  deleteRoomUnavailability,
  getEmployeeUnavailabilityPage,
} from "@/server/services/unavailability/unavailability";
import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

import { cleanDatabase } from "../../helpers/database";
import { testPrisma } from "../../helpers/prisma";

async function createUser(
  salonId: string,
  params?: {
    role?: "ADMIN" | "EMPLOYEE";
    canManageSalon?: boolean;
    firstName?: string;
  },
) {
  const user = await testPrisma.user.create({
    data: {
      salonId,
      email: `${crypto.randomUUID()}@coverage.test`,
      passwordHash: "test-hash",
      firstName: params?.firstName ?? "Utilisateur",
      role: params?.role ?? "EMPLOYEE",
      canManageSalon: params?.canManageSalon ?? false,
    },
  });

  const currentUser: CurrentUser = {
    id: user.id,
    salonId: user.salonId,
    role: user.role,
    canManageSalon: user.canManageSalon,
    isActive: user.isActive,
  };

  return { user, currentUser };
}

async function createBaseContext() {
  const salon = await testPrisma.salon.create({
    data: { name: `Salon ${crypto.randomUUID()}` },
  });

  const admin = await createUser(salon.id, {
    role: "ADMIN",
    canManageSalon: true,
    firstName: "Gérante",
  });

  const manager = await createUser(salon.id, {
    role: "EMPLOYEE",
    canManageSalon: true,
    firstName: "Responsable",
  });

  const employeeAccount = await createUser(salon.id, {
    role: "EMPLOYEE",
    canManageSalon: false,
    firstName: "Amina",
  });

  const otherEmployeeAccount = await createUser(salon.id, {
    role: "EMPLOYEE",
    canManageSalon: false,
    firstName: "Sara",
  });

  const employee = await testPrisma.employee.create({
    data: {
      salonId: salon.id,
      userId: employeeAccount.user.id,
      firstName: "Amina",
      lastName: "Test",
      isActive: true,
    },
  });

  const otherEmployee = await testPrisma.employee.create({
    data: {
      salonId: salon.id,
      userId: otherEmployeeAccount.user.id,
      firstName: "Sara",
      lastName: null,
      isActive: true,
    },
  });

  const room = await testPrisma.room.create({
    data: {
      salonId: salon.id,
      name: "Salle de soins 1",
      type: "TREATMENT_ROOM",
      capacity: 1,
      isActive: true,
    },
  });

  const otherRoom = await testPrisma.room.create({
    data: {
      salonId: salon.id,
      name: "Hamam individuel",
      type: "HAMAM",
      capacity: 1,
      isActive: true,
    },
  });

  const client = await testPrisma.client.create({
    data: {
      salonId: salon.id,
      name: "Cliente Alpha",
      phone: `+2126${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`,
      isActive: true,
    },
  });

  return {
    salon,
    admin,
    manager,
    employeeAccount,
    otherEmployeeAccount,
    employee,
    otherEmployee,
    room,
    otherRoom,
    client,
  };
}

async function createAppointment(params: {
  salonId: string;
  clientId: string;
  createdByUserId: string;
  scheduledStart: Date;
  assignedEmployeeId?: string | null;
  roomId?: string | null;
}) {
  return testPrisma.appointment.create({
    data: {
      salonId: params.salonId,
      clientId: params.clientId,
      scheduledStart: params.scheduledStart,
      estimatedDurationMinutes: 60,
      status: "PLANNED",
      createdByUserId: params.createdByUserId,
      services: {
        create: {
          serviceNameSnapshot: "Prestation test",
          durationMinutes: 60,
          price: 100,
          assignedEmployeeId: params.assignedEmployeeId ?? null,
          roomId: params.roomId ?? null,
        },
      },
    },
    include: { services: true },
  });
}

describe("coverage branches — administration clientes", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("liste les clientes avec et sans recherche", async () => {
    const context = await createBaseContext();

    const all = await getClients(context.admin.currentUser);
    const filtered = await getClients(context.admin.currentUser, "Alpha");
    const emptyQuery = await getClients(context.admin.currentUser, "   ");

    expect(all.some((client) => client.id === context.client.id)).toBe(true);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe(context.client.id);
    expect(emptyQuery.some((client) => client.id === context.client.id)).toBe(
      true,
    );
  });

  it("autorise admin et responsable à modifier une cliente et normalise la note", async () => {
    const context = await createBaseContext();

    const updated = await updateClient(context.admin.currentUser, {
      clientId: context.client.id,
      name: "  Cliente Beta  ",
      phone: context.client.phone,
      internalNote: "  cliente fidèle  ",
    });

    expect(updated.name).toBe("Cliente Beta");
    expect(updated.internalNote).toBe("cliente fidèle");

    const updatedByManager = await updateClient(context.manager.currentUser, {
      clientId: context.client.id,
      name: "Cliente Gamma",
      phone: context.client.phone,
      internalNote: "   ",
    });

    expect(updatedByManager.internalNote).toBeNull();
  });

  it("refuse la modification à une employée standard", async () => {
    const context = await createBaseContext();

    await expect(
      updateClient(context.employeeAccount.currentUser, {
        clientId: context.client.id,
        name: "Interdit",
        phone: context.client.phone,
      }),
    ).rejects.toThrow();
  });

  it("refuse une cliente inexistante et un numéro déjà utilisé", async () => {
    const context = await createBaseContext();

    await expect(
      updateClient(context.admin.currentUser, {
        clientId: crypto.randomUUID(),
        name: "Absente",
        phone: "+212600000001",
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    const duplicate = await testPrisma.client.create({
      data: {
        salonId: context.salon.id,
        name: "Cliente doublon",
        phone: "+212600000002",
      },
    });

    await expect(
      updateClient(context.admin.currentUser, {
        clientId: context.client.id,
        name: "Cliente Alpha",
        phone: duplicate.phone,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("désactive puis réactive une cliente et couvre les deux actions d'audit", async () => {
    const context = await createBaseContext();

    const disabled = await setClientActive(context.admin.currentUser, {
      clientId: context.client.id,
      isActive: false,
    });
    expect(disabled.isActive).toBe(false);

    const enabled = await setClientActive(context.manager.currentUser, {
      clientId: context.client.id,
      isActive: true,
    });
    expect(enabled.isActive).toBe(true);

    const actions = await testPrisma.activityLog.findMany({
      where: { entityId: context.client.id },
      select: { action: true },
    });

    expect(actions.map((item) => item.action)).toEqual(
      expect.arrayContaining(["CLIENT_DEACTIVATED", "CLIENT_REACTIVATED"]),
    );
  });

  it("refuse setClientActive sur une cliente d'un autre salon", async () => {
    const contextA = await createBaseContext();
    const contextB = await createBaseContext();

    await expect(
      setClientActive(contextA.admin.currentUser, {
        clientId: contextB.client.id,
        isActive: false,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});

describe("coverage branches — administration salles", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("liste et crée une salle en tant qu'admin", async () => {
    const context = await createBaseContext();

    const rooms = await getRooms(context.admin.currentUser);
    expect(rooms.some((room) => room.id === context.room.id)).toBe(true);

    const created = await createRoom(context.admin.currentUser, {
      name: "  Salle de soins 2  ",
      type: "TREATMENT_ROOM",
      capacity: 1,
    });

    expect(created.name).toBe("Salle de soins 2");
  });

  it("refuse la création à une employée et refuse les doublons", async () => {
    const context = await createBaseContext();

    await expect(
      createRoom(context.employeeAccount.currentUser, {
        name: "Salle interdite",
        type: "TREATMENT_ROOM",
        capacity: 1,
      }),
    ).rejects.toThrow();

    await expect(
      createRoom(context.admin.currentUser, {
        name: " Salle de soins 1 ",
        type: "TREATMENT_ROOM",
        capacity: 1,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("modifie une salle active et permet sa désactivation sans usage futur", async () => {
    const context = await createBaseContext();

    const renamed = await updateRoom(context.admin.currentUser, {
      roomId: context.room.id,
      name: "Salle visage",
      capacity: 1,
      isActive: true,
    });
    expect(renamed.name).toBe("Salle visage");

    const disabled = await updateRoom(context.admin.currentUser, {
      roomId: context.room.id,
      name: "Salle visage",
      capacity: 1,
      isActive: false,
    });
    expect(disabled.isActive).toBe(false);
  });

  it("refuse une salle inexistante et un nom déjà utilisé", async () => {
    const context = await createBaseContext();

    await expect(
      updateRoom(context.admin.currentUser, {
        roomId: crypto.randomUUID(),
        name: "Inconnue",
        capacity: 1,
        isActive: true,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    await expect(
      updateRoom(context.admin.currentUser, {
        roomId: context.room.id,
        name: context.otherRoom.name,
        capacity: 1,
        isActive: true,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("refuse de désactiver une salle encore utilisée par un RDV futur", async () => {
    const context = await createBaseContext();

    await createAppointment({
      salonId: context.salon.id,
      clientId: context.client.id,
      createdByUserId: context.admin.user.id,
      scheduledStart: new Date("2035-09-10T12:00:00.000Z"),
      roomId: context.room.id,
    });

    await expect(
      updateRoom(context.admin.currentUser, {
        roomId: context.room.id,
        name: context.room.name,
        capacity: 1,
        isActive: false,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });
});

describe("coverage branches — indisponibilités", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("retourne le contexte d'indisponibilité pour employée et admin", async () => {
    const context = await createBaseContext();

    const employeePage = await getEmployeeUnavailabilityPage(
      context.employeeAccount.currentUser,
    );
    expect(employeePage.ownEmployeeId).toBe(context.employee.id);
    expect(employeePage.canManage).toBe(false);

    const adminPage = await getEmployeeUnavailabilityPage(
      context.admin.currentUser,
    );
    expect(adminPage.ownEmployeeId).toBeNull();
    expect(adminPage.canManage).toBe(true);
  });

  it("permet à une employée de créer et supprimer sa propre indisponibilité", async () => {
    const context = await createBaseContext();

    const created = await createEmployeeUnavailability(
      context.employeeAccount.currentUser,
      {
        employeeId: context.employee.id,
        type: "BREAK",
        startAt: new Date("2035-09-10T10:00:00.000Z"),
        endAt: new Date("2035-09-10T10:30:00.000Z"),
        note: "  Pause  ",
      },
    );

    expect(created.note).toBe("Pause");

    const deleted = await deleteEmployeeUnavailability(
      context.employeeAccount.currentUser,
      created.id,
    );
    expect(deleted.id).toBe(created.id);
  });

  it("permet à une responsable de gérer une autre employée", async () => {
    const context = await createBaseContext();

    const created = await createEmployeeUnavailability(
      context.manager.currentUser,
      {
        employeeId: context.otherEmployee.id,
        type: "ABSENCE",
        startAt: new Date("2035-09-11T10:00:00.000Z"),
        endAt: new Date("2035-09-11T11:00:00.000Z"),
      },
    );

    expect(created.note).toBeNull();

    await expect(
      deleteEmployeeUnavailability(context.manager.currentUser, created.id),
    ).resolves.toEqual({ id: created.id });
  });

  it("refuse une employée absente/inactive ou l'indisponibilité d'une collègue", async () => {
    const context = await createBaseContext();

    await expect(
      createEmployeeUnavailability(context.admin.currentUser, {
        employeeId: crypto.randomUUID(),
        type: "ABSENCE",
        startAt: new Date("2035-09-10T10:00:00.000Z"),
        endAt: new Date("2035-09-10T11:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    await expect(
      createEmployeeUnavailability(context.employeeAccount.currentUser, {
        employeeId: context.otherEmployee.id,
        type: "ABSENCE",
        startAt: new Date("2035-09-10T10:00:00.000Z"),
        endAt: new Date("2035-09-10T11:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it("refuse une indisponibilité employée qui chevauche une autre indisponibilité", async () => {
    const context = await createBaseContext();

    await createEmployeeUnavailability(context.admin.currentUser, {
      employeeId: context.employee.id,
      type: "BREAK",
      startAt: new Date("2035-09-10T10:00:00.000Z"),
      endAt: new Date("2035-09-10T11:00:00.000Z"),
    });

    await expect(
      createEmployeeUnavailability(context.admin.currentUser, {
        employeeId: context.employee.id,
        type: "ABSENCE",
        startAt: new Date("2035-09-10T10:30:00.000Z"),
        endAt: new Date("2035-09-10T11:30:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("refuse une indisponibilité employée qui chevauche un RDV", async () => {
    const context = await createBaseContext();

    await createAppointment({
      salonId: context.salon.id,
      clientId: context.client.id,
      createdByUserId: context.admin.user.id,
      scheduledStart: new Date("2035-09-10T10:00:00.000Z"),
      assignedEmployeeId: context.employee.id,
    });

    await expect(
      createEmployeeUnavailability(context.admin.currentUser, {
        employeeId: context.employee.id,
        type: "ABSENCE",
        startAt: new Date("2035-09-10T10:30:00.000Z"),
        endAt: new Date("2035-09-10T11:30:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("refuse de supprimer une indisponibilité employée inexistante ou appartenant à une collègue", async () => {
    const context = await createBaseContext();

    await expect(
      deleteEmployeeUnavailability(
        context.employeeAccount.currentUser,
        crypto.randomUUID(),
      ),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    const created = await createEmployeeUnavailability(
      context.admin.currentUser,
      {
        employeeId: context.otherEmployee.id,
        type: "LEAVE",
        startAt: new Date("2035-09-12T10:00:00.000Z"),
        endAt: new Date("2035-09-12T12:00:00.000Z"),
      },
    );

    await expect(
      deleteEmployeeUnavailability(
        context.employeeAccount.currentUser,
        created.id,
      ),
    ).rejects.toThrow();
  });

  it("gère la création d'indisponibilité salle pour admin et responsable", async () => {
    const context = await createBaseContext();

    const created = await createRoomUnavailability(context.admin.currentUser, {
      roomId: context.room.id,
      startAt: new Date("2035-09-10T10:00:00.000Z"),
      endAt: new Date("2035-09-10T11:00:00.000Z"),
      reason: "  Maintenance  ",
    });

    expect(created.reason).toBe("Maintenance");

    await deleteRoomUnavailability(context.admin.currentUser, created.id);

    const managerCreated = await createRoomUnavailability(
      context.manager.currentUser,
      {
        roomId: context.room.id,
        startAt: new Date("2035-09-10T12:00:00.000Z"),
        endAt: new Date("2035-09-10T13:00:00.000Z"),
      },
    );

    expect(managerCreated.reason).toBeNull();
    await expect(
      deleteRoomUnavailability(context.manager.currentUser, managerCreated.id),
    ).resolves.toEqual({ id: managerCreated.id });
  });

  it("refuse à une employée standard la gestion d'une salle et refuse une salle inconnue", async () => {
    const context = await createBaseContext();

    await expect(
      createRoomUnavailability(context.employeeAccount.currentUser, {
        roomId: context.room.id,
        startAt: new Date("2035-09-10T10:00:00.000Z"),
        endAt: new Date("2035-09-10T11:00:00.000Z"),
      }),
    ).rejects.toThrow();

    await expect(
      createRoomUnavailability(context.admin.currentUser, {
        roomId: crypto.randomUUID(),
        startAt: new Date("2035-09-10T10:00:00.000Z"),
        endAt: new Date("2035-09-10T11:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("refuse une indisponibilité salle qui chevauche une autre indisponibilité", async () => {
    const context = await createBaseContext();

    await createRoomUnavailability(context.admin.currentUser, {
      roomId: context.room.id,
      startAt: new Date("2035-09-10T10:00:00.000Z"),
      endAt: new Date("2035-09-10T11:00:00.000Z"),
    });

    await expect(
      createRoomUnavailability(context.admin.currentUser, {
        roomId: context.room.id,
        startAt: new Date("2035-09-10T10:30:00.000Z"),
        endAt: new Date("2035-09-10T11:30:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("refuse une indisponibilité salle qui chevauche un RDV", async () => {
    const context = await createBaseContext();

    await createAppointment({
      salonId: context.salon.id,
      clientId: context.client.id,
      createdByUserId: context.admin.user.id,
      scheduledStart: new Date("2035-09-10T10:00:00.000Z"),
      roomId: context.room.id,
    });

    await expect(
      createRoomUnavailability(context.admin.currentUser, {
        roomId: context.room.id,
        startAt: new Date("2035-09-10T10:30:00.000Z"),
        endAt: new Date("2035-09-10T11:30:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("refuse de supprimer une indisponibilité salle sans droit ou inexistante", async () => {
    const context = await createBaseContext();

    await expect(
      deleteRoomUnavailability(
        context.employeeAccount.currentUser,
        crypto.randomUUID(),
      ),
    ).rejects.toThrow();

    await expect(
      deleteRoomUnavailability(context.admin.currentUser, crypto.randomUUID()),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});
