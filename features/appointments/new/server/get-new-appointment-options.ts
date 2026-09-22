import { prisma } from "@/server/db/prisma";
import type { CurrentUser } from "@/server/permissions";
import { requirePermission } from "@/server/permissions";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import type { NewAppointmentOptions } from "@/features/appointments/new/types";

export async function getNewAppointmentOptions(
  currentUser: CurrentUser,
): Promise<NewAppointmentOptions> {
  const user = await getAuthoritativeCurrentUser(currentUser);
  requirePermission(user, "appointments:create");
  const salonId = user.salonId;

  const [categories, services, employees, rooms] = await Promise.all([
    prisma.serviceCategory.findMany({
      where: { salonId, isActive: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.service.findMany({
      where: { salonId, isActive: true },
      orderBy: { name: "asc" },
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
    prisma.employee.findMany({
      where: { salonId, isActive: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        skills: { select: { serviceId: true } },
      },
    }),
    prisma.room.findMany({
      where: { salonId, isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, capacity: true },
    }),
  ]);

  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const categoryOrder = new Map(categories.map((c, i) => [c.id, i]));

  return {
    services: services
      .map((service) => ({
        id: service.id,
        categoryId: service.categoryId,
        categoryName: categoryNames.get(service.categoryId) ?? "Autres prestations",
        name: service.name,
        defaultDurationMinutes: service.defaultDurationMinutes,
        defaultPrice: Number(service.defaultPrice),
        isStartingPrice: service.isStartingPrice,
        requiredRoomType: service.requiredRoomType,
      }))
      .sort((a, b) =>
        (categoryOrder.get(a.categoryId) ?? 9999) -
          (categoryOrder.get(b.categoryId) ?? 9999) ||
        a.name.localeCompare(b.name, "fr"),
      ),
    employees: employees.map((employee) => ({
      id: employee.id,
      name: [employee.firstName, employee.lastName].filter(Boolean).join(" "),
      serviceIds: employee.skills.map((skill) => skill.serviceId),
    })),
    rooms,
  };
}
