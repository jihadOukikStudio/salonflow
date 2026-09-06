import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";

import { updateAppointmentDetails } from "@/server/services/appointments/update-appointment-details";

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
    isActive?: boolean;
    firstName?: string;
  },
) {
  const user = await testPrisma.user.create({
    data: {
      salonId,

      email: `${crypto.randomUUID()}@test.local`,

      passwordHash: "test-hash",

      firstName: params?.firstName ?? "Utilisateur",

      role: params?.role ?? "EMPLOYEE",

      canManageSalon: params?.canManageSalon ?? false,

      isActive: params?.isActive ?? true,
    },
  });

  const currentUser: CurrentUser = {
    id: user.id,
    salonId: user.salonId,
    role: user.role,
    canManageSalon: user.canManageSalon,
    isActive: user.isActive,
  };

  return {
    user,
    currentUser,
  };
}

async function createContext(params?: {
  status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CLOSED" | "CANCELLED";
}) {
  const salon = await testPrisma.salon.create({
    data: {
      name: `Salon ${crypto.randomUUID()}`,
    },
  });

  const admin = await createUser(salon.id, {
    role: "ADMIN",
    canManageSalon: true,
    firstName: "Admin",
  });

  const standardEmployee = await createUser(salon.id, {
    role: "EMPLOYEE",
    canManageSalon: false,
    firstName: "Amina",
  });

  const currentClient = await testPrisma.client.create({
    data: {
      salonId: salon.id,
      name: "Cliente actuelle",

      phone: `+212${crypto.randomUUID().replaceAll("-", "").slice(0, 9)}`,
    },
  });

  const otherClient = await testPrisma.client.create({
    data: {
      salonId: salon.id,
      name: "Nouvelle cliente",

      phone: `+212${crypto.randomUUID().replaceAll("-", "").slice(0, 9)}`,
    },
  });

  const appointment = await testPrisma.appointment.create({
    data: {
      salonId: salon.id,
      clientId: currentClient.id,

      scheduledStart: new Date("2026-09-10T10:00:00.000Z"),

      estimatedDurationMinutes: 60,

      status: params?.status ?? "PLANNED",

      internalNote: "Note initiale",

      createdByUserId: admin.user.id,

      ...(params?.status === "CANCELLED"
        ? {
            cancelledAt: new Date(),

            cancelledByUserId: admin.user.id,
          }
        : {}),

      services: {
        create: {
          serviceNameSnapshot: "Brushing",

          durationMinutes: 60,
          price: 100,
        },
      },
    },
  });

  return {
    salon,
    admin,
    standardEmployee,
    currentClient,
    otherClient,
    appointment,
  };
}

describe("updateAppointmentDetails", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("allows an admin to change the client of a planned appointment", async () => {
    const context = await createContext();

    const result = await updateAppointmentDetails(context.admin.currentUser, {
      appointmentId: context.appointment.id,

      clientId: context.otherClient.id,
    });

    expect(result.clientId).toBe(context.otherClient.id);

    expect(result.client.id).toBe(context.otherClient.id);
  });

  it("allows an admin to update the internal note", async () => {
    const context = await createContext();

    const result = await updateAppointmentDetails(context.admin.currentUser, {
      appointmentId: context.appointment.id,

      internalNote: "  Prévoir accueil particulier  ",
    });

    expect(result.internalNote).toBe("Prévoir accueil particulier");
  });

  it("allows removing the internal note with null", async () => {
    const context = await createContext();

    const result = await updateAppointmentDetails(context.admin.currentUser, {
      appointmentId: context.appointment.id,

      internalNote: null,
    });

    expect(result.internalNote).toBeNull();
  });

  it("allows removing the internal note with an empty string", async () => {
    const context = await createContext();

    const result = await updateAppointmentDetails(context.admin.currentUser, {
      appointmentId: context.appointment.id,

      internalNote: "   ",
    });

    expect(result.internalNote).toBeNull();
  });

  it("allows updating client and note atomically", async () => {
    const context = await createContext();

    const result = await updateAppointmentDetails(context.admin.currentUser, {
      appointmentId: context.appointment.id,

      clientId: context.otherClient.id,

      internalNote: "Nouvelle note",
    });

    expect(result.clientId).toBe(context.otherClient.id);

    expect(result.internalNote).toBe("Nouvelle note");
  });

  it("allows a responsible employee to update appointment details", async () => {
    const context = await createContext();

    const responsible = await createUser(context.salon.id, {
      role: "EMPLOYEE",
      canManageSalon: true,
      firstName: "Responsable",
    });

    const result = await updateAppointmentDetails(responsible.currentUser, {
      appointmentId: context.appointment.id,

      internalNote: "Note responsable",
    });

    expect(result.internalNote).toBe("Note responsable");
  });

  it("rejects a standard employee", async () => {
    const context = await createContext();

    await expect(
      updateAppointmentDetails(context.standardEmployee.currentUser, {
        appointmentId: context.appointment.id,

        internalNote: "Tentative",
      }),
    ).rejects.toThrow();
  });

  it("rejects an inactive user", async () => {
    const context = await createContext();

    const inactiveAdmin = await createUser(context.salon.id, {
      role: "ADMIN",
      canManageSalon: true,
      isActive: false,
    });

    await expect(
      updateAppointmentDetails(inactiveAdmin.currentUser, {
        appointmentId: context.appointment.id,

        internalNote: "Tentative",
      }),
    ).rejects.toThrow();
  });

  it("does not expose an appointment from another salon", async () => {
    const contextA = await createContext();

    const contextB = await createContext();

    await expect(
      updateAppointmentDetails(contextA.admin.currentUser, {
        appointmentId: contextB.appointment.id,

        internalNote: "Tentative",
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("does not allow assigning a client from another salon", async () => {
    const contextA = await createContext();

    const contextB = await createContext();

    await expect(
      updateAppointmentDetails(contextA.admin.currentUser, {
        appointmentId: contextA.appointment.id,

        clientId: contextB.currentClient.id,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("rejects an inactive client", async () => {
    const context = await createContext();

    await testPrisma.client.update({
      where: {
        id: context.otherClient.id,
      },

      data: {
        isActive: false,
      },
    });

    await expect(
      updateAppointmentDetails(context.admin.currentUser, {
        appointmentId: context.appointment.id,

        clientId: context.otherClient.id,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("allows updating the note of an in-progress appointment", async () => {
    const context = await createContext({
      status: "IN_PROGRESS",
    });

    const result = await updateAppointmentDetails(context.admin.currentUser, {
      appointmentId: context.appointment.id,

      internalNote: "Information ajoutée pendant le rendez-vous",
    });

    expect(result.internalNote).toBe(
      "Information ajoutée pendant le rendez-vous",
    );
  });

  it("does not allow changing the client after appointment execution has started", async () => {
    const context = await createContext({
      status: "IN_PROGRESS",
    });

    await expect(
      updateAppointmentDetails(context.admin.currentUser, {
        appointmentId: context.appointment.id,

        clientId: context.otherClient.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it.each(["COMPLETED", "CLOSED", "CANCELLED"] as const)(
    "rejects modification of appointment with status %s",
    async (status) => {
      const context = await createContext({
        status,
      });

      await expect(
        updateAppointmentDetails(context.admin.currentUser, {
          appointmentId: context.appointment.id,

          internalNote: "Tentative",
        }),
      ).rejects.toBeInstanceOf(BusinessRuleError);
    },
  );

  it("rejects a request without any modification", async () => {
    const context = await createContext();

    await expect(
      updateAppointmentDetails(context.admin.currentUser, {
        appointmentId: context.appointment.id,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects a modification identical to the current values", async () => {
    const context = await createContext();

    await expect(
      updateAppointmentDetails(context.admin.currentUser, {
        appointmentId: context.appointment.id,

        clientId: context.currentClient.id,

        internalNote: "Note initiale",
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("persists the changes in database", async () => {
    const context = await createContext();

    await updateAppointmentDetails(context.admin.currentUser, {
      appointmentId: context.appointment.id,

      clientId: context.otherClient.id,

      internalNote: "Note persistée",
    });

    const stored = await testPrisma.appointment.findUnique({
      where: {
        id: context.appointment.id,
      },
    });

    expect(stored?.clientId).toBe(context.otherClient.id);

    expect(stored?.internalNote).toBe("Note persistée");
  });

  it("creates an activity log containing the change information", async () => {
    const context = await createContext();

    await updateAppointmentDetails(context.admin.currentUser, {
      appointmentId: context.appointment.id,

      clientId: context.otherClient.id,

      internalNote: "Nouvelle note",
    });

    const log = await testPrisma.activityLog.findFirst({
      where: {
        salonId: context.salon.id,

        userId: context.admin.user.id,

        entityId: context.appointment.id,

        action: "APPOINTMENT_DETAILS_UPDATED",
      },
    });

    expect(log).not.toBeNull();

    expect(log?.entityType).toBe("APPOINTMENT");
  });

  it("serializes concurrent modifications of the same appointment without corrupting data", async () => {
    const context = await createContext();

    /*
     * Les deux opérations sont autorisées.
     * Le verrou du RDV les exécute l'une après l'autre.
     *
     * On ne demande PAS qu'une des deux échoue :
     * ce ne sont pas deux opérations incompatibles.
     */
    const results = await Promise.allSettled([
      updateAppointmentDetails(context.admin.currentUser, {
        appointmentId: context.appointment.id,

        internalNote: "Première note",
      }),

      updateAppointmentDetails(context.admin.currentUser, {
        appointmentId: context.appointment.id,

        clientId: context.otherClient.id,
      }),
    ]);

    expect(results.every((result) => result.status === "fulfilled")).toBe(true);

    const stored = await testPrisma.appointment.findUnique({
      where: {
        id: context.appointment.id,
      },
    });

    expect(stored?.clientId).toBe(context.otherClient.id);

    expect(stored?.internalNote).toBe("Première note");

    const logs = await testPrisma.activityLog.count({
      where: {
        salonId: context.salon.id,

        entityId: context.appointment.id,

        action: "APPOINTMENT_DETAILS_UPDATED",
      },
    });

    expect(logs).toBe(2);
  });
});
