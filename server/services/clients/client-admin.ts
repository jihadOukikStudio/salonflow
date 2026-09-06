import type { CurrentUser } from "@/server/permissions";
import { PermissionDeniedError } from "@/server/permissions/errors";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { prisma } from "@/server/db/prisma";
import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

async function requireClientManager(currentUser: CurrentUser) {
  const user = await getAuthoritativeCurrentUser(currentUser);
  if (user.role !== "ADMIN" && !user.canManageSalon) {
    throw new PermissionDeniedError(
      "Vous n'avez pas le droit de modifier les fiches clientes.",
    );
  }
  return user;
}

export async function getClients(currentUser: CurrentUser, query?: string) {
  const user = await getAuthoritativeCurrentUser(currentUser);
  const q = query?.trim();
  return prisma.client.findMany({
    where: {
      salonId: user.salonId,
      ...(q
        ? {
            OR: [
              { phone: { contains: q } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }, { phone: "asc" }],
    take: 100,
    select: {
      id: true,
      name: true,
      phone: true,
      internalNote: true,
      isActive: true,
      _count: { select: { appointments: true } },
      appointments: {
        orderBy: { scheduledStart: "desc" },
        take: 5,
        select: { id: true, scheduledStart: true, status: true },
      },
    },
  });
}

export async function updateClient(
  currentUser: CurrentUser,
  input: {
    clientId: string;
    name: string;
    phone: string;
    internalNote?: string | null;
  },
) {
  const user = await requireClientManager(currentUser);
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.findFirst({
      where: { id: input.clientId, salonId: user.salonId },
      select: { id: true, phone: true },
    });
    if (!client) throw new ResourceNotFoundError("Cliente introuvable.");

    const duplicate = await tx.client.findFirst({
      where: {
        salonId: user.salonId,
        phone: input.phone,
        id: { not: client.id },
      },
      select: { id: true },
    });
    if (duplicate)
      throw new BusinessRuleError(
        "Ce numéro appartient déjà à une autre cliente.",
      );

    const updated = await tx.client.update({
      where: { id: client.id },
      data: {
        name: input.name.trim(),
        phone: input.phone,
        internalNote: input.internalNote?.trim() || null,
      },
    });
    await tx.activityLog.create({
      data: {
        salonId: user.salonId,
        userId: user.id,
        action: "CLIENT_UPDATED",
        entityType: "Client",
        entityId: updated.id,
      },
    });
    return updated;
  });
}

export async function setClientActive(
  currentUser: CurrentUser,
  input: { clientId: string; isActive: boolean },
) {
  const user = await requireClientManager(currentUser);
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.findFirst({
      where: { id: input.clientId, salonId: user.salonId },
    });
    if (!client) throw new ResourceNotFoundError("Cliente introuvable.");
    const updated = await tx.client.update({
      where: { id: client.id },
      data: { isActive: input.isActive },
    });
    await tx.activityLog.create({
      data: {
        salonId: user.salonId,
        userId: user.id,
        action: input.isActive ? "CLIENT_REACTIVATED" : "CLIENT_DEACTIVATED",
        entityType: "Client",
        entityId: updated.id,
      },
    });
    return updated;
  });
}
