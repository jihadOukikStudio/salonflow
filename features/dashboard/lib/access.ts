type DashboardUser = { role: "ADMIN" | "EMPLOYEE"; canManageSalon: boolean };

export function canAccessDashboard(user: DashboardUser) {
  return user.role === "ADMIN" || user.canManageSalon;
}

export function canViewDashboardFinance(user: DashboardUser) {
  return user.role === "ADMIN";
}
