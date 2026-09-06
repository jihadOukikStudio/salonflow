import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { employeeRepository } from "@/server/repositories/employee-repository";
import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

describe("employeeRepository salon isolation", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("returns an employee from the requested salon", async () => {
    const salon = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const employee = await testPrisma.employee.create({
      data: {
        salonId: salon.id,
        firstName: "Amina",
      },
    });

    const result = await employeeRepository.findById({
      salonId: salon.id,
      employeeId: employee.id,
    });

    expect(result?.id).toBe(employee.id);
    expect(result?.salonId).toBe(salon.id);
  });

  it("does not return an employee from another salon", async () => {
    const salonA = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const salonB = await testPrisma.salon.create({
      data: { name: "Salon B" },
    });

    const employeeB = await testPrisma.employee.create({
      data: {
        salonId: salonB.id,
        firstName: "Sara",
      },
    });

    const result = await employeeRepository.findById({
      salonId: salonA.id,
      employeeId: employeeB.id,
    });

    expect(result).toBeNull();
  });

  it("only lists employees from the requested salon", async () => {
    const salonA = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const salonB = await testPrisma.salon.create({
      data: { name: "Salon B" },
    });

    await testPrisma.employee.create({
      data: {
        salonId: salonA.id,
        firstName: "Amina",
      },
    });

    await testPrisma.employee.create({
      data: {
        salonId: salonB.id,
        firstName: "Sara",
      },
    });

    const employees = await employeeRepository.list({
      salonId: salonA.id,
    });

    expect(employees).toHaveLength(1);
    expect(employees[0]?.salonId).toBe(salonA.id);
  });

  it("does not list inactive employees by default", async () => {
    const salon = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    await testPrisma.employee.create({
      data: {
        salonId: salon.id,
        firstName: "Inactive",
        isActive: false,
      },
    });

    const employees = await employeeRepository.list({
      salonId: salon.id,
    });

    expect(employees).toHaveLength(0);
  });

  it("can explicitly list inactive employees", async () => {
    const salon = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    await testPrisma.employee.create({
      data: {
        salonId: salon.id,
        firstName: "Inactive",
        isActive: false,
      },
    });

    const employees = await employeeRepository.list({
      salonId: salon.id,
      includeInactive: true,
    });

    expect(employees).toHaveLength(1);
    expect(employees[0]?.isActive).toBe(false);
  });

  it("does not modify an employee from another salon", async () => {
    const salonA = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const salonB = await testPrisma.salon.create({
      data: { name: "Salon B" },
    });

    const employeeB = await testPrisma.employee.create({
      data: {
        salonId: salonB.id,
        firstName: "Original",
      },
    });

    const result = await employeeRepository.update({
      salonId: salonA.id,
      employeeId: employeeB.id,
      firstName: "HACKED",
    });

    expect(result.count).toBe(0);

    const unchanged = await testPrisma.employee.findUnique({
      where: {
        id: employeeB.id,
      },
    });

    expect(unchanged?.firstName).toBe("Original");
  });

  it("does not deactivate an employee from another salon", async () => {
    const salonA = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const salonB = await testPrisma.salon.create({
      data: { name: "Salon B" },
    });

    const employeeB = await testPrisma.employee.create({
      data: {
        salonId: salonB.id,
        firstName: "Sara",
      },
    });

    const result = await employeeRepository.deactivate({
      salonId: salonA.id,
      employeeId: employeeB.id,
    });

    expect(result.count).toBe(0);

    const unchanged = await testPrisma.employee.findUnique({
      where: {
        id: employeeB.id,
      },
    });

    expect(unchanged?.isActive).toBe(true);
  });

  it("can deactivate and reactivate its own employee", async () => {
    const salon = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const employee = await testPrisma.employee.create({
      data: {
        salonId: salon.id,
        firstName: "Amina",
      },
    });

    const deactivated = await employeeRepository.deactivate({
      salonId: salon.id,
      employeeId: employee.id,
    });

    expect(deactivated.count).toBe(1);

    const reactivated = await employeeRepository.reactivate({
      salonId: salon.id,
      employeeId: employee.id,
    });

    expect(reactivated.count).toBe(1);

    const finalEmployee = await testPrisma.employee.findUnique({
      where: {
        id: employee.id,
      },
    });

    expect(finalEmployee?.isActive).toBe(true);
  });

  it("finds an employee by user id inside the requested salon", async () => {
    const salon = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const user = await testPrisma.user.create({
      data: {
        salonId: salon.id,
        email: `${crypto.randomUUID()}@test.local`,
        passwordHash: "test-hash",
        firstName: "Amina",
        role: "EMPLOYEE",
      },
    });

    const employee = await testPrisma.employee.create({
      data: {
        salonId: salon.id,
        userId: user.id,
        firstName: "Amina",
      },
    });

    const result = await employeeRepository.findByUserId({
      salonId: salon.id,
      userId: user.id,
    });

    expect(result?.id).toBe(employee.id);
    expect(result?.user?.id).toBe(user.id);
  });

  it("creates an employee", async () => {
    const salon = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const employee = await employeeRepository.create({
      salonId: salon.id,
      firstName: "Sara",
      lastName: "Test",
      phone: "+212600000030",
    });

    expect(employee.salonId).toBe(salon.id);
    expect(employee.firstName).toBe("Sara");
  });
  it("creates an employee with optional fields omitted", async () => {
    const salon = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const employee = await employeeRepository.create({
      salonId: salon.id,
      firstName: "Sara",
    });

    expect(employee.userId).toBeNull();
    expect(employee.lastName).toBeNull();
    expect(employee.phone).toBeNull();
  });

  it("updates only the provided employee fields", async () => {
    const salon = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const employee = await testPrisma.employee.create({
      data: {
        salonId: salon.id,
        firstName: "Original",
        lastName: "Nom",
        phone: "+212600000031",
      },
    });

    const result = await employeeRepository.update({
      salonId: salon.id,
      employeeId: employee.id,
      firstName: "Amina",
    });

    expect(result.count).toBe(1);

    const updated = await testPrisma.employee.findUnique({
      where: { id: employee.id },
    });

    expect(updated?.firstName).toBe("Amina");
    expect(updated?.lastName).toBe("Nom");
    expect(updated?.phone).toBe("+212600000031");
  });
});
