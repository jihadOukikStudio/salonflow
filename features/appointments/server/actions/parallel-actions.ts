"use server";

import { runAuthenticatedAction } from "@/server/actions/run-authenticated-action";

import {
  createParallelGroupActionSchema,
  removeParallelGroupActionSchema,
  type CreateParallelGroupActionInput,
  type RemoveParallelGroupActionInput,
} from "@/features/appointments/schemas";

import { createParallelGroup } from "@/server/services/appointments/create-parallel-group";
import { removeParallelGroup } from "@/server/services/appointments/remove-parallel-group";

import { revalidateAppointmentViews } from "@/features/appointments/server/revalidate-appointment-views";

export async function createParallelGroupAction(
  input: CreateParallelGroupActionInput,
) {
  return runAuthenticatedAction(async (currentUser) => {
    const data = createParallelGroupActionSchema.parse(input);

    const appointment = await createParallelGroup(currentUser, data);

    revalidateAppointmentViews(appointment.id);

    return {
      appointmentId: appointment.id,
    };
  });
}

export async function removeParallelGroupAction(
  input: RemoveParallelGroupActionInput,
) {
  return runAuthenticatedAction(async (currentUser) => {
    const data = removeParallelGroupActionSchema.parse(input);

    const appointment = await removeParallelGroup(currentUser, data);

    revalidateAppointmentViews(appointment.id);

    return {
      appointmentId: appointment.id,
    };
  });
}
