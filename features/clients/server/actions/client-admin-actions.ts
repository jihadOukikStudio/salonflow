"use server";

import { revalidatePath } from "next/cache";
import { runAuthenticatedAction } from "@/server/actions/run-authenticated-action";
import {
  updateClientActionSchema,
  setClientActiveActionSchema,
  type UpdateClientActionInput,
  type SetClientActiveActionInput,
} from "@/features/clients/schemas/client-admin-schemas";
import {
  updateClient,
  setClientActive,
} from "@/server/services/clients/client-admin";

function revalidateClientViews() {
  revalidatePath("/clients");
  revalidatePath("/planning");
  revalidatePath("/appointments", "layout");
}

export async function updateClientAdminAction(input: UpdateClientActionInput) {
  return runAuthenticatedAction(async (currentUser) => {
    const client = await updateClient(
      currentUser,
      updateClientActionSchema.parse(input),
    );
    revalidateClientViews();
    return { clientId: client.id };
  });
}

export async function setClientActiveAdminAction(
  input: SetClientActiveActionInput,
) {
  return runAuthenticatedAction(async (currentUser) => {
    const client = await setClientActive(
      currentUser,
      setClientActiveActionSchema.parse(input),
    );
    revalidateClientViews();
    return { clientId: client.id };
  });
}
