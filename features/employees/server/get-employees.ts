import type { CurrentUser } from "@/server/permissions";
import { PermissionDeniedError } from "@/server/permissions/errors";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { prisma } from "@/server/db/prisma";

export async function getEmployees(currentUser: CurrentUser) {
  const user = await getAuthoritativeCurrentUser(currentUser);
  if (user.role !== "ADMIN") {
    throw new PermissionDeniedError("Seule la gérante peut gérer l'équipe.");
  }

  const employees = await prisma.employee.findMany({
    where: { salonId: user.salonId },
    orderBy: [{ isActive: "desc" }, { firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      isActive: true,
      user: {
        select: { id: true, email: true, canManageSalon: true, isActive: true },
      },
    },
  });

  return employees;
}
