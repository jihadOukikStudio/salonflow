import { redirect } from "next/navigation";

import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { getCurrentUser } from "@/server/auth/get-current-user";

export default async function HomePage() {
  const currentUser = await getCurrentUser();
  const user = await getAuthoritativeCurrentUser(currentUser);

  if (user.role === "EMPLOYEE" && !user.canManageSalon) {
    redirect("/my-day");
  }

  redirect(
    user.role === "ADMIN" || user.canManageSalon ? "/dashboard" : "/planning",
  );
}
