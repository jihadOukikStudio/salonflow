import { describe, expect, it } from "vitest";

import {
  createClientActionSchema,
  normalizeClientPhone,
  searchClientsActionSchema,
} from "@/features/clients/schemas";

describe("client schemas", () => {
  it("normalise les séparateurs et le préfixe 00", () => {
    expect(normalizeClientPhone("00 212 6 12 34 56 78")).toBe("+212612345678");
  });

  it("valide une nouvelle cliente", () => {
    const parsed = createClientActionSchema.parse({
      name: " Sara Test ",
      phone: "+212 6 12 34 56 78",
    });

    expect(parsed.name).toBe("Sara Test");
    expect(parsed.phone).toBe("+212612345678");
  });

  it("ne lance la recherche qu'à partir de 4 chiffres", () => {
    expect(
      searchClientsActionSchema.safeParse({ phone: "061", name: "" }).success,
    ).toBe(false);

    const result = searchClientsActionSchema.parse({
      phone: "06 12",
      name: "Sara",
    });

    expect(result.phoneDigits).toBe("0612");
    expect(result.name).toBe("Sara");
  });
});
