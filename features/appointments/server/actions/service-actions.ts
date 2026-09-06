"use server";

import { z } from "zod";

import { runAuthenticatedAction } from "@/server/actions/run-authenticated-action";

import {
  addAppointmentServiceActionSchema,
  appointmentServiceIdActionSchema,
  assignEmployeeActionSchema,
  assignRoomActionSchema,
  type AddAppointmentServiceActionInput,
  type AppointmentServiceIdActionInput,
  type AssignEmployeeActionInput,
  type AssignRoomActionInput,
} from "@/features/appointments/schemas";

import { addAppointmentService } from "@/server/services/appointments/add-appointment-service";
import { removeAppointmentService } from "@/server/services/appointments/remove-appointment-service";
import { assignEmployeeToService } from "@/server/services/appointments/assign-employee-to-service";
import { assignRoomToService } from "@/server/services/appointments/assign-room-to-service";
import { takeUnassignedService } from "@/server/services/appointments/take-unassigned-service";
import { startAppointmentService } from "@/server/services/appointments/start-appointment-service";
import { completeAppointmentService } from "@/server/services/appointments/complete-appointment-service";
import { checkAddServiceFeasibility } from "@/server/services/appointments/check-add-service-feasibility";

import { revalidateAppointmentViews } from "@/features/appointments/server/revalidate-appointment-views";

const addAppointmentServiceWithResourcesActionSchema =
  addAppointmentServiceActionSchema.extend({
    employeeId: z.string().uuid().optional(),
    roomId: z.string().uuid().optional(),
  });

type AddAppointmentServiceWithResourcesActionInput =
  AddAppointmentServiceActionInput & {
    employeeId?: string;
    roomId?: string;
  };

export async function checkAddAppointmentServiceFeasibilityAction(
  input: AddAppointmentServiceActionInput,
) {
  return runAuthenticatedAction(async (currentUser) => {
    const data = addAppointmentServiceActionSchema.parse(input);

    return checkAddServiceFeasibility(currentUser, {
      appointmentId: data.appointmentId,
      serviceId: data.serviceId,
    });
  });
}

export async function addAppointmentServiceAction(
  input: AddAppointmentServiceWithResourcesActionInput,
) {
  return runAuthenticatedAction(async (currentUser) => {
    const data = addAppointmentServiceWithResourcesActionSchema.parse(input);

    const appointment = await addAppointmentService(currentUser, data);

    const appointmentService = appointment.services.find(
      (service) => service.serviceId === data.serviceId,
    );

    if (!appointmentService) {
      throw new Error(
        "La prestation ajoutée est introuvable après la création.",
      );
    }

    revalidateAppointmentViews(appointment.id);

    return {
      appointmentId: appointment.id,
      appointmentServiceId: appointmentService.id,
    };
  });
}

export async function removeAppointmentServiceAction(
  input: AppointmentServiceIdActionInput,
) {
  return runAuthenticatedAction(async (currentUser) => {
    const data = appointmentServiceIdActionSchema.parse(input);

    const appointment = await removeAppointmentService(currentUser, data);

    revalidateAppointmentViews(appointment.id);

    return {
      appointmentId: appointment.id,
    };
  });
}

export async function assignEmployeeToServiceAction(
  input: AssignEmployeeActionInput,
) {
  return runAuthenticatedAction(async (currentUser) => {
    const data = assignEmployeeActionSchema.parse(input);

    const service = await assignEmployeeToService(currentUser, data);

    revalidateAppointmentViews();

    return {
      appointmentServiceId: service.id,
    };
  });
}

export async function assignRoomToServiceAction(input: AssignRoomActionInput) {
  return runAuthenticatedAction(async (currentUser) => {
    const data = assignRoomActionSchema.parse(input);

    const service = await assignRoomToService(currentUser, data);

    revalidateAppointmentViews();

    return {
      appointmentServiceId: service.id,
    };
  });
}

export async function takeUnassignedServiceAction(
  input: AppointmentServiceIdActionInput,
) {
  return runAuthenticatedAction(async (currentUser) => {
    const data = appointmentServiceIdActionSchema.parse(input);

    const service = await takeUnassignedService(currentUser, data);

    revalidateAppointmentViews();

    return {
      appointmentServiceId: service.id,
    };
  });
}

export async function startAppointmentServiceAction(
  input: AppointmentServiceIdActionInput,
) {
  return runAuthenticatedAction(async (currentUser) => {
    const data = appointmentServiceIdActionSchema.parse(input);

    const service = await startAppointmentService(currentUser, data);

    revalidateAppointmentViews();

    return {
      appointmentServiceId: service.id,
    };
  });
}

export async function completeAppointmentServiceAction(
  input: AppointmentServiceIdActionInput,
) {
  return runAuthenticatedAction(async (currentUser) => {
    const data = appointmentServiceIdActionSchema.parse(input);

    const service = await completeAppointmentService(currentUser, data);

    revalidateAppointmentViews();

    return {
      appointmentServiceId: service.id,
    };
  });
}
