import { revalidatePath } from "next/cache";

export function revalidateAppointmentViews(appointmentId?: string) {
  revalidatePath("/");
  revalidatePath("/appointments");

  if (appointmentId) {
    revalidatePath(`/appointments/${appointmentId}`);
  }
}
