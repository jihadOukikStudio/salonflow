import { revalidatePath } from "next/cache";

import { publishRealtimeEvent } from "@/server/realtime/publish-realtime-event";

export async function revalidateAppointmentViews(
  salonId: string,
  appointmentId?: string,
) {
  revalidatePath("/");
  revalidatePath("/appointments");

  if (appointmentId) {
    revalidatePath(`/appointments/${appointmentId}`);
  }

  await publishRealtimeEvent({
    salonId,
    type: "appointment.changed",
    ...(appointmentId ? { entityId: appointmentId } : {}),
  });
}
