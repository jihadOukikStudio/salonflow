"use server";

import { revalidatePath } from "next/cache";

import { runAuthenticatedAction } from "@/server/actions/run-authenticated-action";
import {
  updateServiceDefaultsActionSchema,
  type UpdateServiceDefaultsActionInput,
} from "@/features/services/schemas";
import { updateServiceDefaults } from "@/server/services/catalog";

export async function updateServiceDefaultsAction(
  input: UpdateServiceDefaultsActionInput,
) {
  return runAuthenticatedAction(async (currentUser) => {
    const data = updateServiceDefaultsActionSchema.parse(input);
    const service = await updateServiceDefaults(currentUser, data);

    revalidatePath("/services");
    revalidatePath("/appointments/new");

    return {
      service: {
        id: service.id,
        name: service.name,
        defaultDurationMinutes: service.defaultDurationMinutes,
        defaultPrice: Number(service.defaultPrice),
        isStartingPrice: service.isStartingPrice,
      },
    };
  });
}
