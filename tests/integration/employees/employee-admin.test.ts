import { compare } from "bcryptjs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { CurrentUser } from "@/server/permissions";
import {
  createEmployee,
  saveEmployeeAccess,
  setEmployeeActive,
} from "@/server/services/employees";
import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

async function createAdmin() {
  const salon = await testPrisma.salon.create({
    data: { name: `Salon ${crypto.randomUUID()}` },
  });
  const admin = await testPrisma.user.create({
    data: {
      salonId: salon.id,
      email: `${crypto.randomUUID()}@test.local`,
      passwordHash: "test-hash",
      firstName: "Admin",
      role: "ADMIN",
      canManageSalon: true,
    },
  });
  const currentUser: CurrentUser = {
    id: admin.id,
    salonId: salon.id,
    role: "ADMIN",
    canManageSalon: true,
    isActive: true,
  };
  return { salon, admin, currentUser };
}

describe("employee administration", () => {
  beforeEach(async () => cleanDatabase());
  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("creates an active employee in the current salon", async () => {
    const { currentUser } = await createAdmin();
    const employee = await createEmployee(currentUser, { firstName: "Sara" });
    expect(employee.firstName).toBe("Sara");
    expect(employee.isActive).toBe(true);
  });

  it("creates a separate login and links it to the employee", async () => {
    const { currentUser } = await createAdmin();
    const employee = await createEmployee(currentUser, { firstName: "Sara" });
    const user = await saveEmployeeAccess(currentUser, {
      employeeId: employee.id,
      phone: "+212612345678",
      email: "sara@test.local",
      temporaryPassword: "TempPassword12!",
      canManageSalon: true,
      isActive: true,
    });
    const linked = await testPrisma.employee.findUniqueOrThrow({
      where: { id: employee.id },
    });
    expect(linked.userId).toBe(user.id);
    expect(user.role).toBe("EMPLOYEE");
    expect(user.canManageSalon).toBe(true);
  });

  it("creates a phone-only employee login without email", async () => {
    const { currentUser } = await createAdmin();
    const employee = await createEmployee(currentUser, { firstName: "Atika" });
    const user = await saveEmployeeAccess(currentUser, {
      employeeId: employee.id,
      phone: "+212698765432",
      email: null,
      temporaryPassword: "TempPassword12!",
      canManageSalon: false,
      isActive: true,
    });

    expect(user.email).toBeNull();
    expect(user.phone).toBe("+212698765432");

    const linked = await testPrisma.employee.findUniqueOrThrow({
      where: { id: employee.id },
    });
    expect(linked.phone).toBe("+212698765432");
  });

  it("rejects a duplicate login phone in the same salon", async () => {
    const { currentUser } = await createAdmin();
    const sara = await createEmployee(currentUser, { firstName: "Sara" });
    const atika = await createEmployee(currentUser, { firstName: "Atika" });

    await saveEmployeeAccess(currentUser, {
      employeeId: sara.id,
      phone: "+212612345678",
      email: null,
      temporaryPassword: "TempPassword12!",
      canManageSalon: false,
      isActive: true,
    });

    await expect(
      saveEmployeeAccess(currentUser, {
        employeeId: atika.id,
        phone: "+212612345678",
        email: null,
        temporaryPassword: "TempPassword12!",
        canManageSalon: false,
        isActive: true,
      }),
    ).rejects.toThrow("Ce téléphone est déjà utilisé dans ce salon.");
  });

  it("disables the linked login when the employee is disabled", async () => {
    const { currentUser } = await createAdmin();
    const employee = await createEmployee(currentUser, { firstName: "Sara" });
    const user = await saveEmployeeAccess(currentUser, {
      employeeId: employee.id,
      phone: "+212612345678",
      email: "sara@test.local",
      temporaryPassword: "TempPassword12!",
      canManageSalon: false,
      isActive: true,
    });
    await setEmployeeActive(currentUser, {
      employeeId: employee.id,
      isActive: false,
    });
    const refreshed = await testPrisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(refreshed.isActive).toBe(false);
  });
  it("increments sessionVersion when an admin resets an employee password", async () => {
    const { currentUser } = await createAdmin();
    const employee = await createEmployee(currentUser, { firstName: "Sara" });
    const user = await saveEmployeeAccess(currentUser, {
      employeeId: employee.id,
      phone: "+212612345678",
      email: null,
      temporaryPassword: "TempPassword12!",
      canManageSalon: false,
      isActive: true,
    });

    expect(user.sessionVersion).toBe(0);

    await saveEmployeeAccess(currentUser, {
      employeeId: employee.id,
      phone: "+212612345678",
      email: null,
      temporaryPassword: "NouveauPassword12!",
      canManageSalon: false,
      isActive: true,
    });

    const refreshed = await testPrisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(refreshed.sessionVersion).toBe(1);
    expect(await compare("NouveauPassword12!", refreshed.passwordHash)).toBe(
      true,
    );
  });
});
