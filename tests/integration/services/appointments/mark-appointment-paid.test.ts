import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/permissions";

import { markAppointmentPaid } from "@/server/services/appointments/mark-appointment-paid";

import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

import { cleanDatabase } from "../../helpers/database";
import { testPrisma } from "../../helpers/prisma";

const PAYMENT_AMOUNT = 250.5;

async function createAccount(
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
  appointmentStatus?:
    "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CLOSED" | "CANCELLED";

  existingPendingPayment?: boolean;
}) {
  const salon = await testPrisma.salon.create({
    data: {
      name: `Salon ${crypto.randomUUID()}`,
    },
  });

  const admin = await createAccount(salon.id, {
    role: "ADMIN",
    canManageSalon: true,
    firstName: "Admin",
  });

  const client = await testPrisma.client.create({
    data: {
      salonId: salon.id,
      name: "Cliente",
      phone: `+212${crypto.randomUUID().replaceAll("-", "").slice(0, 9)}`,
    },
  });

  const appointment = await testPrisma.appointment.create({
    data: {
      salonId: salon.id,
      clientId: client.id,

      scheduledStart: new Date(Date.now() - 60 * 60 * 1000),

      estimatedDurationMinutes: 90,

      status: params?.appointmentStatus ?? "COMPLETED",

      createdByUserId: admin.user.id,

      services: {
        create: [
          {
            serviceNameSnapshot: "Brushing",
            durationMinutes: 30,
            price: 100,
            status: "DONE",

            actualStartedAt: new Date(Date.now() - 60 * 60 * 1000),

            actualFinishedAt: new Date(Date.now() - 30 * 60 * 1000),
          },

          {
            serviceNameSnapshot: "Manucure",
            durationMinutes: 60,
            price: 150.5,
            status: "DONE",

            actualStartedAt: new Date(Date.now() - 60 * 60 * 1000),

            actualFinishedAt: new Date(Date.now() - 5 * 60 * 1000),
          },
        ],
      },
    },

    include: {
      services: true,
    },
  });

  if (params?.existingPendingPayment) {
    await testPrisma.payment.create({
      data: {
        appointmentId: appointment.id,
        amount: 1,
        method: "CASH",
        status: "PENDING",
      },
    });
  }

  return {
    salon,
    client,
    appointment,
    ...admin,
  };
}

describe("markAppointmentPaid", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("allows an admin to record a cash payment", async () => {
    const context = await createContext();

    const payment = await markAppointmentPaid(context.currentUser, {
      appointmentId: context.appointment.id,
      amount: PAYMENT_AMOUNT,
    });

    expect(payment.status).toBe("PAID");
    expect(payment.method).toBe("CASH");
    expect(payment.paidAt).toBeInstanceOf(Date);

    expect(payment.recordedByUserId).toBe(context.user.id);
  });

  it("allows an employee with salon management access to record payment", async () => {
    const context = await createContext();

    const responsible = await createAccount(context.salon.id, {
      role: "EMPLOYEE",
      canManageSalon: true,
      firstName: "Responsable",
    });

    const payment = await markAppointmentPaid(responsible.currentUser, {
      appointmentId: context.appointment.id,
      amount: PAYMENT_AMOUNT,
    });

    expect(payment.status).toBe("PAID");

    expect(payment.recordedByUserId).toBe(responsible.user.id);
  });

  it("rejects a standard employee", async () => {
    const context = await createContext();

    const employee = await createAccount(context.salon.id, {
      role: "EMPLOYEE",
      canManageSalon: false,
    });

    await expect(
      markAppointmentPaid(employee.currentUser, {
        appointmentId: context.appointment.id,
        amount: PAYMENT_AMOUNT,
      }),
    ).rejects.toThrow();
  });

  it("rejects an inactive user", async () => {
    const context = await createContext();

    const inactiveAdmin = await createAccount(context.salon.id, {
      role: "ADMIN",
      canManageSalon: true,
      isActive: false,
    });

    await expect(
      markAppointmentPaid(inactiveAdmin.currentUser, {
        appointmentId: context.appointment.id,
        amount: PAYMENT_AMOUNT,
      }),
    ).rejects.toThrow();
  });

  it("does not expose an appointment belonging to another salon", async () => {
    const contextA = await createContext();
    const contextB = await createContext();

    await expect(
      markAppointmentPaid(contextA.currentUser, {
        appointmentId: contextB.appointment.id,
        amount: PAYMENT_AMOUNT,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("rejects payment of a planned appointment", async () => {
    const context = await createContext({
      appointmentStatus: "PLANNED",
    });

    await expect(
      markAppointmentPaid(context.currentUser, {
        appointmentId: context.appointment.id,
        amount: PAYMENT_AMOUNT,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects payment of an in-progress appointment", async () => {
    const context = await createContext({
      appointmentStatus: "IN_PROGRESS",
    });

    await expect(
      markAppointmentPaid(context.currentUser, {
        appointmentId: context.appointment.id,
        amount: PAYMENT_AMOUNT,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects payment of a cancelled appointment", async () => {
    const context = await createContext({
      appointmentStatus: "CANCELLED",
    });

    await expect(
      markAppointmentPaid(context.currentUser, {
        appointmentId: context.appointment.id,
        amount: PAYMENT_AMOUNT,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("rejects payment of a closed appointment", async () => {
    const context = await createContext({
      appointmentStatus: "CLOSED",
    });

    await expect(
      markAppointmentPaid(context.currentUser, {
        appointmentId: context.appointment.id,
        amount: PAYMENT_AMOUNT,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("records the actual cash amount provided at payment time", async () => {
    const context = await createContext();

    const payment = await markAppointmentPaid(context.currentUser, {
      appointmentId: context.appointment.id,
      amount: PAYMENT_AMOUNT,
    });

    expect(payment.amount.toString()).toBe(String(PAYMENT_AMOUNT));
  });

  it("turns an existing PENDING payment into PAID and updates its actual amount", async () => {
    const context = await createContext({
      existingPendingPayment: true,
    });

    const before = await testPrisma.payment.findUnique({
      where: {
        appointmentId: context.appointment.id,
      },
    });

    const payment = await markAppointmentPaid(context.currentUser, {
      appointmentId: context.appointment.id,
      amount: PAYMENT_AMOUNT,
    });

    expect(payment.id).toBe(before?.id);
    expect(payment.status).toBe("PAID");

    expect(payment.amount.toString()).toBe(String(PAYMENT_AMOUNT));
  });

  it("rejects an appointment that is already paid", async () => {
    const context = await createContext();

    await markAppointmentPaid(context.currentUser, {
      appointmentId: context.appointment.id,
      amount: PAYMENT_AMOUNT,
    });

    await expect(
      markAppointmentPaid(context.currentUser, {
        appointmentId: context.appointment.id,
        amount: PAYMENT_AMOUNT,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("creates an activity log", async () => {
    const context = await createContext();

    const payment = await markAppointmentPaid(context.currentUser, {
      appointmentId: context.appointment.id,
      amount: PAYMENT_AMOUNT,
    });

    const log = await testPrisma.activityLog.findFirst({
      where: {
        salonId: context.salon.id,
        userId: context.user.id,
        entityId: context.appointment.id,
        action: "APPOINTMENT_PAYMENT_RECORDED",
      },
    });

    expect(log).not.toBeNull();

    expect(log?.entityType).toBe("APPOINTMENT");

    expect(payment.status).toBe("PAID");
  });

  it("records the payment only once under concurrent calls", async () => {
    const context = await createContext();

    const results = await Promise.allSettled([
      markAppointmentPaid(context.currentUser, {
        appointmentId: context.appointment.id,
        amount: PAYMENT_AMOUNT,
      }),

      markAppointmentPaid(context.currentUser, {
        appointmentId: context.appointment.id,
        amount: PAYMENT_AMOUNT,
      }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);

    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);

    const payments = await testPrisma.payment.count({
      where: {
        appointmentId: context.appointment.id,
        status: "PAID",
      },
    });

    expect(payments).toBe(1);

    const logs = await testPrisma.activityLog.count({
      where: {
        salonId: context.salon.id,
        entityId: context.appointment.id,
        action: "APPOINTMENT_PAYMENT_RECORDED",
      },
    });

    expect(logs).toBe(1);
  });
});
