"use server";

import { runAuthenticatedAction } from "@/server/actions/run-authenticated-action";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { requirePermission } from "@/server/permissions";
import { getPlanningDay } from "@/features/planning/server/get-planning-day";
import { parsePlanningDate } from "@/features/planning/server/casablanca-day";

export async function getPlanningDayForBookingAction(input: { dateKey: string }) {
  return runAuthenticatedAction(async (currentUser) => {
    const user = await getAuthoritativeCurrentUser(currentUser);
    requirePermission(user, "appointments:create");
    const dateKey = parsePlanningDate(input.dateKey);
    return getPlanningDay(user, dateKey);
  });
}
