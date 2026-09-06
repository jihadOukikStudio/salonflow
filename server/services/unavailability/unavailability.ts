import type { CurrentUser } from "@/server/permissions";
import { PermissionDeniedError } from "@/server/permissions/errors";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { prisma } from "@/server/db/prisma";
import { lockResources } from "@/server/db/resource-lock";
import { employeeLockKey, roomLockKey } from "@/server/services/resources";
import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

function overlaps(startAt: Date, endAt: Date) {
  return { startAt: { lt: endAt }, endAt: { gt: startAt } };
}

export async function getEmployeeUnavailabilityPage(currentUser: CurrentUser) {
  const user = await getAuthoritativeCurrentUser(currentUser);
  const ownEmployee = await prisma.employee.findFirst({
    where: { salonId: user.salonId, userId: user.id },
    select: { id: true },
  });
  const employees = await prisma.employee.findMany({
    where: { salonId: user.salonId, isActive: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      userId: true,
      unavailabilities: {
        where: { endAt: { gte: new Date() } },
        orderBy: { startAt: "asc" },
        take: 30,
        select: {
          id: true,
          type: true,
          startAt: true,
          endAt: true,
          note: true,
          createdByUserId: true,
        },
      },
    },
  });
  return {
    employees,
    ownEmployeeId: ownEmployee?.id ?? null,
    canManage: user.role === "ADMIN" || user.canManageSalon,
  };
}

export async function createEmployeeUnavailability(
  currentUser: CurrentUser,
  input: {
    employeeId: string;
    type: "ABSENCE" | "BREAK" | "LEAVE" | "UNAVAILABLE";
    startAt: Date;
    endAt: Date;
    note?: string | null;
  },
) {
  const user = await getAuthoritativeCurrentUser(currentUser);
  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, salonId: user.salonId, isActive: true },
    select: { id: true, userId: true },
  });
  if (!employee) throw new ResourceNotFoundError("Employée introuvable.");
  const canManage = user.role === "ADMIN" || user.canManageSalon;
  if (!canManage && employee.userId !== user.id)
    throw new PermissionDeniedError(
      "Une employée standard ne peut saisir que ses propres indisponibilités.",
    );

  return prisma.$transaction(async (tx) => {
    await lockResources(tx, [employeeLockKey(user.salonId, employee.id)]);
    const existing = await tx.employeeUnavailability.findFirst({
      where: {
        employeeId: employee.id,
        ...overlaps(input.startAt, input.endAt),
      },
      select: { id: true },
    });
    if (existing)
      throw new BusinessRuleError(
        "Une indisponibilité existe déjà sur ce créneau.",
      );
    const appointments = await tx.appointment.findMany({
      where: {
        salonId: user.salonId,
        status: { notIn: ["CANCELLED", "CLOSED"] },
        scheduledStart: { lt: input.endAt },
        services: { some: { assignedEmployeeId: employee.id } },
      },
      select: { scheduledStart: true, estimatedDurationMinutes: true },
    });
    const appointmentConflict = appointments.some(
      (appointment) =>
        new Date(
          appointment.scheduledStart.getTime() +
            appointment.estimatedDurationMinutes * 60_000,
        ) > input.startAt,
    );
    if (appointmentConflict) {
      throw new BusinessRuleError(
        "Cette employée est déjà affectée à un rendez-vous sur cette période.",
      );
    }
    const created = await tx.employeeUnavailability.create({
      data: {
        employeeId: employee.id,
        type: input.type,
        startAt: input.startAt,
        endAt: input.endAt,
        note: input.note?.trim() || null,
        createdByUserId: user.id,
      },
    });
    await tx.activityLog.create({
      data: {
        salonId: user.salonId,
        userId: user.id,
        action: "EMPLOYEE_UNAVAILABILITY_CREATED",
        entityType: "EmployeeUnavailability",
        entityId: created.id,
        metadata: { employeeId: employee.id, type: input.type },
      },
    });
    return created;
  });
}

export async function deleteEmployeeUnavailability(
  currentUser: CurrentUser,
  id: string,
) {
  const user = await getAuthoritativeCurrentUser(currentUser);
  const existing = await prisma.employeeUnavailability.findFirst({
    where: { id, employee: { salonId: user.salonId } },
    select: {
      id: true,
      employeeId: true,
      employee: { select: { userId: true } },
    },
  });
  if (!existing)
    throw new ResourceNotFoundError("Indisponibilité introuvable.");
  if (
    user.role !== "ADMIN" &&
    !user.canManageSalon &&
    existing.employee.userId !== user.id
  )
    throw new PermissionDeniedError(
      "Vous ne pouvez pas supprimer cette indisponibilité.",
    );
  return prisma.$transaction(async (tx) => {
    await lockResources(tx, [
      employeeLockKey(user.salonId, existing.employeeId),
    ]);
    await tx.employeeUnavailability.delete({ where: { id: existing.id } });
    await tx.activityLog.create({
      data: {
        salonId: user.salonId,
        userId: user.id,
        action: "EMPLOYEE_UNAVAILABILITY_DELETED",
        entityType: "EmployeeUnavailability",
        entityId: existing.id,
      },
    });
    return { id: existing.id };
  });
}

export async function createRoomUnavailability(
  currentUser: CurrentUser,
  input: { roomId: string; startAt: Date; endAt: Date; reason?: string | null },
) {
  const user = await getAuthoritativeCurrentUser(currentUser);
  if (user.role !== "ADMIN" && !user.canManageSalon)
    throw new PermissionDeniedError(
      "Seule la gérante ou une responsable peut gérer les indisponibilités des salles.",
    );
  const room = await prisma.room.findFirst({
    where: { id: input.roomId, salonId: user.salonId, isActive: true },
    select: { id: true },
  });
  if (!room) throw new ResourceNotFoundError("Salle introuvable.");
  return prisma.$transaction(async (tx) => {
    await lockResources(tx, [roomLockKey(user.salonId, room.id)]);
    const existing = await tx.roomUnavailability.findFirst({
      where: { roomId: room.id, ...overlaps(input.startAt, input.endAt) },
      select: { id: true },
    });
    if (existing)
      throw new BusinessRuleError(
        "Cette salle est déjà indisponible sur ce créneau.",
      );
    const appointments = await tx.appointment.findMany({
      where: {
        salonId: user.salonId,
        status: { notIn: ["CANCELLED", "CLOSED"] },
        scheduledStart: { lt: input.endAt },
        services: { some: { roomId: room.id } },
      },
      select: { scheduledStart: true, estimatedDurationMinutes: true },
    });
    const appointmentConflict = appointments.some(
      (appointment) =>
        new Date(
          appointment.scheduledStart.getTime() +
            appointment.estimatedDurationMinutes * 60_000,
        ) > input.startAt,
    );
    if (appointmentConflict) {
      throw new BusinessRuleError(
        "Cette salle est déjà utilisée par un rendez-vous sur cette période.",
      );
    }
    const created = await tx.roomUnavailability.create({
      data: {
        roomId: room.id,
        startAt: input.startAt,
        endAt: input.endAt,
        reason: input.reason?.trim() || null,
        createdByUserId: user.id,
      },
    });
    await tx.activityLog.create({
      data: {
        salonId: user.salonId,
        userId: user.id,
        action: "ROOM_UNAVAILABILITY_CREATED",
        entityType: "RoomUnavailability",
        entityId: created.id,
        metadata: { roomId: room.id },
      },
    });
    return created;
  });
}

export async function deleteRoomUnavailability(
  currentUser: CurrentUser,
  id: string,
) {
  const user = await getAuthoritativeCurrentUser(currentUser);
  if (user.role !== "ADMIN" && !user.canManageSalon)
    throw new PermissionDeniedError(
      "Seule la gérante ou une responsable peut gérer les indisponibilités des salles.",
    );
  const existing = await prisma.roomUnavailability.findFirst({
    where: { id, room: { salonId: user.salonId } },
    select: { id: true, roomId: true },
  });
  if (!existing)
    throw new ResourceNotFoundError("Indisponibilité introuvable.");
  return prisma.$transaction(async (tx) => {
    await lockResources(tx, [roomLockKey(user.salonId, existing.roomId)]);
    await tx.roomUnavailability.delete({ where: { id: existing.id } });
    await tx.activityLog.create({
      data: {
        salonId: user.salonId,
        userId: user.id,
        action: "ROOM_UNAVAILABILITY_DELETED",
        entityType: "RoomUnavailability",
        entityId: existing.id,
      },
    });
    return { id: existing.id };
  });
}
