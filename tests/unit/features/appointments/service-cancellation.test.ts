import { describe, expect, it } from "vitest";
import {
  activeServiceAmount,
  serializeServiceCancellation,
} from "@/features/appointments/detail/server/service-cancellation";

describe("service cancellation serialization", () => {
  it("keeps a newly created service active when cancelledAt is null", () => {
    expect(serializeServiceCancellation(null)).toBeNull();
    expect(activeServiceAmount(null, 250)).toBe(250);
  });

  it("marks only explicitly cancelled services and removes them from the amount", () => {
    const cancelledAt = new Date("2026-09-23T15:00:00.000Z");
    expect(serializeServiceCancellation(cancelledAt)).toBe(
      "2026-09-23T15:00:00.000Z",
    );
    expect(activeServiceAmount(cancelledAt.toISOString(), 250)).toBe(0);
  });
});
