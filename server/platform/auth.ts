import { isSessionCurrent } from "@/server/auth/session-version";
import { auth } from "@/auth";
import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { AuthenticationRequiredError } from "@/server/auth/authentication-error";
import { PermissionDeniedError } from "@/server/permissions/errors";

export async function getPlatformAccount(userId: string, authVersion?: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      role: true,
      salonId: true,
      isActive: true,
      authVersion: true,
    },
  });
  if (user?.role !== "SUPER_ADMIN") return null;
  if (
    !user.isActive ||
    user.salonId !== null ||
    !isSessionCurrent(user.authVersion, authVersion)
  )
    throw new PermissionDeniedError("Accès plateforme désactivé.");
  return user;
}

export async function requirePlatformAdmin(
  db: Prisma.TransactionClient = prisma,
) {
  const session = await auth();
  if (!session?.user?.id) throw new AuthenticationRequiredError();
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      firstName: true,
      role: true,
      salonId: true,
      isActive: true,
      authVersion: true,
    },
  });
  if (
    !user ||
    !user.isActive ||
    user.role !== "SUPER_ADMIN" ||
    user.salonId !== null ||
    !isSessionCurrent(user.authVersion, session.user.authVersion)
  ) {
    throw new PermissionDeniedError("Cet espace est réservé au superadmin.");
  }
  return user;
}
