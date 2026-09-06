import { describe, expect, it } from "vitest";

import { updateServiceDefaultsActionSchema } from "@/features/services/schemas";

describe("updateServiceDefaultsActionSchema", () => {
  it("accepts a valid duration and price", () => {
    const result = updateServiceDefaultsActionSchema.safeParse({
      serviceId: crypto.randomUUID(),
      defaultDurationMinutes: 45,
      defaultPrice: 250,
      isStartingPrice: false,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a zero duration", () => {
    const result = updateServiceDefaultsActionSchema.safeParse({
      serviceId: crypto.randomUUID(),
      defaultDurationMinutes: 0,
      defaultPrice: 250,
      isStartingPrice: false,
    });

    expect(result.success).toBe(false);
  });
});
