import type { CurrentUser, Permission } from "./types";

const adminPermissions: Permission[] = [
  "appointments:view",
  "appointments:create",
  "appointments:update",
  "appointments:cancel",
  "appointments:assign",
  "appointments:update-own-service-status",
  "appointments:take-unassigned-service",
  "appointments:record-payment",
  "appointments:close",

  "clients:view",
  "clients:create",
  "clients:update",

  "employees:view",
  "employees:manage",
  "employees:manage-permissions",
  "employees:manage-skills",

  "employee-unavailability:view",
  "employee-unavailability:create-own",
  "employee-unavailability:manage",

  "services:view",
  "services:manage",

  "rooms:view",
  "rooms:assign",
  "rooms:manage",
  "rooms:manage-unavailability",

  "activity:view",
];

const managerEmployeePermissions: Permission[] = [
  "appointments:view",
  "appointments:create",
  "appointments:update",
  "appointments:cancel",
  "appointments:assign",
  "appointments:update-own-service-status",
  "appointments:take-unassigned-service",
  "appointments:record-payment",
  "appointments:close",

  "clients:view",
  "clients:create",
  "clients:update",

  "employees:view",

  "employee-unavailability:view",
  "employee-unavailability:create-own",
  "employee-unavailability:manage",

  "services:view",

  "rooms:view",
  "rooms:assign",
  "rooms:manage-unavailability",
];

const standardEmployeePermissions: Permission[] = [
  "appointments:view",
  "appointments:assign",
  "appointments:update-own-service-status",
  "appointments:take-unassigned-service",

  "clients:view",

  "employees:view",

  "employee-unavailability:view",
  "employee-unavailability:create-own",

  "services:view",

  "rooms:view",
  "rooms:assign",
];

export function getPermissions(user: CurrentUser): Permission[] {
  if (!user.isActive) {
    return [];
  }

  if (user.role === "ADMIN") {
    return adminPermissions;
  }

  if (user.role === "EMPLOYEE" && user.canManageSalon) {
    return managerEmployeePermissions;
  }

  return standardEmployeePermissions;
}

export function hasPermission(
  user: CurrentUser,
  permission: Permission,
): boolean {
  return getPermissions(user).includes(permission);
}
