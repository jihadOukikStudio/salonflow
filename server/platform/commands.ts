import { hash } from "bcryptjs";
import { prisma } from "@/server/db/prisma";
import { requirePlatformAdmin } from "./auth";
import { platformCommandSchema } from "./schemas";
import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";
import type { Prisma } from "@/app/generated/prisma/client";

export async function executePlatformCommand(raw: unknown) {
  await requirePlatformAdmin();
  const input = platformCommandSchema.parse(raw);
  // Hash outside the transaction; the role is checked again immediately before mutation.
  const passwordHash =
    input.kind === "createManager" ? await hash(input.password, 12) : null;
  return prisma.$transaction(
    async (tx) => {
      const actor = await requirePlatformAdmin(tx);
      const audit = async (
        salonId: string | null,
        action: string,
        entityId: string,
        details: Prisma.InputJsonObject,
      ) => {
        await tx.platformAuditLog.create({
          data: { actorId: actor.id, salonId, action, entityId, details },
        });
      };
      const salonId = "salonId" in input ? input.salonId : null;
      const salon = salonId
        ? await tx.salon.findUnique({ where: { id: salonId } })
        : null;
      if (salonId && !salon)
        throw new ResourceNotFoundError("Salon introuvable.");
      switch (input.kind) {
        case "createDue": {
          const due = await tx.subscriptionDue.create({
            data: {
              salonId: input.salonId,
              title: input.title,
              dueAt: input.dueAt,
              amount: input.amount,
              currency: input.currency,
              note: input.note,
            },
          });
          await audit(input.salonId, "DUE_CREATED", due.id, {
            title: input.title,
            dueAt: input.dueAt.toISOString(),
            amount: input.amount,
            currency: input.currency,
          });
          break;
        }
        case "settleDue": {
          const due = await tx.subscriptionDue.findUnique({
            where: { id: input.dueId },
          });
          const payment = await tx.subscriptionPayment.findUnique({
            where: { id: input.paymentId },
            include: { due: true },
          });
          if (!due || due.cancelledAt || due.paymentId)
            throw new BusinessRuleError("Cette échéance n’est plus à régler.");
          if (
            !payment ||
            payment.voidedAt ||
            payment.due ||
            payment.salonId !== due.salonId ||
            payment.currency !== due.currency ||
            !payment.amount.equals(due.amount)
          )
            throw new BusinessRuleError(
              "Choisissez un paiement non annulé, non affecté, du même salon, du même montant et de la même devise.",
            );
          await tx.subscriptionDue.update({
            where: { id: due.id },
            data: { paymentId: payment.id, processedAt: new Date() },
          });
          await audit(due.salonId, "DUE_SETTLED", due.id, {
            title: due.title,
            amount: due.amount.toString(),
            currency: due.currency,
            paidAt: payment.paidAt.toISOString(),
          });
          break;
        }
        case "cancelDue": {
          const due = await tx.subscriptionDue.findUnique({
            where: { id: input.dueId },
          });
          if (!due || due.paymentId || due.cancelledAt)
            throw new BusinessRuleError(
              "Seule une échéance non réglée peut être annulée.",
            );
          await tx.subscriptionDue.update({
            where: { id: due.id },
            data: { cancelledAt: new Date(), note: input.reason },
          });
          await audit(due.salonId, "DUE_CANCELLED", due.id, {
            title: due.title,
            reason: input.reason,
          });
          break;
        }
        case "createSalon": {
          const created = await tx.salon.create({
            data: {
              name: input.name,
              phone: input.phone,
              address: input.address,
              isActive: false,
              lifecycle: "PREPARING",
              subscription: { create: { planName: "Pilote", status: "TRIAL" } },
            },
          });
          await audit(created.id, "SALON_CREATED", created.id, {
            name: created.name,
          });
          return { salonId: created.id };
        }
        case "salonDetails": {
          await tx.salon.update({
            where: { id: input.salonId },
            data: {
              name: input.name,
              phone: input.phone,
              address: input.address,
              timezone: input.timezone,
              currency: input.currency,
            },
          });
          await audit(input.salonId, "SALON_DETAILS_UPDATED", input.salonId, {
            name: input.name,
            timezone: input.timezone,
            currency: input.currency,
          });
          break;
        }
        case "recordPayment": {
          const payment = await tx.subscriptionPayment.create({
            data: {
              salonId: input.salonId,
              amount: input.amount,
              currency: input.currency,
              paidAt: input.paidAt,
              periodStart: input.periodStart,
              periodEnd: input.periodEnd,
              method: input.method,
              reference: input.reference,
              recordedById: actor.id,
            },
          });
          await audit(
            input.salonId,
            "SUBSCRIPTION_PAYMENT_RECORDED",
            payment.id,
            {
              amount: input.amount,
              currency: input.currency,
              periodStart: input.periodStart.toISOString(),
              periodEnd: input.periodEnd.toISOString(),
            },
          );
          break;
        }
        case "voidPayment": {
          const payment = await tx.subscriptionPayment.findUnique({
            where: { id: input.paymentId },
          });
          if (!payment || payment.voidedAt)
            throw new BusinessRuleError("Paiement absent ou déjà annulé.");
          const due = await tx.subscriptionDue.findUnique({
            where: { paymentId: payment.id },
          });
          if (due) {
            await tx.subscriptionDue.update({
              where: { id: due.id },
              data: { paymentId: null, processedAt: null },
            });
            await audit(due.salonId, "DUE_REOPENED", due.id, {
              title: due.title,
              reason: input.reason,
            });
          }
          await tx.subscriptionPayment.update({
            where: { id: payment.id },
            data: { voidedAt: new Date(), voidReason: input.reason },
          });
          await audit(
            payment.salonId,
            "SUBSCRIPTION_PAYMENT_VOIDED",
            payment.id,
            { reason: input.reason },
          );
          break;
        }
        case "incidentMessage": {
          const incident = await tx.platformIncident.findUnique({
            where: { id: input.incidentId },
          });
          if (!incident)
            throw new ResourceNotFoundError("Incident introuvable.");
          const message = await tx.platformIncidentMessage.create({
            data: {
              incidentId: incident.id,
              authorId: actor.id,
              internal: input.internal,
              body: input.body,
            },
          });
          await audit(incident.salonId, "INCIDENT_MESSAGE_ADDED", message.id, {
            incidentId: incident.id,
            internal: input.internal,
          });
          break;
        }
        case "revokeSessions": {
          const target = await tx.user.findUnique({
            where: { id: input.userId },
            select: { id: true, salonId: true, role: true },
          });
          if (
            !target ||
            (target.role === "SUPER_ADMIN" && target.id !== actor.id)
          )
            throw new BusinessRuleError("Compte non autorisé.");
          await tx.user.update({
            where: { id: target.id },
            data: { authVersion: { increment: 1 } },
          });
          await audit(target.salonId, "SESSIONS_REVOKED", target.id, {
            reason: input.reason,
          });
          break;
        }
        case "salonStatus": {
          if (input.confirmation !== salon!.name)
            throw new BusinessRuleError(
              "Recopiez exactement le nom du salon pour confirmer.",
            );
          if (
            input.lifecycle === "ACTIVE" &&
            (await tx.user.count({
              where: { salonId: input.salonId, role: "ADMIN", isActive: true },
            })) === 0
          )
            throw new BusinessRuleError(
              "Créez au moins une gérante active avant d’ouvrir le salon.",
            );
          const isActive = input.lifecycle === "ACTIVE";
          await tx.salon.update({
            where: { id: input.salonId },
            data: { isActive, lifecycle: input.lifecycle },
          });
          if (!isActive)
            await tx.user.updateMany({
              where: { salonId: input.salonId },
              data: { authVersion: { increment: 1 } },
            });
          await audit(input.salonId, "SALON_STATUS_UPDATED", input.salonId, {
            previous: salon!.lifecycle,
            lifecycle: input.lifecycle,
            reason: input.reason,
          });
          break;
        }
        case "subscription": {
          const previous = await tx.salonSubscription.findUnique({
            where: { salonId: input.salonId },
          });
          const data = {
            planName: input.planName,
            status: input.status,
            monthlyPrice: input.monthlyPrice,
            currency: input.currency,
            periodEnd: input.periodEnd,
            note: input.note,
          };
          const saved = await tx.salonSubscription.upsert({
            where: { salonId: input.salonId },
            create: { salonId: input.salonId, ...data },
            update: data,
          });
          await audit(input.salonId, "SUBSCRIPTION_UPDATED", saved.id, {
            previousStatus: previous?.status ?? null,
            ...data,
            periodEnd: data.periodEnd?.toISOString() ?? null,
          });
          break;
        }
        case "createIncident": {
          const incident = await tx.platformIncident.create({
            data: {
              salonId: input.salonId,
              title: input.title,
              description: input.description,
              priority: input.priority,
            },
          });
          await audit(input.salonId, "INCIDENT_CREATED", incident.id, {
            title: input.title,
            priority: input.priority,
          });
          break;
        }
        case "incidentStatus": {
          const incident = await tx.platformIncident.findUnique({
            where: { id: input.incidentId },
          });
          if (!incident)
            throw new ResourceNotFoundError("Incident introuvable.");
          await tx.platformIncident.update({
            where: { id: incident.id },
            data: {
              status: input.status,
              resolution: input.resolution,
              resolvedAt:
                input.status === "RESOLVED"
                  ? (incident.resolvedAt ?? new Date())
                  : null,
            },
          });
          await audit(incident.salonId, "INCIDENT_UPDATED", incident.id, {
            previousStatus: incident.status,
            status: input.status,
            resolution: input.resolution,
          });
          break;
        }
        case "createManager": {
          if (!salon!.isActive && salon!.lifecycle !== "PREPARING")
            throw new BusinessRuleError(
              "Réactivez le salon ou remettez-le en préparation.",
            );
          const duplicate = await tx.user.findFirst({
            where: { email: { equals: input.email, mode: "insensitive" } },
            select: { id: true },
          });
          if (duplicate)
            throw new BusinessRuleError(
              "Cet email est déjà utilisé par un compte de la plateforme.",
            );
          const user = await tx.user.create({
            data: {
              salonId: input.salonId,
              firstName: input.firstName,
              lastName: input.lastName,
              email: input.email,
              passwordHash: passwordHash!,
              role: "ADMIN",
              canManageSalon: true,
              isActive: true,
            },
            select: { id: true },
          });
          await audit(input.salonId, "SALON_ADMIN_CREATED", user.id, {
            email: input.email,
          });
          break;
        }
        case "managerStatus": {
          const manager = await tx.user.findFirst({
            where: { id: input.userId, salonId: input.salonId, role: "ADMIN" },
            select: { id: true, isActive: true },
          });
          if (!manager)
            throw new ResourceNotFoundError(
              "Gérante introuvable dans ce salon.",
            );
          if (
            !input.isActive &&
            manager.isActive &&
            (await tx.user.count({
              where: { salonId: input.salonId, role: "ADMIN", isActive: true },
            })) <= 1
          ) {
            throw new BusinessRuleError(
              "Conservez au moins une gérante active. Pour bloquer tout le salon, suspendez-le.",
            );
          }
          await tx.user.update({
            where: { id: manager.id },
            data: { isActive: input.isActive, authVersion: { increment: 1 } },
          });
          await audit(input.salonId, "SALON_ADMIN_ACCESS_UPDATED", manager.id, {
            isActive: input.isActive,
            reason: input.reason,
          });
        }
      }
      return { salonId };
    },
    { isolationLevel: "Serializable" },
  );
}
