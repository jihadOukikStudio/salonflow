import type { CurrentUser } from "@/server/permissions";

import { getCurrentUser } from "@/server/auth/get-current-user";
import {
  actionSuccess,
  mapActionError,
  type ActionResult,
} from "@/server/actions/action-result";

export async function runAuthenticatedAction<TData>(
  callback: (currentUser: CurrentUser) => Promise<TData>,
): Promise<ActionResult<TData>> {
  try {
    const currentUser = await getCurrentUser();
    const data = await callback(currentUser);

    return actionSuccess(data);
  } catch (error) {
    return mapActionError(error);
  }
}
