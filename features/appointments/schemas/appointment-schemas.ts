import { z } from "zod";

import {
  dateTimeSchema,
  internalNoteSchema,
  moneySchema,
  positiveDurationSchema,
  uuidSchema,
} from "@/features/appointments/schemas/common";
import {
  clientNameSchema,
  clientPhoneSchema,
} from "@/features/clients/schemas/client-schemas";

const appointmentServiceInputSchema = z
  .object({
    serviceId: uuidSchema,
    durationMinutes: positiveDurationSchema.optional(),
    price: moneySchema.optional(),
  })
  .strict();

const bookingServiceInputSchema = z
  .object({
    serviceId: uuidSchema,
  })
  .strict();

const appointmentServicesSchema = z
  .array(appointmentServiceInputSchema)
  .min(1, "Le rendez-vous doit contenir au moins une prestation.")
  .max(50, "Le rendez-vous contient trop de prestations.");

const bookingServicesSchema = z
  .array(bookingServiceInputSchema)
  .min(1, "Le rendez-vous doit contenir au moins une prestation.")
  .max(50, "Le rendez-vous contient trop de prestations.");

function addDuplicateServiceIssue(
  services: Array<{ serviceId: string }>,
  context: z.RefinementCtx,
) {
  const serviceIds = services.map((service) => service.serviceId);

  if (new Set(serviceIds).size !== serviceIds.length) {
    context.addIssue({
      code: "custom",
      path: ["services"],
      message:
        "Une prestation ne peut être ajoutée qu'une seule fois au rendez-vous.",
    });
  }
}

export const createAppointmentActionSchema = z
  .object({
    clientId: uuidSchema,
    scheduledStart: dateTimeSchema,
    internalNote: internalNoteSchema.optional(),
    services: appointmentServicesSchema,
  })
  .strict()
  .superRefine((value, context) => {
    addDuplicateServiceIssue(value.services, context);
  });

export const createAppointmentWithClientActionSchema = z
  .object({
    client: z.discriminatedUnion("type", [
      z
        .object({
          type: z.literal("existing"),
          clientId: uuidSchema,
        })
        .strict(),
      z
        .object({
          type: z.literal("new"),
          name: clientNameSchema,
          phone: clientPhoneSchema,
        })
        .strict(),
    ]),
    scheduledStart: dateTimeSchema,
    internalNote: internalNoteSchema.optional(),
    services: bookingServicesSchema,
  })
  .strict()
  .superRefine((value, context) => {
    addDuplicateServiceIssue(value.services, context);
  });

export const checkBookingFeasibilityActionSchema = z
  .object({
    scheduledStart: dateTimeSchema,
    serviceIds: z
      .array(uuidSchema)
      .min(1, "Sélectionnez au moins une prestation.")
      .max(50),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.serviceIds).size !== value.serviceIds.length) {
      context.addIssue({
        code: "custom",
        path: ["serviceIds"],
        message: "Une prestation ne peut être ajoutée qu'une seule fois.",
      });
    }
  });

export const updateAppointmentScheduleActionSchema = z
  .object({
    appointmentId: uuidSchema,
    scheduledStart: dateTimeSchema,
  })
  .strict();

export const updateAppointmentDetailsActionSchema = z
  .object({
    appointmentId: uuidSchema,
    clientId: uuidSchema.optional(),
    internalNote: internalNoteSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.clientId === undefined && value.internalNote === undefined) {
      context.addIssue({
        code: "custom",
        path: ["appointmentId"],
        message: "Aucune modification n'a été demandée.",
      });
    }
  });

export const appointmentIdActionSchema = z
  .object({
    appointmentId: uuidSchema,
  })
  .strict();

export const markAppointmentPaidActionSchema = z
  .object({
    appointmentId: uuidSchema,
    amount: moneySchema,
  })
  .strict();

export const addAppointmentServiceActionSchema = z
  .object({
    appointmentId: uuidSchema,
    serviceId: uuidSchema,
    durationMinutes: positiveDurationSchema.optional(),
    price: moneySchema.optional(),
  })
  .strict();

export const appointmentServiceIdActionSchema = z
  .object({
    appointmentServiceId: uuidSchema,
  })
  .strict();

export const assignEmployeeActionSchema = z
  .object({
    appointmentServiceId: uuidSchema,
    employeeId: uuidSchema,
  })
  .strict();

export const assignRoomActionSchema = z
  .object({
    appointmentServiceId: uuidSchema,
    roomId: uuidSchema,
  })
  .strict();

export const createParallelGroupActionSchema = z
  .object({
    appointmentId: uuidSchema,
    appointmentServiceIds: z
      .array(uuidSchema)
      .min(2, "Un groupe parallèle doit contenir au moins deux prestations.")
      .max(50, "Le groupe parallèle contient trop de prestations."),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      new Set(value.appointmentServiceIds).size !==
      value.appointmentServiceIds.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["appointmentServiceIds"],
        message:
          "Une prestation ne peut apparaître qu'une seule fois dans le groupe.",
      });
    }
  });

export const removeParallelGroupActionSchema = z
  .object({
    parallelGroupId: uuidSchema,
  })
  .strict();

export type CreateAppointmentActionInput = z.input<
  typeof createAppointmentActionSchema
>;
export type CreateAppointmentWithClientActionInput = z.input<
  typeof createAppointmentWithClientActionSchema
>;
export type UpdateAppointmentScheduleActionInput = z.input<
  typeof updateAppointmentScheduleActionSchema
>;
export type UpdateAppointmentDetailsActionInput = z.input<
  typeof updateAppointmentDetailsActionSchema
>;
export type AppointmentIdActionInput = z.input<
  typeof appointmentIdActionSchema
>;
export type MarkAppointmentPaidActionInput = z.input<
  typeof markAppointmentPaidActionSchema
>;
export type AddAppointmentServiceActionInput = z.input<
  typeof addAppointmentServiceActionSchema
>;
export type AppointmentServiceIdActionInput = z.input<
  typeof appointmentServiceIdActionSchema
>;
export type AssignEmployeeActionInput = z.input<
  typeof assignEmployeeActionSchema
>;
export type AssignRoomActionInput = z.input<typeof assignRoomActionSchema>;
export type CreateParallelGroupActionInput = z.input<
  typeof createParallelGroupActionSchema
>;
export type RemoveParallelGroupActionInput = z.input<
  typeof removeParallelGroupActionSchema
>;

export type CheckBookingFeasibilityActionInput = z.input<
  typeof checkBookingFeasibilityActionSchema
>;
