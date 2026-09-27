import { prisma } from "@/server/db/prisma";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { requirePermission, type CurrentUser } from "@/server/permissions";

export async function getTeamOverview(currentUser: CurrentUser) {
  const user = await getAuthoritativeCurrentUser(currentUser);
  requirePermission(user, "employees:view");

  return prisma.employee.findMany({
    where: { salonId: user.salonId },
    orderBy: [{ isActive: "desc" }, { firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      isActive: true,
    },
  });
}
