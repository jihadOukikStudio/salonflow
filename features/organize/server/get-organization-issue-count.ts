import { prisma } from "@/server/db/prisma";

const ORGANIZATION_HORIZON_DAYS = 14;

export async function getOrganizationIssueCount(salonId: string) {
  const now = new Date();
  const horizon = new Date(
    now.getTime() + ORGANIZATION_HORIZON_DAYS * 24 * 60 * 60 * 1000,
  );

  return prisma.appointmentService.count({
    where: {
      appointment: {
        salonId,
        status: { in: ["PLANNED", "IN_PROGRESS"] },
        scheduledStart: { lte: horizon },
      },
      OR: [
        { assignedEmployeeId: null },
        {
          AND: [{ requiredRoomTypeSnapshot: { not: null } }, { roomId: null }],
        },
      ],
    },
  });
}
