import type { CurrentUser } from "@/server/permissions";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { prisma } from "@/server/db/prisma";
import { PermissionDeniedError } from "@/server/permissions/errors";

export async function getServiceCatalog(currentUser: CurrentUser) {
  const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);

  if (authoritativeUser.role !== "ADMIN") {
    throw new PermissionDeniedError(
      "Seule la gérante peut modifier les paramètres du catalogue.",
    );
  }

  const categories = await prisma.serviceCategory.findMany({
    where: {
      salonId: authoritativeUser.salonId,
      isActive: true,
    },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      services: {
        where: {
          salonId: authoritativeUser.salonId,
          isActive: true,
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          defaultDurationMinutes: true,
          defaultPrice: true,
          isStartingPrice: true,
          requiredRoomType: true,
        },
      },
    },
  });

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    services: category.services.map((service) => ({
      ...service,
      defaultPrice: Number(service.defaultPrice),
    })),
  }));
}
