import { z } from "zod";
const roomType = z.enum(["HAMAM", "TREATMENT_ROOM"]);
export const createRoomActionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: roomType,
  capacity: z.coerce.number().int().min(1).max(20),
});
export const updateRoomActionSchema = z.object({
  roomId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  capacity: z.coerce.number().int().min(1).max(20),
  isActive: z.boolean(),
});
export type CreateRoomActionInput = z.input<typeof createRoomActionSchema>;
export type UpdateRoomActionInput = z.input<typeof updateRoomActionSchema>;
