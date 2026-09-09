import { redirect } from "next/navigation";

import { MyDayClient } from "@/features/my-day/components";
import { getMyDay } from "@/features/my-day/server";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { getCurrentUser } from "@/server/auth/get-current-user";

export default async function MyDayPage() {
  const currentUser = await getCurrentUser();
  const user = await getAuthoritativeCurrentUser(currentUser);

  if (user.role !== "EMPLOYEE") redirect("/planning");

  const data = await getMyDay(user);
  if (!data) redirect("/planning");

  return (
    <main className="min-h-screen bg-[#fcf9f7] px-3 py-4 sm:px-6 sm:py-7">
      <div className="mx-auto w-full max-w-3xl">
        <MyDayClient data={data} />
      </div>
    </main>
  );
}
