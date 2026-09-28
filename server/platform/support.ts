import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { isSessionCurrent } from "@/server/auth/session-version";
import { PermissionDeniedError } from "@/server/permissions/errors";
import { ResourceNotFoundError } from "@/server/services/errors";

async function requireSalonAdmin(db: Prisma.TransactionClient = prisma) {
  const session = await auth();
  if (!session?.user?.id) throw new PermissionDeniedError();
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      salonId: true,
      role: true,
      isActive: true,
      authVersion: true,
      salon: { select: { isActive: true } },
    },
  });
  if (
    !user ||
    !user.isActive ||
    user.role !== "ADMIN" ||
    !user.salonId ||
    !user.salon?.isActive ||
    !isSessionCurrent(user.authVersion, session.user.authVersion)
  )
    throw new PermissionDeniedError();
  return { ...user, salonId: user.salonId };
}
export async function getSalonSupport() {
  const user = await requireSalonAdmin();
  return prisma.platformIncident.findMany({
    where: { salonId: user.salonId, reportedById: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      messages: {
        where: { internal: false },
        orderBy: { createdAt: "asc" },
        take: 100,
      },
    },
  });
}
export const supportSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("supportCreate"),
    title: z.string().trim().min(1).max(150),
    description: z.string().trim().min(1).max(3000),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]),
  }),
  z.object({
    kind: z.literal("supportReply"),
    incidentId: z.uuid(),
    body: z.string().trim().min(1).max(3000),
  }),
]);
export async function executeSupportCommand(raw: unknown) {
  await requireSalonAdmin();
  const input = supportSchema.parse(raw);
  await prisma.$transaction(
    async (tx) => {
      const user = await requireSalonAdmin(tx);
      if (input.kind === "supportCreate") {
        const incident = await tx.platformIncident.create({
          data: {
            salonId: user.salonId,
            reportedById: user.id,
            title: input.title,
            description: input.description,
            priority: input.priority,
          },
        });
        await tx.platformAuditLog.create({
          data: {
            actorId: user.id,
            salonId: user.salonId,
            action: "SUPPORT_REQUEST_CREATED",
            entityId: incident.id,
            details: { title: input.title },
          },
        });
      } else {
        const incident = await tx.platformIncident.findFirst({
          where: {
            id: input.incidentId,
            salonId: user.salonId,
            reportedById: { not: null },
          },
          select: { id: true },
        });
        if (!incident) throw new ResourceNotFoundError("Demande introuvable.");
        await tx.platformIncidentMessage.create({
          data: {
            incidentId: incident.id,
            authorId: user.id,
            internal: false,
            body: input.body,
          },
        });
        await tx.platformAuditLog.create({
          data: {
            actorId: user.id,
            salonId: user.salonId,
            action: "SUPPORT_REPLY_CREATED",
            entityId: incident.id,
            details: {},
          },
        });
      }
    },
    { isolationLevel: "Serializable" },
  );
}
