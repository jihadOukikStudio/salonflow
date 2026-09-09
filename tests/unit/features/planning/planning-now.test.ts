import { describe, expect, it } from "vitest";

import {
  isInsidePlanningWindow,
  planningNowTop,
  PLANNING_END_MINUTE,
  PLANNING_HOUR_HEIGHT,
  PLANNING_START_MINUTE,
} from "@/features/planning/components/planning-now";

describe("planning-now", () => {
  it("considère la plage 10h00-21h30 comme visible", () => {
    expect(isInsidePlanningWindow(PLANNING_START_MINUTE)).toBe(true);
    expect(isInsidePlanningWindow(17 * 60 + 15)).toBe(true);
    expect(isInsidePlanningWindow(PLANNING_END_MINUTE)).toBe(true);
    expect(isInsidePlanningWindow(PLANNING_START_MINUTE - 1)).toBe(false);
    expect(isInsidePlanningWindow(PLANNING_END_MINUTE + 1)).toBe(false);
  });

  it("positionne exactement 11h une heure sous 10h", () => {
    expect(planningNowTop(11 * 60)).toBe(PLANNING_HOUR_HEIGHT);
  });

  it("borne le repère avant l'ouverture et après la fin maximale", () => {
    expect(planningNowTop(8 * 60)).toBe(0);
    expect(planningNowTop(23 * 60)).toBe(
      ((PLANNING_END_MINUTE - PLANNING_START_MINUTE) / 60) *
        PLANNING_HOUR_HEIGHT,
    );
  });
});
