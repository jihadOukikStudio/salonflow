import { describe, expect, it } from "vitest";
import { updateClientActionSchema } from "@/features/clients/schemas/client-admin-schemas";
describe("client admin schemas", () => {
  it("normalizes a valid phone", () => {
    const value = updateClientActionSchema.parse({
      clientId: crypto.randomUUID(),
      name: "Sara",
      phone: "06 12 34 56 78",
    });
    expect(value.phone).toBe("0612345678");
  });
});
