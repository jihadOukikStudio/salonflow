import { describe, expect, it } from "vitest";

import { parsePlanningView } from "@/features/planning/server/planning-view";

describe("parsePlanningView", () => {
  it("uses planning by default", () => {
    expect(parsePlanningView()).toBe("planning");
    expect(parsePlanningView("unknown")).toBe("planning");
  });

  it("accepts employees and rooms", () => {
    expect(parsePlanningView("employees")).toBe("employees");
    expect(parsePlanningView("rooms")).toBe("rooms");
  });
});
