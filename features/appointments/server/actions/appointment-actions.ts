"use server";

import { runAuthenticatedAction } from "@/server/actions/run-authenticated-action";

import {
  appointmentIdActionSchema,
  checkBookingFeasibilityActionSchema,
  markAppointmentPaidActionSchema,
  createAppointmentActionSchema,
  createAppointmentWithClientActionSchema,
  updateAppointmentDetailsActionSchema,
  updateAppointmentScheduleActionSchema,
  type AppointmentIdActionInput,
  type CheckBookingFeasibilityActionInput,
  type MarkAppointmentPaidActionInput,
  type CreateAppointmentActionInput,
  type CreateAppointmentWithClientActionInput,
  type UpdateAppointmentDetailsActionInput,
  type UpdateAppointmentScheduleActionInput,
} from "@/features/appointments/schemas";

import { checkBookingFeasibilityInDb } from "@/server/services/appointments/check-booking-feasibility";
import { prisma } from "@/server/db/prisma";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { requirePermission } from "@/server/permissions";

import { createAppointment } from "@/server/services/appointments/create-appointment";
import { createAppointmentWithClient } from "@/server/services/appointments/create-appointment-with-client";
import { updateAppointmentSchedule } from "@/server/services/appointments/update-appointment-schedule";
import { updateAppointmentDetails } from "@/server/services/appointments/update-appointment-details";
import { cancelAppointment } from "@/server/services/appointments/cancel-appointment";
import { markAppointmentPaid } from "@/server/services/appointments/mark-appointment-paid";
import { closeAppointment } from "@/server/services/appointments/close-appointment";

import { revalidateAppointmentViews } from "@/features/appointments/server/revalidate-appointment-views";

export async function checkBookingFeasibilityAction(
  input: CheckBookingFeasibilityActionInput,
) {
  return runAuthenticatedAction(async (currentUser) => {
    const data = checkBookingFeasibilityActionSchema.parse(input);
    const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);
    requirePermission(authoritativeUser, "appointments:create");

    return prisma.$transaction((tx) =>
      checkBookingFeasibilityInDb(tx, {
        salonId: authoritativeUser.salonId,
        scheduledStart: data.scheduledStart,
        serviceIds: data.serviceIds,
      }),
    );
  });
}

export async function createAppointmentAction(
  input: CreateAppointmentActionInput,
) {
  return runAuthenticatedAction(async (currentUser) => {
    const data = createAppointmentActionSchema.parse(input);

    const appointment = await createAppointment(currentUser, data);

    revalidateAppointmentViews(appointment.id);

    return {
      appointmentId: appointment.id,
    };
  });
}

export async function createAppointmentWithClientAction(
  input: CreateAppointmentWithClientActionInput,
) {
  return runAuthenticatedAction(async (currentUser) => {
    const data = createAppointmentWithClientActionSchema.parse(input);

    const result = await createAppointmentWithClient(currentUser, data);

    revalidateAppointmentViews(result.appointment.id);

    return {
      appointmentId: result.appointment.id,
      clientId: result.clientId,
      clientWasCreated: result.clientWasCreated,
    };
  });
}

export async function updateAppointmentScheduleAction(
  input: UpdateAppointmentScheduleActionInput,
) {
  return runAuthenticatedAction(async (currentUser) => {
    const data = updateAppointmentScheduleActionSchema.parse(input);

    const appointment = await updateAppointmentSchedule(currentUser, data);

    revalidateAppointmentViews(appointment.id);

    return {
      appointmentId: appointment.id,
    };
  });
}

export async function updateAppointmentDetailsAction(
  input: UpdateAppointmentDetailsActionInput,
) {
  return runAuthenticatedAction(async (currentUser) => {
    const data = updateAppointmentDetailsActionSchema.parse(input);

    const appointment = await updateAppointmentDetails(currentUser, data);

    revalidateAppointmentViews(appointment.id);

    return {
      appointmentId: appointment.id,
    };
  });
}

export async function cancelAppointmentAction(input: AppointmentIdActionInput) {
  return runAuthenticatedAction(async (currentUser) => {
    const data = appointmentIdActionSchema.parse(input);

    const appointment = await cancelAppointment(currentUser, data);

    revalidateAppointmentViews(appointment.id);

    return {
      appointmentId: appointment.id,
    };
  });
}

export async function markAppointmentPaidAction(
  input: MarkAppointmentPaidActionInput,
) {
  return runAuthenticatedAction(async (currentUser) => {
    const data = markAppointmentPaidActionSchema.parse(input);

    const payment = await markAppointmentPaid(currentUser, data);

    revalidateAppointmentViews(data.appointmentId);

    return {
      appointmentId: data.appointmentId,
      paymentId: payment.id,
      amount: payment.amount.toString(),
    };
  });
}

export async function closeAppointmentAction(input: AppointmentIdActionInput) {
  return runAuthenticatedAction(async (currentUser) => {
    const data = appointmentIdActionSchema.parse(input);

    const appointment = await closeAppointment(currentUser, data);

    revalidateAppointmentViews(appointment.id);

    return {
      appointmentId: appointment.id,
    };
  });
}
