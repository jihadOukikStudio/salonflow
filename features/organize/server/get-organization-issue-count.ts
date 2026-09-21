import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import {
  getCasablancaDayRange,
  parsePlanningDate,
} from "@/features/planning/server/casablanca-day";

export async function getOrganizationIssueCount(salonId: string) {
  const now = new Date();
  const today = parsePlanningDate(undefined, now);
  const { start: dayStart, end: dayEnd } = getCasablancaDayRange(today);

  const appointmentScope: Prisma.AppointmentWhereInput = {
    salonId,
    status: { in: ["PLANNED", "IN_PROGRESS"] },
    scheduledStart: { gte: dayStart, lt: dayEnd },
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
