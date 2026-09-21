"use server";

import { revalidatePath } from "next/cache";
import { runAuthenticatedAction } from "@/server/actions/run-authenticated-action";
import { publishRealtimeEvent } from "@/server/realtime/publish-realtime-event";
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

async function revalidateClientViews(salonId: string, clientId?: string) {
  revalidatePath("/clients");
  revalidatePath("/planning");
  revalidatePath("/appointments", "layout");
  await publishRealtimeEvent({
    salonId,
    type: "client.changed",
    ...(clientId ? { entityId: clientId } : {}),
  });
}

export async function updateClientAdminAction(input: UpdateClientActionInput) {
  return runAuthenticatedAction(async (currentUser) => {
    const client = await updateClient(
      currentUser,
      updateClientActionSchema.parse(input),
    );
    await revalidateClientViews(currentUser.salonId, client.id);
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
    await revalidateClientViews(currentUser.salonId, client.id);
    return { clientId: client.id };
  });
}
