import type { CurrentUser } from "@/server/permissions";
import { PermissionDeniedError } from "@/server/permissions/errors";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { prisma } from "@/server/db/prisma";

export async function getEmployees(currentUser: CurrentUser) {
  const user = await getAuthoritativeCurrentUser(currentUser);
  if (user.role !== "ADMIN") {
    throw new PermissionDeniedError("Seule la gérante peut gérer l'équipe.");
  }

  const [employees, categories, services] = await Promise.all([
    prisma.employee.findMany({
      where: { salonId: user.salonId },
      orderBy: [
        { isActive: "desc" },
        { firstName: "asc" },
        { lastName: "asc" },
      ],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        skills: { select: { serviceId: true } },
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            canManageSalon: true,
            isActive: true,
          },
        },
      },
    }),
    prisma.serviceCategory.findMany({
      where: { salonId: user.salonId, isActive: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.service.findMany({
      where: { salonId: user.salonId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, categoryId: true, name: true },
    }),
  ]);

  return { employees, categories, services };
}
