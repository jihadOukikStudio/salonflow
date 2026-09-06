import type { CurrentUser } from "@/server/permissions";
import { PermissionDeniedError } from "@/server/permissions/errors";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { prisma } from "@/server/db/prisma";
import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

async function requireAdmin(currentUser: CurrentUser) {
  const user = await getAuthoritativeCurrentUser(currentUser);
  if (user.role !== "ADMIN")
    throw new PermissionDeniedError(
      "Seule la gérante peut modifier les salles.",
    );
  return user;
}

export async function getRooms(currentUser: CurrentUser) {
  const user = await getAuthoritativeCurrentUser(currentUser);
  return prisma.room.findMany({
    where: { salonId: user.salonId },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      capacity: true,
      isActive: true,
      unavailabilities: {
        where: { endAt: { gte: new Date() } },
        orderBy: { startAt: "asc" },
        take: 20,
        select: { id: true, startAt: true, endAt: true, reason: true },
      },
    },
  });
}

export async function createRoom(
  currentUser: CurrentUser,
  input: { name: string; type: "HAMAM" | "TREATMENT_ROOM"; capacity: number },
) {
  const user = await requireAdmin(currentUser);
  return prisma.$transaction(async (tx) => {
    const duplicate = await tx.room.findUnique({
      where: {
        salonId_name: { salonId: user.salonId, name: input.name.trim() },
      },
      select: { id: true },
    });
    if (duplicate) throw new BusinessRuleError("Une salle porte déjà ce nom.");
    const room = await tx.room.create({
      data: {
        salonId: user.salonId,
        name: input.name.trim(),
        type: input.type,
        capacity: input.capacity,
        isActive: true,
      },
    });
    await tx.activityLog.create({
      data: {
        salonId: user.salonId,
        userId: user.id,
        action: "ROOM_CREATED",
        entityType: "Room",
        entityId: room.id,
      },
    });
    return room;
  });
}

export async function updateRoom(
  currentUser: CurrentUser,
  input: { roomId: string; name: string; capacity: number; isActive: boolean },
) {
  const user = await requireAdmin(currentUser);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.room.findFirst({
      where: { id: input.roomId, salonId: user.salonId },
      select: { id: true },
    });
    if (!existing) throw new ResourceNotFoundError("Salle introuvable.");
    const duplicate = await tx.room.findFirst({
      where: {
        salonId: user.salonId,
        name: input.name.trim(),
        id: { not: existing.id },
      },
      select: { id: true },
    });
    if (duplicate)
      throw new BusinessRuleError("Une autre salle porte déjà ce nom.");
    if (!input.isActive) {
      const futureUse = await tx.appointmentService.findFirst({
        where: {
          roomId: existing.id,
          appointment: {
            scheduledStart: { gte: new Date() },
            status: { notIn: ["CANCELLED", "CLOSED"] },
          },
        },
        select: { id: true },
      });
      if (futureUse)
        throw new BusinessRuleError(
          "Cette salle est encore affectée à un rendez-vous futur. Retirez l'affectation avant de la désactiver.",
        );
    }
    const room = await tx.room.update({
      where: { id: existing.id },
      data: {
        name: input.name.trim(),
        capacity: input.capacity,
        isActive: input.isActive,
      },
    });
    await tx.activityLog.create({
      data: {
        salonId: user.salonId,
        userId: user.id,
        action: "ROOM_UPDATED",
        entityType: "Room",
        entityId: room.id,
      },
    });
    return room;
  });
}
