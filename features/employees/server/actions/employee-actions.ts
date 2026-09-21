"use server";

import { revalidatePath } from "next/cache";

import { runAuthenticatedAction } from "@/server/actions/run-authenticated-action";
import { publishRealtimeEvent } from "@/server/realtime/publish-realtime-event";
import {
  createEmployeeActionSchema,
  updateEmployeeActionSchema,
  setEmployeeActiveActionSchema,
  saveEmployeeAccessActionSchema,
  saveEmployeeSkillsActionSchema,
  type CreateEmployeeActionInput,
  type UpdateEmployeeActionInput,
  type SetEmployeeActiveActionInput,
  type SaveEmployeeAccessActionInput,
  type SaveEmployeeSkillsActionInput,
} from "@/features/employees/schemas";
import {
  createEmployee,
  updateEmployee,
  setEmployeeActive,
  saveEmployeeAccess,
  saveEmployeeSkills,
} from "@/server/services/employees";

async function revalidateEmployeeViews(
  salonId: string,
  type: "employee.changed" | "access.changed" = "employee.changed",
  entityId?: string,
) {
  revalidatePath("/employees");
  revalidatePath("/organize");
  revalidatePath("/planning");
  revalidatePath("/appointments", "layout");
  await publishRealtimeEvent({
    salonId,
    type,
    ...(entityId ? { entityId } : {}),
  });
}

export async function createEmployeeAction(input: CreateEmployeeActionInput) {
  return runAuthenticatedAction(async (currentUser) => {
    const employee = await createEmployee(
      currentUser,
      createEmployeeActionSchema.parse(input),
    );
    await revalidateEmployeeViews(
      currentUser.salonId,
      "employee.changed",
      employee.id,
    );
    return { employeeId: employee.id };
  });
}

export async function updateEmployeeAction(input: UpdateEmployeeActionInput) {
  return runAuthenticatedAction(async (currentUser) => {
    const employee = await updateEmployee(
      currentUser,
      updateEmployeeActionSchema.parse(input),
    );
    await revalidateEmployeeViews(
      currentUser.salonId,
      "employee.changed",
      employee.id,
    );
    return { employeeId: employee.id };
  });
}

export async function setEmployeeActiveAction(
  input: SetEmployeeActiveActionInput,
) {
  return runAuthenticatedAction(async (currentUser) => {
    const employee = await setEmployeeActive(
      currentUser,
      setEmployeeActiveActionSchema.parse(input),
    );
    await revalidateEmployeeViews(
      currentUser.salonId,
      "access.changed",
      employee.id,
    );
    return { employeeId: employee.id };
  });
}

export async function saveEmployeeAccessAction(
  input: SaveEmployeeAccessActionInput,
) {
  return runAuthenticatedAction(async (currentUser) => {
    const access = await saveEmployeeAccess(
      currentUser,
      saveEmployeeAccessActionSchema.parse(input),
    );
    await revalidateEmployeeViews(
      currentUser.salonId,
      "access.changed",
      access.id,
    );
    return { userId: access.id };
  });
}

export async function saveEmployeeSkillsAction(
  input: SaveEmployeeSkillsActionInput,
) {
  return runAuthenticatedAction(async (currentUser) => {
    const result = await saveEmployeeSkills(
      currentUser,
      saveEmployeeSkillsActionSchema.parse(input),
    );
    await revalidateEmployeeViews(currentUser.salonId, "employee.changed");
    return result;
  });
}
