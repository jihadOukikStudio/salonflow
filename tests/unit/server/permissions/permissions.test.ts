import { describe, expect, it } from "vitest";

import {
  getPermissions,
  hasPermission,
  PermissionDeniedError,
  requirePermission,
  type CurrentUser,
} from "@/server/permissions";

function createUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: "user-1",
    salonId: "salon-1",
    role: "EMPLOYEE",
    canManageSalon: false,
    isActive: true,
    ...overrides,
  };
}

describe("permissions", () => {
  describe("inactive user", () => {
    it("has no permissions", () => {
      const user = createUser({
        role: "ADMIN",
        canManageSalon: true,
        isActive: false,
      });

      expect(getPermissions(user)).toEqual([]);
    });

    it("cannot perform an otherwise authorized action", () => {
      const user = createUser({
        role: "ADMIN",
        isActive: false,
      });

      expect(hasPermission(user, "appointments:create")).toBe(false);
    });
  });

  describe("admin", () => {
    const admin = createUser({
      role: "ADMIN",
      canManageSalon: true,
    });

    it("can manage appointments", () => {
      expect(hasPermission(admin, "appointments:create")).toBe(true);
      expect(hasPermission(admin, "appointments:update")).toBe(true);
      expect(hasPermission(admin, "appointments:cancel")).toBe(true);
      expect(hasPermission(admin, "appointments:close")).toBe(true);
    });

    it("can manage the service catalogue", () => {
      expect(hasPermission(admin, "services:manage")).toBe(true);
    });

    it("can manage employees and permissions", () => {
      expect(hasPermission(admin, "employees:manage")).toBe(true);

      expect(hasPermission(admin, "employees:manage-permissions")).toBe(true);
    });

    it("can view the activity history", () => {
      expect(hasPermission(admin, "activity:view")).toBe(true);
    });
  });

  describe("employee with salon management access", () => {
    const manager = createUser({
      role: "EMPLOYEE",
      canManageSalon: true,
    });

    it("can manage appointments operationally", () => {
      expect(hasPermission(manager, "appointments:create")).toBe(true);
      expect(hasPermission(manager, "appointments:update")).toBe(true);
      expect(hasPermission(manager, "appointments:cancel")).toBe(true);
      expect(hasPermission(manager, "appointments:assign")).toBe(true);
      expect(hasPermission(manager, "appointments:record-payment")).toBe(true);
      expect(hasPermission(manager, "appointments:close")).toBe(true);
    });

    it("can manage clients", () => {
      expect(hasPermission(manager, "clients:create")).toBe(true);
      expect(hasPermission(manager, "clients:update")).toBe(true);
    });

    it("cannot structurally manage the catalogue", () => {
      expect(hasPermission(manager, "services:manage")).toBe(false);
    });

    it("cannot manage employee accounts or permissions", () => {
      expect(hasPermission(manager, "employees:manage")).toBe(false);

      expect(hasPermission(manager, "employees:manage-permissions")).toBe(
        false,
      );
    });

    it("cannot structurally manage rooms", () => {
      expect(hasPermission(manager, "rooms:manage")).toBe(false);
    });

    it("cannot view the admin activity history", () => {
      expect(hasPermission(manager, "activity:view")).toBe(false);
    });
  });

  describe("standard employee", () => {
    const employee = createUser();

    it("can view the planning", () => {
      expect(hasPermission(employee, "appointments:view")).toBe(true);
    });

    it("cannot create, modify or cancel an appointment", () => {
      expect(hasPermission(employee, "appointments:create")).toBe(false);
      expect(hasPermission(employee, "appointments:update")).toBe(false);
      expect(hasPermission(employee, "appointments:cancel")).toBe(false);
    });

    it("can participate in operational assignment", () => {
      expect(hasPermission(employee, "appointments:assign")).toBe(true);

      expect(
        hasPermission(employee, "appointments:take-unassigned-service"),
      ).toBe(true);
    });

    it("can update the status of their own service", () => {
      expect(
        hasPermission(employee, "appointments:update-own-service-status"),
      ).toBe(true);
    });

    it("cannot record a payment or close an appointment", () => {
      expect(hasPermission(employee, "appointments:record-payment")).toBe(
        false,
      );

      expect(hasPermission(employee, "appointments:close")).toBe(false);
    });

    it("cannot modify client data", () => {
      expect(hasPermission(employee, "clients:create")).toBe(false);
      expect(hasPermission(employee, "clients:update")).toBe(false);
    });

    it("can create their own unavailability but cannot manage all unavailabilities", () => {
      expect(
        hasPermission(employee, "employee-unavailability:create-own"),
      ).toBe(true);

      expect(hasPermission(employee, "employee-unavailability:manage")).toBe(
        false,
      );
    });

    it("cannot modify the service catalogue", () => {
      expect(hasPermission(employee, "services:manage")).toBe(false);
    });

    it("cannot structurally manage rooms", () => {
      expect(hasPermission(employee, "rooms:manage")).toBe(false);
    });
  });

  describe("requirePermission", () => {
    it("does not throw when permission is granted", () => {
      const admin = createUser({
        role: "ADMIN",
      });

      expect(() => requirePermission(admin, "services:manage")).not.toThrow();
    });

    it("throws PermissionDeniedError when permission is denied", () => {
      const employee = createUser();

      expect(() => requirePermission(employee, "services:manage")).toThrow(
        PermissionDeniedError,
      );
    });

    it("denies every permission to an inactive user", () => {
      const user = createUser({
        role: "ADMIN",
        isActive: false,
      });

      expect(() => requirePermission(user, "appointments:view")).toThrow(
        PermissionDeniedError,
      );
    });
  });
});
