import { prisma } from "@/server/db/prisma";

type CreateEmployeeParams = {
  salonId: string;
  userId?: string | null;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
};

type UpdateEmployeeParams = {
  salonId: string;
  employeeId: string;
  userId?: string | null;
  firstName?: string;
  lastName?: string | null;
  phone?: string | null;
};

export const employeeRepository = {
  findById(params: { salonId: string; employeeId: string }) {
    return prisma.employee.findFirst({
      where: {
        id: params.employeeId,
        salonId: params.salonId,
      },
      include: {
        user: true,
      },
    });
  },

  findByUserId(params: { salonId: string; userId: string }) {
    return prisma.employee.findFirst({
      where: {
        salonId: params.salonId,
        userId: params.userId,
      },
      include: {
        user: true,
      },
    });
  },

  list(params: { salonId: string; includeInactive?: boolean }) {
    return prisma.employee.findMany({
      where: {
        salonId: params.salonId,
        ...(params.includeInactive ? {} : { isActive: true }),
      },
      include: {
        user: true,
      },
      orderBy: [
        {
          firstName: "asc",
        },
        {
          lastName: "asc",
        },
      ],
    });
  },

  create(params: CreateEmployeeParams) {
    return prisma.employee.create({
      data: {
        salonId: params.salonId,
        userId: params.userId ?? null,
        firstName: params.firstName,
        lastName: params.lastName ?? null,
        phone: params.phone ?? null,
        isActive: true,
      },
    });
  },

  update(params: UpdateEmployeeParams) {
    const { salonId, employeeId, userId, firstName, lastName, phone } = params;

    return prisma.employee.updateMany({
      where: {
        id: employeeId,
        salonId,
      },
      data: {
        ...(userId !== undefined && { userId }),
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
      },
    });
  },

  deactivate(params: { salonId: string; employeeId: string }) {
    return prisma.employee.updateMany({
      where: {
        id: params.employeeId,
        salonId: params.salonId,
      },
      data: {
        isActive: false,
      },
    });
  },

  reactivate(params: { salonId: string; employeeId: string }) {
    return prisma.employee.updateMany({
      where: {
        id: params.employeeId,
        salonId: params.salonId,
      },
      data: {
        isActive: true,
      },
    });
  },
};
