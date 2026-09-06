import { describe, expect, it } from "vitest";
import {
  createEmployeeActionSchema,
  saveEmployeeAccessActionSchema,
} from "@/features/employees/schemas";

describe("employee schemas", () => {
  it("requires an employee first name", () => {
    expect(() => createEmployeeActionSchema.parse({ firstName: "" })).toThrow();
  });

  it("accepts an optional employee access with a strong temporary password", () => {
    const parsed = saveEmployeeAccessActionSchema.parse({
      employeeId: crypto.randomUUID(),
      email: "sara@example.com",
      temporaryPassword: "TempPassword12!",
      canManageSalon: true,
      isActive: true,
    });
    expect(parsed.email).toBe("sara@example.com");
  });
});
