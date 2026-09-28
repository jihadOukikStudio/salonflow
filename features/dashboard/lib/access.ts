type DashboardUser = {
  role: "ADMIN" | "EMPLOYEE" | "SUPER_ADMIN";
  canManageSalon: boolean;
};

export function canAccessDashboard(user: DashboardUser) {
  return user.role === "ADMIN";
}

export function canViewDashboardFinance(user: DashboardUser) {
  return user.role === "ADMIN";
}
