import type { UserRole } from "@/app/generated/prisma/client";

export type CurrentUser = {
  id: string;
  salonId: string;
  role: UserRole;
  canManageSalon: boolean;
  isActive: boolean;
};

export type Permission =
  | "appointments:view"
  | "appointments:create"
  | "appointments:update"
  | "appointments:cancel"
  | "appointments:assign"
  | "appointments:update-own-service-status"
  | "appointments:take-unassigned-service"
  | "appointments:record-payment"
  | "appointments:close"
  | "clients:view"
  | "clients:create"
  | "clients:update"
  | "employees:view"
  | "employees:manage"
  | "employees:manage-permissions"
  | "employees:manage-skills"
  | "employee-unavailability:view"
  | "employee-unavailability:create-own"
  | "employee-unavailability:manage"
  | "services:view"
  | "services:manage"
  | "rooms:view"
  | "rooms:assign"
  | "rooms:manage"
  | "rooms:manage-unavailability"
  | "activity:view";
