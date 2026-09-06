export type PlanningView = "planning" | "employees" | "rooms";

export function parsePlanningView(value?: string): PlanningView {
  if (value === "employees" || value === "rooms") {
    return value;
  }

  return "planning";
}
