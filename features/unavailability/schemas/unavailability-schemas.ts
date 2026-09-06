import { z } from "zod";
const isoDate = z
  .union([z.date(), z.string().datetime({ offset: true })])
  .transform((v) => (v instanceof Date ? v : new Date(v)));
export const createEmployeeUnavailabilityActionSchema = z
  .object({
    employeeId: z.string().uuid(),
    type: z.enum(["ABSENCE", "BREAK", "LEAVE", "UNAVAILABLE"]),
    startAt: isoDate,
    endAt: isoDate,
    note: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.endAt <= v.startAt)
      ctx.addIssue({
        code: "custom",
        path: ["endAt"],
        message: "La fin doit être après le début.",
      });
  });
export const deleteEmployeeUnavailabilityActionSchema = z.object({
  id: z.string().uuid(),
});
export const createRoomUnavailabilityActionSchema = z
  .object({
    roomId: z.string().uuid(),
    startAt: isoDate,
    endAt: isoDate,
    reason: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.endAt <= v.startAt)
      ctx.addIssue({
        code: "custom",
        path: ["endAt"],
        message: "La fin doit être après le début.",
      });
  });
export const deleteRoomUnavailabilityActionSchema = z.object({
  id: z.string().uuid(),
});
export type CreateEmployeeUnavailabilityActionInput = z.input<
  typeof createEmployeeUnavailabilityActionSchema
>;
export type CreateRoomUnavailabilityActionInput = z.input<
  typeof createRoomUnavailabilityActionSchema
>;
