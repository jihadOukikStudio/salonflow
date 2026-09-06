"use server";
import { revalidatePath } from "next/cache";
import { runAuthenticatedAction } from "@/server/actions/run-authenticated-action";
import {
  createRoomActionSchema,
  updateRoomActionSchema,
  type CreateRoomActionInput,
  type UpdateRoomActionInput,
} from "@/features/rooms/schemas/room-schemas";
import { createRoom, updateRoom } from "@/server/services/rooms";
function revalidateRooms() {
  revalidatePath("/rooms");
  revalidatePath("/planning");
  revalidatePath("/organize");
  revalidatePath("/appointments", "layout");
}
export async function createRoomAction(input: CreateRoomActionInput) {
  return runAuthenticatedAction(async (user) => {
    const room = await createRoom(user, createRoomActionSchema.parse(input));
    revalidateRooms();
    return { roomId: room.id };
  });
}
export async function updateRoomAction(input: UpdateRoomActionInput) {
  return runAuthenticatedAction(async (user) => {
    const room = await updateRoom(user, updateRoomActionSchema.parse(input));
    revalidateRooms();
    return { roomId: room.id };
  });
}
