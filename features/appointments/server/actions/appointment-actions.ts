"use server";

import { runAuthenticatedAction } from "@/server/actions/run-authenticated-action";
import { casablancaLocalDateTimeToIso } from "@/features/appointments/lib/casablanca-local-datetime";

import {
  appointmentIdActionSchema,
  checkBookingFeasibilityActionSchema,
  markAppointmentPaidActionSchema,
  createAppointmentActionSchema,
  createAppointmentWithClientActionSchema,
  createPlannedAppointmentActionSchema,
  updateAppointmentDetailsActionSchema,
  updateAppointmentScheduleActionSchema,
  type AppointmentIdActionInput,
  type CheckBookingFeasibilityActionInput,
  type MarkAppointmentPaidActionInput,
  type CreateAppointmentActionInput,
  type CreateAppointmentWithClientActionInput,
  type CreatePlannedAppointmentActionInput,
  type UpdateAppointmentDetailsActionInput,
  type UpdateAppointmentScheduleActionInput,
} from "@/features/appointments/schemas";

import { checkBookingFeasibilityInDb } from "@/server/services/appointments/check-booking-feasibility";
import { findNextAvailableSlotsInDb } from "@/server/services/appointments/find-next-available-slots";
import { prisma } from "@/server/db/prisma";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { requirePermission } from "@/server/permissions";

import { createAppointment } from "@/server/services/appointments/create-appointment";
import { createAppointmentWithClient } from "@/server/services/appointments/create-appointment-with-client";
import { createPlannedAppointment } from "@/server/services/appointments/create-planned-appointment";
import { updateAppointmentSchedule } from "@/server/services/appointments/update-appointment-schedule";
import { updateAppointmentDetails } from "@/server/services/appointments/update-appointment-details";
import { cancelAppointment } from "@/server/services/appointments/cancel-appointment";
import { markAppointmentPaid } from "@/server/services/appointments/mark-appointment-paid";
import { closeAppointment } from "@/server/services/appointments/close-appointment";

import { revalidateAppointmentViews } from "@/features/appointments/server/revalidate-appointment-views";

function resolveCasablancaScheduledStart(input: {
  scheduledStart: Date;
  dateKey?: string;
  timeValue?: string;
}): Date {
  if (input.dateKey && input.timeValue) {
    return new Date(
      casablancaLocalDateTimeToIso(input.dateKey, input.timeValue),
    );
  }

  return input.scheduledStart;
}

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
        scheduledStart: resolveCasablancaScheduledStart(data),
        serviceIds: data.serviceIds,
      }),
    );
  });
}

export async function findNextAvailableSlotsAction(
  input: CheckBookingFeasibilityActionInput,
) {
  return runAuthenticatedAction(async (currentUser) => {
    const data = checkBookingFeasibilityActionSchema.parse(input);
    const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);
    requirePermission(authoritativeUser, "appointments:create");

    return prisma.$transaction((tx) =>
      findNextAvailableSlotsInDb(tx, {
        salonId: authoritativeUser.salonId,
        scheduledStart: resolveCasablancaScheduledStart(data),
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

    await revalidateAppointmentViews(currentUser.salonId, appointment.id);

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
    const scheduledStart = resolveCasablancaScheduledStart(data);

    const result = await createAppointmentWithClient(currentUser, {
      client: data.client,
      scheduledStart,
      internalNote: data.internalNote,
      services: data.services,
    });

    await revalidateAppointmentViews(
      currentUser.salonId,
      result.appointment.id,
    );

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

    await revalidateAppointmentViews(currentUser.salonId, appointment.id);

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

    await revalidateAppointmentViews(currentUser.salonId, appointment.id);

    return {
      appointmentId: appointment.id,
    };
  });
}

export async function cancelAppointmentAction(input: AppointmentIdActionInput) {
  return runAuthenticatedAction(async (currentUser) => {
    const data = appointmentIdActionSchema.parse(input);

    const appointment = await cancelAppointment(currentUser, data);

    await revalidateAppointmentViews(currentUser.salonId, appointment.id);

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

    await revalidateAppointmentViews(currentUser.salonId, data.appointmentId);

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

    await revalidateAppointmentViews(currentUser.salonId, appointment.id);

    return {
      appointmentId: appointment.id,
    };
  });
}

export async function createPlannedAppointmentAction(
  input: CreatePlannedAppointmentActionInput,
) {
  return runAuthenticatedAction(async (currentUser) => {
    const data = createPlannedAppointmentActionSchema.parse(input);
    const appointment = await createPlannedAppointment(currentUser, data);
    await revalidateAppointmentViews(currentUser.salonId, appointment.id);
    return { appointmentId: appointment.id };
  });
}
