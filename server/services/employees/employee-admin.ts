import { hash } from "bcryptjs";

import type { CurrentUser } from "@/server/permissions";
import { PermissionDeniedError } from "@/server/permissions/errors";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { prisma } from "@/server/db/prisma";
import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

function cleanNullable(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

async function requireAdmin(currentUser: CurrentUser) {
  const user = await getAuthoritativeCurrentUser(currentUser);
  if (user.role !== "ADMIN") {
    throw new PermissionDeniedError(
      "Seule la gérante peut gérer l'équipe et les accès.",
    );
  }
  return user;
}

export async function createEmployee(
  currentUser: CurrentUser,
  input: { firstName: string; lastName?: string | null; phone?: string | null },
) {
  const user = await requireAdmin(currentUser);
  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.create({
      data: {
        salonId: user.salonId,
        firstName: input.firstName.trim(),
        lastName: cleanNullable(input.lastName),
        phone: cleanNullable(input.phone),
        isActive: true,
      },
    });
    await tx.activityLog.create({
      data: {
        salonId: user.salonId,
        userId: user.id,
        action: "EMPLOYEE_CREATED",
        entityType: "Employee",
        entityId: employee.id,
        metadata: {
          firstName: employee.firstName,
          lastName: employee.lastName,
        },
      },
    });
    return employee;
  });
}

export async function updateEmployee(
  currentUser: CurrentUser,
  input: {
    employeeId: string;
    firstName: string;
    lastName?: string | null;
    phone?: string | null;
  },
) {
  const user = await requireAdmin(currentUser);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.employee.findFirst({
      where: { id: input.employeeId, salonId: user.salonId },
    });
    if (!existing) throw new ResourceNotFoundError("Employée introuvable.");
    const employee = await tx.employee.update({
      where: { id: existing.id },
      data: {
        firstName: input.firstName.trim(),
        lastName: cleanNullable(input.lastName),
        phone: cleanNullable(input.phone),
      },
    });
    await tx.activityLog.create({
      data: {
        salonId: user.salonId,
        userId: user.id,
        action: "EMPLOYEE_UPDATED",
        entityType: "Employee",
        entityId: employee.id,
      },
    });
    return employee;
  });
}

export async function setEmployeeActive(
  currentUser: CurrentUser,
  input: { employeeId: string; isActive: boolean },
) {
  const user = await requireAdmin(currentUser);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.employee.findFirst({
      where: { id: input.employeeId, salonId: user.salonId },
      select: { id: true, userId: true },
    });
    if (!existing) throw new ResourceNotFoundError("Employée introuvable.");

    const employee = await tx.employee.update({
      where: { id: existing.id },
      data: { isActive: input.isActive },
    });
    if (!input.isActive && existing.userId) {
      await tx.user.updateMany({
        where: { id: existing.userId, salonId: user.salonId },
        data: { isActive: false },
      });
    }
    await tx.activityLog.create({
      data: {
        salonId: user.salonId,
        userId: user.id,
        action: input.isActive
          ? "EMPLOYEE_REACTIVATED"
          : "EMPLOYEE_DEACTIVATED",
        entityType: "Employee",
        entityId: employee.id,
      },
    });
    return employee;
  });
}

export async function saveEmployeeAccess(
  currentUser: CurrentUser,
  input: {
    employeeId: string;
    phone: string;
    email?: string | null;
    temporaryPassword?: string;
    canManageSalon: boolean;
    isActive: boolean;
  },
) {
  const admin = await requireAdmin(currentUser);
  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findFirst({
      where: { id: input.employeeId, salonId: admin.salonId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        userId: true,
        isActive: true,
      },
    });
    if (!employee) throw new ResourceNotFoundError("Employée introuvable.");
    if (!employee.isActive && input.isActive) {
      throw new BusinessRuleError(
        "Réactivez d'abord l'employée avant de réactiver son accès.",
      );
    }

    const normalizedEmail = cleanNullable(input.email)?.toLowerCase() ?? null;

    const duplicatePhone = await tx.user.findFirst({
      where: {
        salonId: admin.salonId,
        phone: input.phone,
        ...(employee.userId ? { id: { not: employee.userId } } : {}),
      },
      select: { id: true },
    });
    if (duplicatePhone) {
      throw new BusinessRuleError(
        "Ce téléphone est déjà utilisé dans ce salon.",
      );
    }

    if (normalizedEmail) {
      const duplicateEmail = await tx.user.findFirst({
        where: {
          salonId: admin.salonId,
          email: normalizedEmail,
          ...(employee.userId ? { id: { not: employee.userId } } : {}),
        },
        select: { id: true },
      });
      if (duplicateEmail) {
        throw new BusinessRuleError(
          "Cet email est déjà utilisé dans ce salon.",
        );
      }
    }

    if (!employee.userId && !input.temporaryPassword) {
      throw new BusinessRuleError(
        "Un mot de passe temporaire est obligatoire pour créer l'accès.",
      );
    }

    const passwordHash = input.temporaryPassword
      ? await hash(input.temporaryPassword, 12)
      : undefined;

    let linkedUser;
    if (employee.userId) {
      linkedUser = await tx.user.update({
        where: { id: employee.userId },
        data: {
          phone: input.phone,
          email: normalizedEmail,
          canManageSalon: input.canManageSalon,
          isActive: input.isActive,
          ...(passwordHash
            ? { passwordHash, sessionVersion: { increment: 1 } }
            : {}),
        },
      });
    } else {
      linkedUser = await tx.user.create({
        data: {
          salonId: admin.salonId,
          phone: input.phone,
          email: normalizedEmail,
          passwordHash: passwordHash!,
          firstName: employee.firstName,
          lastName: employee.lastName,
          role: "EMPLOYEE",
          canManageSalon: input.canManageSalon,
          isActive: input.isActive,
        },
      });
      await tx.employee.update({
        where: { id: employee.id },
        data: { userId: linkedUser.id, phone: input.phone },
      });
    }

    await tx.activityLog.create({
      data: {
        salonId: admin.salonId,
        userId: admin.id,
        action: "EMPLOYEE_ACCESS_SAVED",
        entityType: "Employee",
        entityId: employee.id,
        metadata: {
          phone: linkedUser.phone,
          email: linkedUser.email,
          canManageSalon: linkedUser.canManageSalon,
          isActive: linkedUser.isActive,
        },
      },
    });

    return linkedUser;
  });
}

export async function saveEmployeeSkills(
  currentUser: CurrentUser,
  input: { employeeId: string; serviceIds: string[] },
) {
  const admin = await requireAdmin(currentUser);

  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findFirst({
      where: { id: input.employeeId, salonId: admin.salonId },
      select: { id: true },
    });

    if (!employee) throw new ResourceNotFoundError("Employée introuvable.");

    const uniqueServiceIds = [...new Set(input.serviceIds)];
    if (uniqueServiceIds.length !== input.serviceIds.length) {
      throw new BusinessRuleError(
        "Une compétence ne peut être sélectionnée qu'une seule fois.",
      );
    }

    if (uniqueServiceIds.length > 0) {
      const count = await tx.service.count({
        where: {
          salonId: admin.salonId,
          id: { in: uniqueServiceIds },
          isActive: true,
        },
      });
      if (count !== uniqueServiceIds.length) {
        throw new ResourceNotFoundError(
          "Une ou plusieurs prestations sont introuvables ou inactives.",
        );
      }
    }

    await tx.employeeSkill.deleteMany({ where: { employeeId: employee.id } });

    if (uniqueServiceIds.length > 0) {
      await tx.employeeSkill.createMany({
        data: uniqueServiceIds.map((serviceId) => ({
          employeeId: employee.id,
          serviceId,
        })),
      });
    }

    await tx.activityLog.create({
      data: {
        salonId: admin.salonId,
        userId: admin.id,
        action: "EMPLOYEE_SKILLS_SAVED",
        entityType: "Employee",
        entityId: employee.id,
        metadata: { serviceIds: uniqueServiceIds },
      },
    });

    return { employeeId: employee.id, serviceIds: uniqueServiceIds };
  });
}
