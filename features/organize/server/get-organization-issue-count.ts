import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/server/db/prisma";

const ORGANIZATION_HORIZON_DAYS = 14;

export async function getOrganizationIssueCount(salonId: string) {
  const now = new Date();
  const horizon = new Date(
    now.getTime() + ORGANIZATION_HORIZON_DAYS * 24 * 60 * 60 * 1000,
  );

  const appointmentScope: Prisma.AppointmentWhereInput = {
    salonId,
    status: { in: ["PLANNED", "IN_PROGRESS"] },
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

  return missingEmployeeCount + missingRoomCount;
}
