"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { executeSupportCommand } from "@/server/platform/support";
import { PermissionDeniedError } from "@/server/permissions/errors";
import { ResourceNotFoundError } from "@/server/services/errors";
import type { PlatformFormState } from "@/app/superadmin/actions";
export async function supportAction(
  _previous: PlatformFormState,
  data: FormData,
): Promise<PlatformFormState> {
  try {
    await executeSupportCommand(Object.fromEntries(data));
    revalidatePath("/support");
    revalidatePath("/superadmin", "layout");
    return { ok: true, message: "Votre message a été enregistré." };
  } catch (error) {
    if (
      error instanceof PermissionDeniedError ||
      error instanceof ResourceNotFoundError
    )
      return { ok: false, message: error.message };
    return {
      ok: false,
      message:
        error instanceof ZodError
          ? "Vérifiez les champs obligatoires et leur longueur."
          : "Impossible de confirmer l’envoi. Actualisez avant de réessayer.",
    };
  }
}
