"use server";
import { revalidatePath } from "next/cache";
import { runAuthenticatedAction } from "@/server/actions/run-authenticated-action";
import { publishRealtimeEvent } from "@/server/realtime/publish-realtime-event";
import {
  createRoomActionSchema,
  updateRoomActionSchema,
  type CreateRoomActionInput,
  type UpdateRoomActionInput,
} from "@/features/rooms/schemas/room-schemas";
import { createRoom, updateRoom } from "@/server/services/rooms";
async function revalidateRooms(salonId: string, roomId?: string) {
  revalidatePath("/rooms");
  revalidatePath("/planning");
  revalidatePath("/organize");
  revalidatePath("/appointments", "layout");
  await publishRealtimeEvent({
    salonId,
    type: "room.changed",
    ...(roomId ? { entityId: roomId } : {}),
  });
}
export async function createRoomAction(input: CreateRoomActionInput) {
  return runAuthenticatedAction(async (user) => {
    const room = await createRoom(user, createRoomActionSchema.parse(input));
    await revalidateRooms(user.salonId, room.id);
    return { roomId: room.id };
  });
}
export async function updateRoomAction(input: UpdateRoomActionInput) {
  return runAuthenticatedAction(async (user) => {
    const room = await updateRoom(user, updateRoomActionSchema.parse(input));
    await revalidateRooms(user.salonId, room.id);
    return { roomId: room.id };
  });
}
