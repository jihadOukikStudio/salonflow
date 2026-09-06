import { z } from "zod";
import {
  clientNameSchema,
  clientPhoneSchema,
} from "@/features/clients/schemas/client-schemas";

export const updateClientActionSchema = z.object({
  clientId: z.string().uuid(),
  name: clientNameSchema,
  phone: clientPhoneSchema,
  internalNote: z.string().trim().max(2000).nullable().optional(),
});

export const setClientActiveActionSchema = z.object({
  clientId: z.string().uuid(),
  isActive: z.boolean(),
});

export type UpdateClientActionInput = z.input<typeof updateClientActionSchema>;
export type SetClientActiveActionInput = z.input<
  typeof setClientActiveActionSchema
>;
