import type { RoomType } from "@/app/generated/prisma/client";
import { prisma } from "@/server/db/prisma";

type CreateRoomParams = {
  salonId: string;
  name: string;
  type: RoomType;
  capacity?: number;
};

type UpdateRoomParams = {
  salonId: string;
  roomId: string;
  name?: string;
  type?: RoomType;
  capacity?: number;
};

export const roomRepository = {
  findById(params: { salonId: string; roomId: string }) {
    return prisma.room.findFirst({
      where: {
        id: params.roomId,
        salonId: params.salonId,
      },
    });
  },

  list(params: {
    salonId: string;
    type?: RoomType;
    includeInactive?: boolean;
  }) {
    return prisma.room.findMany({
      where: {
        salonId: params.salonId,
        ...(params.type ? { type: params.type } : {}),
        ...(params.includeInactive ? {} : { isActive: true }),
      },
      orderBy: {
        name: "asc",
      },
    });
  },

  create(params: CreateRoomParams) {
    return prisma.room.create({
      data: {
        salonId: params.salonId,
        name: params.name,
        type: params.type,
        capacity: params.capacity ?? 1,
        isActive: true,
      },
    });
  },

  update(params: UpdateRoomParams) {
    const { salonId, roomId, name, type, capacity } = params;

    return prisma.room.updateMany({
      where: {
        id: roomId,
        salonId,
      },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(capacity !== undefined && { capacity }),
      },
    });
  },

  deactivate(params: { salonId: string; roomId: string }) {
    return prisma.room.updateMany({
      where: {
        id: params.roomId,
        salonId: params.salonId,
      },
      data: {
        isActive: false,
      },
    });
  },

  reactivate(params: { salonId: string; roomId: string }) {
    return prisma.room.updateMany({
      where: {
        id: params.roomId,
        salonId: params.salonId,
      },
      data: {
        isActive: true,
      },
    });
  },
};
