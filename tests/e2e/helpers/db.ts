import bcrypt from "bcryptjs";

import { cleanDatabase } from "../../integration/helpers/database";
import { testPrisma } from "../../integration/helpers/prisma";

export { testPrisma };

export const E2E_PASSWORD = "SalonFlow-E2E-2026!";
export const ADMIN_EMAIL = "gerante.e2e@salonflow.test";
export const EMPLOYEE_EMAIL = "amina.e2e@salonflow.test";
export const OTHER_EMPLOYEE_EMAIL = "sara.e2e@salonflow.test";

export function uniquePhone(suffix = "1") {
  const random = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `+2126${random}${suffix}`.slice(0, 13);
}

export async function resetE2EDatabase() {
  await cleanDatabase();
}

export function futureDate(minutesFromNow = 24 * 60) {
  return new Date(Date.now() + minutesFromNow * 60_000);
}

export function pastDate(minutesAgo = 5) {
  return new Date(Date.now() - minutesAgo * 60_000);
}

export async function createBaseE2EContext() {
  await resetE2EDatabase();

  const passwordHash = await bcrypt.hash(E2E_PASSWORD, 4);

  const salon = await testPrisma.salon.create({
    data: {
      name: "SalonFlow E2E",
      isActive: true,
    },
  });

  const adminUser = await testPrisma.user.create({
    data: {
      salonId: salon.id,
      email: ADMIN_EMAIL,
      passwordHash,
      firstName: "Gérante",
      role: "ADMIN",
      canManageSalon: true,
      isActive: true,
    },
  });

  const employeeUser = await testPrisma.user.create({
    data: {
      salonId: salon.id,
      email: EMPLOYEE_EMAIL,
      passwordHash,
      firstName: "Amina",
      role: "EMPLOYEE",
      canManageSalon: false,
      isActive: true,
    },
  });

  const saraUser = await testPrisma.user.create({
    data: {
      salonId: salon.id,
      email: OTHER_EMPLOYEE_EMAIL,
      passwordHash,
      firstName: "Sara",
      role: "EMPLOYEE",
      canManageSalon: false,
      isActive: true,
    },
  });

  const amina = await testPrisma.employee.create({
    data: {
      salonId: salon.id,
      userId: employeeUser.id,
      firstName: "Amina",
    },
  });

  const sara = await testPrisma.employee.create({
    data: {
      salonId: salon.id,
      userId: saraUser.id,
      firstName: "Sara",
    },
  });

  const lina = await testPrisma.employee.create({
    data: {
      salonId: salon.id,
      firstName: "Lina",
    },
  });

  const treatmentRoom1 = await testPrisma.room.create({
    data: {
      salonId: salon.id,
      name: "Salle de soins 1",
      type: "TREATMENT_ROOM",
      capacity: 1,
    },
  });

  const treatmentRoom2 = await testPrisma.room.create({
    data: {
      salonId: salon.id,
      name: "Salle de soins 2",
      type: "TREATMENT_ROOM",
      capacity: 1,
    },
  });

  const hamamIndividual = await testPrisma.room.create({
    data: {
      salonId: salon.id,
      name: "Hamam individuel",
      type: "HAMAM",
      capacity: 1,
    },
  });

  const hamamDuo = await testPrisma.room.create({
    data: {
      salonId: salon.id,
      name: "Hamam duo",
      type: "HAMAM",
      capacity: 2,
    },
  });

  const category = await testPrisma.serviceCategory.create({
    data: {
      salonId: salon.id,
      name: "E2E",
      displayOrder: 1,
    },
  });

  const faceService = await testPrisma.service.create({
    data: {
      salonId: salon.id,
      categoryId: category.id,
      name: "Soin visage E2E",
      defaultDurationMinutes: 60,
      defaultPrice: 300,
      requiredRoomType: "TREATMENT_ROOM",
      isActive: true,
    },
  });

  const extraService = await testPrisma.service.create({
    data: {
      salonId: salon.id,
      categoryId: category.id,
      name: "Massage E2E 30 min",
      defaultDurationMinutes: 30,
      defaultPrice: 180,
      requiredRoomType: "TREATMENT_ROOM",
      isActive: true,
    },
  });

  const noRoomService = await testPrisma.service.create({
    data: {
      salonId: salon.id,
      categoryId: category.id,
      name: "Manucure E2E",
      defaultDurationMinutes: 30,
      defaultPrice: 150,
      requiredRoomType: null,
      isActive: true,
    },
  });

  const hamamService = await testPrisma.service.create({
    data: {
      salonId: salon.id,
      categoryId: category.id,
      name: "Hamam E2E",
      defaultDurationMinutes: 60,
      defaultPrice: 250,
      requiredRoomType: "HAMAM",
      isActive: true,
    },
  });

  const client = await testPrisma.client.create({
    data: {
      salonId: salon.id,
      name: "Cliente E2E",
      phone: "+212600000001",
    },
  });

  return {
    salon,
    adminUser,
    employeeUser,
    saraUser,
    amina,
    sara,
    lina,
    treatmentRoom1,
    treatmentRoom2,
    hamamIndividual,
    hamamDuo,
    category,
    faceService,
    extraService,
    noRoomService,
    hamamService,
    client,
  };
}

type AppointmentOptions = {
  assignedEmployeeId?: string | null;
  roomId?: string | null;
  requiredRoomType?: "HAMAM" | "TREATMENT_ROOM" | null;
  serviceId?: string | null;
  serviceName?: string;
  status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CLOSED" | "CANCELLED";
  serviceStatus?: "TODO" | "IN_PROGRESS" | "DONE";
  scheduledStart?: Date;
  durationMinutes?: number;
  price?: number;
  performedByEmployeeId?: string | null;
  paidAmount?: number | null;
};

export async function createAppointmentScenario(
  options: AppointmentOptions = {},
) {
  const context = await createBaseE2EContext();

  const durationMinutes = options.durationMinutes ?? 60;
  const status = options.status ?? "PLANNED";
  const serviceStatus =
    options.serviceStatus ??
    (status === "COMPLETED" || status === "CLOSED" ? "DONE" : "TODO");

  const assignedEmployeeId =
    options.assignedEmployeeId === undefined
      ? context.amina.id
      : options.assignedEmployeeId;

  const requiredRoomType =
    options.requiredRoomType === undefined
      ? "TREATMENT_ROOM"
      : options.requiredRoomType;

  const roomId =
    options.roomId === undefined
      ? requiredRoomType === "TREATMENT_ROOM"
        ? context.treatmentRoom1.id
        : requiredRoomType === "HAMAM"
          ? context.hamamIndividual.id
          : null
      : options.roomId;

  const appointment = await testPrisma.appointment.create({
    data: {
      salonId: context.salon.id,
      clientId: context.client.id,
      scheduledStart: options.scheduledStart ?? futureDate(),
      estimatedDurationMinutes: durationMinutes,
      status,
      createdByUserId: context.adminUser.id,
      ...(status === "CANCELLED"
        ? {
            cancelledAt: new Date(),
            cancelledByUserId: context.adminUser.id,
          }
        : {}),
      services: {
        create: {
          serviceId:
            options.serviceId === undefined
              ? context.faceService.id
              : options.serviceId,
          serviceNameSnapshot: options.serviceName ?? "Soin visage E2E",
          durationMinutes,
          price: options.price ?? 300,
          requiredRoomTypeSnapshot: requiredRoomType,
          status: serviceStatus,
          assignedEmployeeId,
          roomId,
          performedByEmployeeId:
            options.performedByEmployeeId === undefined
              ? serviceStatus === "DONE"
                ? assignedEmployeeId
                : null
              : options.performedByEmployeeId,
          ...(serviceStatus === "IN_PROGRESS"
            ? { actualStartedAt: new Date() }
            : {}),
          ...(serviceStatus === "DONE"
            ? {
                actualStartedAt: new Date(Date.now() - 30 * 60_000),
                actualFinishedAt: new Date(),
              }
            : {}),
        },
      },
    },
    include: {
      services: true,
    },
  });

  if (options.paidAmount !== undefined && options.paidAmount !== null) {
    await testPrisma.payment.create({
      data: {
        appointmentId: appointment.id,
        amount: options.paidAmount,
        method: "CASH",
        status: "PAID",
        paidAt: new Date(),
        recordedByUserId: context.adminUser.id,
      },
    });
  }

  return {
    ...context,
    appointment,
    appointmentService: appointment.services[0]!,
  };
}

export async function createSecondAppointment(
  context: Awaited<ReturnType<typeof createBaseE2EContext>>,
  options: AppointmentOptions & {
    clientName?: string;
    phone?: string;
  } = {},
) {
  const client = await testPrisma.client.create({
    data: {
      salonId: context.salon.id,
      name: options.clientName ?? "Cliente E2E 2",
      phone: options.phone ?? uniquePhone("2"),
    },
  });

  const durationMinutes = options.durationMinutes ?? 60;

  return testPrisma.appointment.create({
    data: {
      salonId: context.salon.id,
      clientId: client.id,
      scheduledStart: options.scheduledStart ?? futureDate(),
      estimatedDurationMinutes: durationMinutes,
      status: options.status ?? "PLANNED",
      createdByUserId: context.adminUser.id,
      services: {
        create: {
          serviceId: options.serviceId ?? context.noRoomService.id,
          serviceNameSnapshot: options.serviceName ?? "Deuxième prestation E2E",
          durationMinutes,
          price: options.price ?? 150,
          requiredRoomTypeSnapshot: options.requiredRoomType ?? null,
          assignedEmployeeId: options.assignedEmployeeId ?? null,
          roomId: options.roomId ?? null,
          status: options.serviceStatus ?? "TODO",
        },
      },
    },
    include: { services: true },
  });
}
