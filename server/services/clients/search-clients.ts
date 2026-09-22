import type { CurrentUser } from "@/server/permissions";
import { requirePermission } from "@/server/permissions";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { prisma } from "@/server/db/prisma";

export type SearchClientsInput = {
  query?: string;
  phoneDigits: string;
  name?: string;
};

function phoneSearchVariants(phoneDigits: string): string[] {
  const variants = new Set<string>([phoneDigits]);
  if (phoneDigits.startsWith("0") && phoneDigits.length > 1) variants.add(phoneDigits.slice(1));
  if (phoneDigits.startsWith("212") && phoneDigits.length > 3) variants.add(phoneDigits.slice(3));
  return [...variants].filter((value) => value.length >= 3);
}

export async function searchClients(currentUser: CurrentUser, input: SearchClientsInput) {
  const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);
  requirePermission(authoritativeUser, "appointments:create");

  const query = input.query?.trim() ?? "";
  const queryDigits = query.replace(/\D/g, "");

  // Nouveau parcours : un seul champ cherche par nom OU téléphone.
  if (query) {
    if (query.length < 2) return [];
    const variants = queryDigits.length >= 3 ? phoneSearchVariants(queryDigits) : [];
    return prisma.client.findMany({
      where: {
        salonId: authoritativeUser.salonId,
        isActive: true,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          ...variants.map((value) => ({ phone: { contains: value } })),
        ],
      },
      orderBy: [{ name: "asc" }, { phone: "asc" }],
      take: 10,
      select: { id: true, name: true, phone: true, internalNote: true },
    });
  }

  // Compatibilité avec le formulaire historique : téléphone + raffinement nom.
  if (input.phoneDigits.length < 4) return [];
  const variants = phoneSearchVariants(input.phoneDigits);
  return prisma.client.findMany({
    where: {
      salonId: authoritativeUser.salonId,
      isActive: true,
      AND: [
        { OR: variants.map((value) => ({ phone: { contains: value } })) },
        ...(input.name?.trim() ? [{ name: { contains: input.name.trim(), mode: "insensitive" as const } }] : []),
      ],
    },
    orderBy: [{ name: "asc" }, { phone: "asc" }],
    take: 10,
    select: { id: true, name: true, phone: true, internalNote: true },
  });
}
