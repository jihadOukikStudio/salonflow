import { beforeEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CurrentUser } from "@/server/permissions";
const mocks = vi.hoisted(() => ({
  authority: vi.fn(),
  overview: vi.fn(),
  employees: vi.fn(),
  activity: vi.fn(),
}));
vi.mock("@/server/auth/get-current-user", () => ({
  getCurrentUser: vi.fn(async () => ({})),
}));
vi.mock("@/server/auth/get-authoritative-current-user", () => ({
  getAuthoritativeCurrentUser: mocks.authority,
}));
vi.mock("@/features/employees/server/get-team-overview", () => ({
  getTeamOverview: mocks.overview,
}));
vi.mock("@/features/employees/server", () => ({
  getEmployees: mocks.employees,
  getTeamActivity: mocks.activity,
}));
vi.mock("@/features/employees/server/components/employees-admin", () => ({
  EmployeesAdmin: () => "admin-only",
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
import EmployeesPage from "@/app/employees/page";
import { TeamOverview } from "@/features/employees/server/components/team-overview";
import { PlanningQuickNav } from "@/features/planning/components/planning-quick-nav";
const manager: CurrentUser = {
  id: "manager",
  salonId: "salon",
  role: "EMPLOYEE",
  isActive: true,
  canManageSalon: true,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authority.mockResolvedValue(manager);
  mocks.overview.mockResolvedValue([
    {
      id: "employee",
      firstName: "Ahlam",
      lastName: null,
      phone: null,
      isActive: true,
    },
  ]);
  mocks.employees.mockResolvedValue({});
  mocks.activity.mockResolvedValue({});
});
it("shows the team and unavailability link without loading admin data", async () => {
  const html = renderToStaticMarkup(await EmployeesPage());
  expect(html).toContain("Ahlam");
  expect(html).toContain('href="/employees/unavailability"');
  expect(html).not.toContain("admin-only");
  expect(html).not.toContain("<button");
  expect(html).not.toContain("<form");
  expect(mocks.employees).not.toHaveBeenCalled();
  expect(mocks.activity).not.toHaveBeenCalled();
});
it("preserves the admin screen", async () => {
  mocks.authority.mockResolvedValue({ ...manager, role: "ADMIN" });
  expect(renderToStaticMarkup(await EmployeesPage())).toContain("admin-only");
  expect(mocks.employees).toHaveBeenCalledOnce();
  expect(mocks.activity).toHaveBeenCalledOnce();
  expect(mocks.overview).not.toHaveBeenCalled();
});
it("redirects a standard employee", async () => {
  mocks.authority.mockResolvedValue({ ...manager, canManageSalon: false });
  await expect(EmployeesPage()).rejects.toThrow("redirect:/planning");
  expect(mocks.overview).not.toHaveBeenCalled();
});
it("handles an empty team", () => {
  expect(
    renderToStaticMarkup(createElement(TeamOverview, { employees: [] })),
  ).toContain("Aucune employée");
});
it.each([true, false])(
  "uses the same team visibility in quick navigation: %s",
  (canManageSalon) => {
    const html = renderToStaticMarkup(
      createElement(PlanningQuickNav, { role: "EMPLOYEE", canManageSalon }),
    );
    expect(html.includes('href="/employees"')).toBe(canManageSalon);
  },
);
