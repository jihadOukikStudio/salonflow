"use server";
import { revalidatePath } from "next/cache";
import { runAuthenticatedAction } from "@/server/actions/run-authenticated-action";
import {
  createEmployeeUnavailabilityActionSchema,
  deleteEmployeeUnavailabilityActionSchema,
  createRoomUnavailabilityActionSchema,
  deleteRoomUnavailabilityActionSchema,
  type CreateEmployeeUnavailabilityActionInput,
  type CreateRoomUnavailabilityActionInput,
} from "@/features/unavailability/schemas/unavailability-schemas";
import {
  createEmployeeUnavailability,
  deleteEmployeeUnavailability,
  createRoomUnavailability,
  deleteRoomUnavailability,
} from "@/server/services/unavailability";
function refresh() {
  revalidatePath("/employees/unavailability");
  revalidatePath("/rooms");
  revalidatePath("/planning");
  revalidatePath("/organize");
  revalidatePath("/appointments", "layout");
}
export async function createEmployeeUnavailabilityAction(
  input: CreateEmployeeUnavailabilityActionInput,
) {
  return runAuthenticatedAction(async (user) => {
    const item = await createEmployeeUnavailability(
      user,
      createEmployeeUnavailabilityActionSchema.parse(input),
    );
    refresh();
    return { id: item.id };
  });
}
export async function deleteEmployeeUnavailabilityAction(input: {
  id: string;
}) {
  return runAuthenticatedAction(async (user) => {
    const parsed = deleteEmployeeUnavailabilityActionSchema.parse(input);
    const item = await deleteEmployeeUnavailability(user, parsed.id);
    refresh();
    return item;
  });
}
export async function createRoomUnavailabilityAction(
  input: CreateRoomUnavailabilityActionInput,
) {
  return runAuthenticatedAction(async (user) => {
    const item = await createRoomUnavailability(
      user,
      createRoomUnavailabilityActionSchema.parse(input),
    );
    refresh();
    return { id: item.id };
  });
}
export async function deleteRoomUnavailabilityAction(input: { id: string }) {
  return runAuthenticatedAction(async (user) => {
    const parsed = deleteRoomUnavailabilityActionSchema.parse(input);
    const item = await deleteRoomUnavailability(user, parsed.id);
    refresh();
    return item;
  });
}
