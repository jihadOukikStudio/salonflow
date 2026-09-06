import { describe, expect, it } from "vitest";
import { canAccessDashboard, canViewDashboardFinance } from "@/features/dashboard/lib/access";

describe("dashboard access", () => {
  it("autorise la gérante et affiche les finances", () => {
    const user = { role: "ADMIN" as const, canManageSalon: false };
    expect(canAccessDashboard(user)).toBe(true);
    expect(canViewDashboardFinance(user)).toBe(true);
  });

  it("autorise la responsable sans finances", () => {
    const user = { role: "EMPLOYEE" as const, canManageSalon: true };
    expect(canAccessDashboard(user)).toBe(true);
    expect(canViewDashboardFinance(user)).toBe(false);
  });

  it("redirige l'employée standard et ne lui expose pas les finances", () => {
    const user = { role: "EMPLOYEE" as const, canManageSalon: false };
    expect(canAccessDashboard(user)).toBe(false);
    expect(canViewDashboardFinance(user)).toBe(false);
  });
});
