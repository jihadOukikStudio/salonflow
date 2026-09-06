import type { Prisma } from "@/app/generated/prisma/client";
import { BusinessRuleError } from "@/server/services/errors";

/**
 * SalonFlow conserve le mode historique tant qu'aucune compétence n'a encore
 * été configurée dans le salon. Dès la première compétence enregistrée, le
 * contrôle devient strict pour TOUTES les prestations : une prestation sans
 * employée compétente devient donc volontairement indisponible.
 *
 * Cela permet une migration sans casse, puis garantit qu'un catalogue
 * partiellement configuré ne recrée pas du surbooking silencieux.
 */
export async function assertEmployeeCanPerformServiceInDb(
  db: Prisma.TransactionClient,
  input: {
    salonId: string;
    employeeId: string;
    serviceId: string | null;
    serviceName: string;
  },
) {
  if (!input.serviceId) return;

  const anyConfiguredSkill = await db.employeeSkill.findFirst({
    where: {
      employee: { salonId: input.salonId },
    },
    select: { employeeId: true },
  });

  if (!anyConfiguredSkill) return;

  const skill = await db.employeeSkill.findUnique({
    where: {
      employeeId_serviceId: {
        employeeId: input.employeeId,
        serviceId: input.serviceId,
      },
    },
    select: { employeeId: true },
  });

  if (!skill) {
    throw new BusinessRuleError(
      `Cette employée n’est pas habilitée à réaliser « ${input.serviceName} ».`,
    );
  }
}
