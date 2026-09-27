import { beforeEach, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/server/permissions";
const mocks = vi.hoisted(() => ({ authority: vi.fn(), findMany: vi.fn() }));
vi.mock("@/server/db/prisma", () => ({
  prisma: { employee: { findMany: mocks.findMany } },
}));
vi.mock("@/server/auth/get-authoritative-current-user", () => ({
  getAuthoritativeCurrentUser: mocks.authority,
}));
import { getTeamOverview } from "@/features/employees/server/get-team-overview";
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
  mocks.findMany.mockResolvedValue([]);
});
it("scopes the read to the authoritative salon and excludes account data", async () => {
  mocks.authority.mockResolvedValue({
    ...manager,
    salonId: "authoritative-salon",
  });
  await getTeamOverview(manager);
  expect(mocks.findMany).toHaveBeenCalledWith({
    where: { salonId: "authoritative-salon" },
    orderBy: [{ isActive: "desc" }, { firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      isActive: true,
    },
  });
});
it.each([
  { ...manager, canManageSalon: false },
  { ...manager, isActive: false },
])("denies a revoked or inactive responsible", async (user) => {
  mocks.authority.mockResolvedValue(user);
  await expect(getTeamOverview(manager)).rejects.toThrow();
  expect(mocks.findMany).not.toHaveBeenCalled();
});
it("propagates an authoritative access denial without querying employees", async () => {
  mocks.authority.mockRejectedValue(new Error("inactive salon"));
  await expect(getTeamOverview(manager)).rejects.toThrow("inactive salon");
  expect(mocks.findMany).not.toHaveBeenCalled();
});
