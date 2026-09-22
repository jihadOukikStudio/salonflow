import type { Prisma } from "@/app/generated/prisma/client";
import type { CurrentUser } from "@/server/permissions";
import { requirePermission } from "@/server/permissions";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { prisma } from "@/server/db/prisma";
import { lockResources } from "@/server/db/resource-lock";
import { employeeLockKey, roomLockKey } from "@/server/services/resources/resource-lock-keys";
import { validateEmployeeAvailability } from "@/server/services/resources/validate-employee-availability";
import { validateRoomAvailability } from "@/server/services/resources/validate-room-availability";
import { assertEmployeeCanPerformServiceInDb } from "@/server/services/employees/skill-policy";
import { BusinessRuleError, ResourceNotFoundError } from "@/server/services/errors";

export type PlannedClientChoice =
  | { type: "existing"; clientId: string; clientNote?: string | null }
  | { type: "new"; name: string; phone: string; clientNote?: string | null };

export type PlannedServiceInput = {
  serviceId: string;
  scheduledStart: Date;
  employeeId: string;
  roomId?: string | null;
  durationMinutes?: number;
  price?: number;
};

export type CreatePlannedAppointmentInput = {
  client: PlannedClientChoice;
  internalNote?: string | null;
  services: PlannedServiceInput[];
};

function overlaps(aStart: Date, aDuration: number, bStart: Date, bDuration: number) {
  const aEnd = new Date(aStart.getTime() + aDuration * 60_000);
  const bEnd = new Date(bStart.getTime() + bDuration * 60_000);
  return aStart < bEnd && aEnd > bStart;
}

export async function createPlannedAppointment(
  currentUser: CurrentUser,
  input: CreatePlannedAppointmentInput,
) {
  const user = await getAuthoritativeCurrentUser(currentUser);
  requirePermission(user, "appointments:create");
  requirePermission(user, "appointments:assign");
  const salonId = user.salonId;

  if (input.services.length === 0) {
    throw new BusinessRuleError("Ajoutez au moins une prestation au rendez-vous.");
  }

  return prisma.$transaction(async (tx) => {
    const serviceIds = [...new Set(input.services.map((item) => item.serviceId))];
    const catalog = await tx.service.findMany({
      where: { salonId, id: { in: serviceIds }, isActive: true },
    });
    if (catalog.length !== serviceIds.length) {
      throw new ResourceNotFoundError("Une ou plusieurs prestations sont introuvables.");
    }
    const byId = new Map(catalog.map((service) => [service.id, service]));

    const prepared = input.services.map((item) => {
      const service = byId.get(item.serviceId);
      if (!service) throw new ResourceNotFoundError("Prestation introuvable.");
      const durationMinutes = item.durationMinutes ?? service.defaultDurationMinutes;
      if (!durationMinutes || !Number.isInteger(durationMinutes) || durationMinutes <= 0) {
        throw new BusinessRuleError(`La durée de « ${service.name} » doit être configurée.`);
      }
      if (Number.isNaN(item.scheduledStart.getTime()) || item.scheduledStart <= new Date()) {
        throw new BusinessRuleError(`Le créneau de « ${service.name} » doit être dans le futur.`);
      }
      const price = item.price ?? service.defaultPrice.toNumber();
      return { item, service, durationMinutes, price };
    });

    // Les choix déjà faits dans le brouillon comptent comme occupés.
    for (let i = 0; i < prepared.length; i += 1) {
      for (let j = i + 1; j < prepared.length; j += 1) {
        const a = prepared[i];
        const b = prepared[j];
        if (!overlaps(a.item.scheduledStart, a.durationMinutes, b.item.scheduledStart, b.durationMinutes)) continue;
        if (a.item.employeeId === b.item.employeeId) {
          throw new BusinessRuleError("Une même employée ne peut pas réaliser deux prestations qui se chevauchent.");
        }
        if (a.item.roomId && a.item.roomId === b.item.roomId) {
          throw new BusinessRuleError("Une même salle ne peut pas être utilisée par deux prestations qui se chevauchent.");
        }
      }
    }

    const lockKeys = prepared.flatMap(({ item }) => [
      employeeLockKey(salonId, item.employeeId),
      ...(item.roomId ? [roomLockKey(salonId, item.roomId)] : []),
    ]);
    await lockResources(tx, lockKeys);

    // Recontrôle final dans la transaction : compétence, employée, salle, concurrence.
    for (const { item, service, durationMinutes } of prepared) {
      await assertEmployeeCanPerformServiceInDb(tx, {
        salonId,
        employeeId: item.employeeId,
        serviceId: service.id,
        serviceName: service.name,
      });
      await validateEmployeeAvailability(tx, {
        salonId,
        employeeId: item.employeeId,
        scheduledStart: item.scheduledStart,
        estimatedDurationMinutes: durationMinutes,
      });

      if (service.requiredRoomType && !item.roomId) {
        throw new BusinessRuleError(`Affectez une salle à « ${service.name} » avant de confirmer.`);
      }
      if (item.roomId) {
        await validateRoomAvailability(tx, {
          salonId,
          roomId: item.roomId,
          scheduledStart: item.scheduledStart,
          estimatedDurationMinutes: durationMinutes,
          requiredRoomType: service.requiredRoomType,
        });
      }
    }

    let clientId: string;
    if (input.client.type === "existing") {
      const client = await tx.client.findFirst({ where: { id: input.client.clientId, salonId, isActive: true } });
      if (!client) throw new ResourceNotFoundError("Cliente introuvable.");
      clientId = client.id;
      if (input.client.clientNote !== undefined) {
        await tx.client.update({
          where: { id: client.id },
          data: { internalNote: input.client.clientNote?.trim() || null },
        });
      }
    } else {
      const client = await tx.client.upsert({
        where: { salonId_phone: { salonId, phone: input.client.phone } },
        update: input.client.clientNote !== undefined
          ? { internalNote: input.client.clientNote?.trim() || null }
          : {},
        create: {
          salonId,
          name: input.client.name,
          phone: input.client.phone,
          internalNote: input.client.clientNote?.trim() || null,
          isActive: true,
        },
      });
      clientId = client.id;
    }

    const starts = prepared.map(({ item }) => item.scheduledStart.getTime());
    const ends = prepared.map(({ item, durationMinutes }) => item.scheduledStart.getTime() + durationMinutes * 60_000);
    const scheduledStart = new Date(Math.min(...starts));
    const estimatedDurationMinutes = Math.ceil((Math.max(...ends) - scheduledStart.getTime()) / 60_000);

    const appointment = await tx.appointment.create({
      data: {
        salonId,
        clientId,
        scheduledStart,
        estimatedDurationMinutes,
        internalNote: input.internalNote ?? null,
        createdByUserId: user.id,
        services: {
          create: prepared.map(({ item, service, durationMinutes, price }) => ({
            serviceId: service.id,
            serviceNameSnapshot: service.name,
            durationMinutes,
            scheduledStart: item.scheduledStart,
            price,
            requiredRoomTypeSnapshot: service.requiredRoomType,
            assignedEmployeeId: item.employeeId,
            roomId: item.roomId ?? null,
          })),
        },
      },
      include: { client: true, services: true },
    });

    await tx.activityLog.create({
      data: {
        salonId,
        userId: user.id,
        action: "APPOINTMENT_CREATED",
        entityType: "Appointment",
        entityId: appointment.id,
        metadata: { source: "PLANNING_DRAFT", serviceCount: prepared.length },
      },
    });
    return appointment;
  }, { isolationLevel: "Serializable" as Prisma.TransactionIsolationLevel });
}
