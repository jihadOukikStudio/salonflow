import { redirect } from "next/navigation";

import { getEmployees, getTeamActivity } from "@/features/employees/server";
import { EmployeesAdmin } from "@/features/employees/server/components/employees-admin";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { getCurrentUser } from "@/server/auth/get-current-user";

export default async function EmployeesPage() {
  const currentUser = await getCurrentUser();
  const user = await getAuthoritativeCurrentUser(currentUser);

  if (user.role !== "ADMIN") redirect("/planning");

  const [employeeData, teamActivity] = await Promise.all([
    getEmployees(user),
    getTeamActivity(user),
  ]);

  return (
    <main className="min-h-screen bg-[#fbfaf8]">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        <EmployeesAdmin {...employeeData} activity={teamActivity} />
      </div>
    </main>
  );
}
