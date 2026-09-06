import { prisma } from "@/server/db/prisma";

export const clientRepository = {
  findById(params: { salonId: string; clientId: string }) {
    return prisma.client.findFirst({
      where: {
        id: params.clientId,
        salonId: params.salonId,
      },
    });
  },

  findByPhone(params: { salonId: string; phone: string }) {
    return prisma.client.findFirst({
      where: {
        salonId: params.salonId,
        phone: params.phone,
      },
    });
  },

  list(params: { salonId: string }) {
    return prisma.client.findMany({
      where: {
        salonId: params.salonId,
        isActive: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  },

  create(params: {
    salonId: string;
    name?: string | null;
    phone: string;
    internalNote?: string | null;
  }) {
    return prisma.client.create({
      data: {
        salonId: params.salonId,
        name: params.name ?? null,
        phone: params.phone,
        internalNote: params.internalNote ?? null,
      },
    });
  },

  update(params: {
    salonId: string;
    clientId: string;
    name?: string | null;
    phone?: string;
    internalNote?: string | null;
  }) {
    const { salonId, clientId, ...data } = params;

    return prisma.client.updateMany({
      where: {
        id: clientId,
        salonId,
      },
      data,
    });
  },

  deactivate(params: { salonId: string; clientId: string }) {
    return prisma.client.updateMany({
      where: {
        id: params.clientId,
        salonId: params.salonId,
      },
      data: {
        isActive: false,
      },
    });
  },
};
