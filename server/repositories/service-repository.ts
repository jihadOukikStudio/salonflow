import type { RoomType } from "@/app/generated/prisma/client";
import { prisma } from "@/server/db/prisma";

type CreateServiceParams = {
  salonId: string;
  categoryId: string;
  name: string;
  defaultDurationMinutes?: number | null;
  defaultPrice: number;
  isStartingPrice?: boolean;
  requiredRoomType?: RoomType | null;
};

type UpdateServiceParams = {
  salonId: string;
  serviceId: string;
  categoryId?: string;
  name?: string;
  defaultDurationMinutes?: number | null;
  defaultPrice?: number;
  isStartingPrice?: boolean;
  requiredRoomType?: RoomType | null;
};

export const serviceRepository = {
  findById(params: { salonId: string; serviceId: string }) {
    return prisma.service.findFirst({
      where: {
        id: params.serviceId,
        salonId: params.salonId,
      },
      include: {
        category: true,
      },
    });
  },

  list(params: { salonId: string; includeInactive?: boolean }) {
    return prisma.service.findMany({
      where: {
        salonId: params.salonId,
        ...(params.includeInactive ? {} : { isActive: true }),
      },
      include: {
        category: true,
      },
      orderBy: [
        {
          category: {
            displayOrder: "asc",
          },
        },
        {
          name: "asc",
        },
      ],
    });
  },

  findByName(params: { salonId: string; categoryId: string; name: string }) {
    return prisma.service.findFirst({
      where: {
        salonId: params.salonId,
        categoryId: params.categoryId,
        name: params.name,
      },
    });
  },

  create(params: CreateServiceParams) {
    return prisma.service.create({
      data: {
        salonId: params.salonId,
        categoryId: params.categoryId,
        name: params.name,
        defaultDurationMinutes: params.defaultDurationMinutes ?? null,
        defaultPrice: params.defaultPrice,
        isStartingPrice: params.isStartingPrice ?? false,
        requiredRoomType: params.requiredRoomType ?? null,
        isActive: true,
      },
    });
  },

  update(params: UpdateServiceParams) {
    const {
      salonId,
      serviceId,
      categoryId,
      name,
      defaultDurationMinutes,
      defaultPrice,
      isStartingPrice,
      requiredRoomType,
    } = params;

    return prisma.service.updateMany({
      where: {
        id: serviceId,
        salonId,
      },
      data: {
        ...(categoryId !== undefined && { categoryId }),
        ...(name !== undefined && { name }),
        ...(defaultDurationMinutes !== undefined && {
          defaultDurationMinutes,
        }),
        ...(defaultPrice !== undefined && { defaultPrice }),
        ...(isStartingPrice !== undefined && { isStartingPrice }),
        ...(requiredRoomType !== undefined && { requiredRoomType }),
      },
    });
  },

  deactivate(params: { salonId: string; serviceId: string }) {
    return prisma.service.updateMany({
      where: {
        id: params.serviceId,
        salonId: params.salonId,
      },
      data: {
        isActive: false,
      },
    });
  },

  reactivate(params: { salonId: string; serviceId: string }) {
    return prisma.service.updateMany({
      where: {
        id: params.serviceId,
        salonId: params.salonId,
      },
      data: {
        isActive: true,
      },
    });
  },
};
