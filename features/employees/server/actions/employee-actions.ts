"use server";

import { revalidatePath } from "next/cache";

import { runAuthenticatedAction } from "@/server/actions/run-authenticated-action";
import {
  createEmployeeActionSchema,
  updateEmployeeActionSchema,
  setEmployeeActiveActionSchema,
  saveEmployeeAccessActionSchema,
  type CreateEmployeeActionInput,
  type UpdateEmployeeActionInput,
  type SetEmployeeActiveActionInput,
  type SaveEmployeeAccessActionInput,
} from "@/features/employees/schemas";
import {
  createEmployee,
  updateEmployee,
  setEmployeeActive,
  saveEmployeeAccess,
} from "@/server/services/employees";

function revalidateEmployeeViews() {
  revalidatePath("/employees");
  revalidatePath("/organize");
  revalidatePath("/planning");
  revalidatePath("/appointments", "layout");
}

export async function createEmployeeAction(input: CreateEmployeeActionInput) {
  return runAuthenticatedAction(async (currentUser) => {
    const employee = await createEmployee(
      currentUser,
      createEmployeeActionSchema.parse(input),
    );
    revalidateEmployeeViews();
    return { employeeId: employee.id };
  });
}

export async function updateEmployeeAction(input: UpdateEmployeeActionInput) {
  return runAuthenticatedAction(async (currentUser) => {
    const employee = await updateEmployee(
      currentUser,
      updateEmployeeActionSchema.parse(input),
    );
    revalidateEmployeeViews();
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
    revalidateEmployeeViews();
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
    revalidateEmployeeViews();
    return { userId: access.id };
  });
}
