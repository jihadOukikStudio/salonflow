import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  transaction: vi.fn(),
  count: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/db/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.findUnique },
    salon: { count: mocks.count },
    $transaction: mocks.transaction,
  },
}));
import { requirePlatformAdmin } from "@/server/platform/auth";
import { executePlatformCommand } from "@/server/platform/commands";
import { getPlatformRevenue } from "@/server/platform/revenue";
import { getPlatformDues } from "@/server/platform/dues";
import { getPlatformDashboard } from "@/server/platform/queries";
const account = {
  id: "admin",
  firstName: "Jihad",
  role: "SUPER_ADMIN",
  salonId: null,
  isActive: true,
  authVersion: 0,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "admin", authVersion: 0 } });
  mocks.findUnique.mockResolvedValue(account);
});
it("reads the real account rather than trusting session roles", async () => {
  mocks.auth.mockResolvedValue({
    user: { id: "admin", role: "EMPLOYEE", authVersion: 0 },
  });
  expect(await requirePlatformAdmin()).toEqual(account);
});
it.each([
  { ...account, role: "ADMIN", salonId: "salon" },
  { ...account, role: "EMPLOYEE", salonId: "salon" },
  { ...account, isActive: false },
  { ...account, salonId: "salon" },
  { ...account, authVersion: 1 },
  null,
])("denies non-platform, invalid or revoked accounts %j", async (user) => {
  mocks.findUnique.mockResolvedValue(user);
  await expect(requirePlatformAdmin()).rejects.toThrow();
  await expect(
    executePlatformCommand({
      kind: "createSalon",
      name: "Salon",
      phone: "",
      address: "",
    }),
  ).rejects.toThrow();
  await expect(getPlatformDashboard()).rejects.toThrow();
  await expect(getPlatformRevenue()).rejects.toThrow();
  await expect(getPlatformDues({})).rejects.toThrow();
  expect(mocks.transaction).not.toHaveBeenCalled();
  expect(mocks.count).not.toHaveBeenCalled();
});
it("rejects unauthenticated users before looking up data", async () => {
  mocks.auth.mockResolvedValue(null);
  await expect(requirePlatformAdmin()).rejects.toThrow();
  expect(mocks.findUnique).not.toHaveBeenCalled();
});
