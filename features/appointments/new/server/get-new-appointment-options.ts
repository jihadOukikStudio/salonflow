import { prisma } from "@/server/db/prisma";
import type { CurrentUser } from "@/server/permissions";
import { requirePermission } from "@/server/permissions";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";

import type { NewAppointmentOptions } from "@/features/appointments/new/types";

export async function getNewAppointmentOptions(
  currentUser: CurrentUser,
): Promise<NewAppointmentOptions> {
  const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);
  requirePermission(authoritativeUser, "appointments:create");

  const salonId = authoritativeUser.salonId;

  const [categories, services] = await Promise.all([
    prisma.serviceCategory.findMany({
      where: {
        salonId,
        isActive: true,
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
      },
    }),

    prisma.service.findMany({
      where: {
        salonId,
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        categoryId: true,
        name: true,
        defaultDurationMinutes: true,
        defaultPrice: true,
        isStartingPrice: true,
        requiredRoomType: true,
      },
    }),
  ]);

  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name]),
  );

  const categoryOrder = new Map(
    categories.map((category, index) => [category.id, index]),
  );

  return {
    services: services
      .map((service) => ({
        id: service.id,
        categoryId: service.categoryId,
        categoryName:
          categoryNames.get(service.categoryId) ?? "Autres prestations",
        name: service.name,
        defaultDurationMinutes: service.defaultDurationMinutes,
        defaultPrice: Number(service.defaultPrice),
        isStartingPrice: service.isStartingPrice,
        requiredRoomType: service.requiredRoomType,
      }))
      .sort((left, right) => {
        const categoryDifference =
          (categoryOrder.get(left.categoryId) ?? Number.MAX_SAFE_INTEGER) -
          (categoryOrder.get(right.categoryId) ?? Number.MAX_SAFE_INTEGER);

        if (categoryDifference !== 0) {
          return categoryDifference;
        }

        return left.name.localeCompare(right.name, "fr");
      }),
  };
}
