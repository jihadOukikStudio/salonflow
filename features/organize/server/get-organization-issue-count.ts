import { prisma } from "@/server/db/prisma";

const ORGANIZATION_HORIZON_DAYS = 14;

export async function getOrganizationIssueCount(salonId: string) {
  const now = new Date();
  const horizon = new Date(
    now.getTime() + ORGANIZATION_HORIZON_DAYS * 24 * 60 * 60 * 1000,
  );

  const appointmentScope = {
    salonId,
    status: { in: ["PLANNED", "IN_PROGRESS"] as const },
    scheduledStart: { lte: horizon },
  };

  const [missingEmployeeCount, missingRoomCount] = await Promise.all([
    prisma.appointmentService.count({
      where: {
        appointment: appointmentScope,
        assignedEmployeeId: null,
      },
    }),
    prisma.appointmentService.count({
      where: {
        appointment: appointmentScope,
        requiredRoomTypeSnapshot: { not: null },
        roomId: null,
      },
    }),
  ]);

  // Le badge représente des décisions à prendre.
  // Une prestation qui manque à la fois d'employée et de salle compte donc 2.
  return missingEmployeeCount + missingRoomCount;
}
