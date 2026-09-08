import { describe, expect, it } from "vitest";
import {
  createEmployeeActionSchema,
  saveEmployeeAccessActionSchema,
} from "@/features/employees/schemas";

describe("employee schemas", () => {
  it("requires an employee first name", () => {
    expect(() => createEmployeeActionSchema.parse({ firstName: "" })).toThrow();
  });

  it("accepts employee access with phone and optional email", () => {
    const parsed = saveEmployeeAccessActionSchema.parse({
      employeeId: crypto.randomUUID(),
      phone: "06 12 34 56 78",
      email: "",
      temporaryPassword: "TempPassword12!",
      canManageSalon: true,
      isActive: true,
    });

    expect(parsed.phone).toBe("+212612345678");
    expect(parsed.email).toBeNull();
  });

  it("keeps email available when the employee has one", () => {
    const parsed = saveEmployeeAccessActionSchema.parse({
      employeeId: crypto.randomUUID(),
      phone: "+212612345678",
      email: "SARA@EXAMPLE.COM",
      temporaryPassword: "TempPassword12!",
      canManageSalon: false,
      isActive: true,
    });

    expect(parsed.email).toBe("sara@example.com");
  });

  it("rejects access creation without a valid phone", () => {
    expect(() =>
      saveEmployeeAccessActionSchema.parse({
        employeeId: crypto.randomUUID(),
        phone: "123",
        email: "sara@example.com",
        temporaryPassword: "TempPassword12!",
        canManageSalon: false,
        isActive: true,
      }),
    ).toThrow();
  });
});
