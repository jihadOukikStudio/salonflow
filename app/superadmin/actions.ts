"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { executePlatformCommand } from "@/server/platform/commands";
import { AuthenticationRequiredError } from "@/server/auth/authentication-error";
import { PermissionDeniedError } from "@/server/permissions/errors";
import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

export type PlatformFormState = { ok: boolean; message: string };
export async function platformAction(
  _previous: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  try {
    await executePlatformCommand(Object.fromEntries(formData));
    revalidatePath("/superadmin", "layout");
    const messages: Record<string, string> = {
      createSalon:
        "Salon créé en préparation. Ouvrez sa fiche, ajoutez une gérante, puis activez le salon pour autoriser les connexions.",
      createManager:
        "Compte gérante créé. La connexion sera possible si le salon est actif. Vérifiez le bloc État et accès du salon.",
      createDue:
        "Échéance ajoutée. Elle sera réglée après rapprochement avec un paiement reçu.",
      settleDue:
        "Échéance réglée : paiement rapproché sans créer un nouvel encaissement.",
      voidPayment:
        "Paiement annulé. Son éventuelle échéance est à nouveau ouverte.",
    };
    return {
      ok: true,
      message:
        messages[String(formData.get("kind"))] ?? "Modification enregistrée.",
    };
  } catch (error) {
    if (error instanceof ZodError)
      return {
        ok: false,
        message:
          "Vérifiez les champs : " +
          error.issues
            .map((issue) => `${issue.path.join(".")} — ${issue.message}`)
            .join(" ; "),
      };
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof PermissionDeniedError ||
      error instanceof BusinessRuleError ||
      error instanceof ResourceNotFoundError
    )
      return { ok: false, message: error.message };
    const code =
      error && typeof error === "object" && "code" in error ? error.code : null;
    if (code === "P2002")
      return {
        ok: false,
        message: "Cette entrée existe déjà ou ce paiement a déjà été affecté.",
      };
    if (code === "P2034")
      return {
        ok: false,
        message:
          "Une modification simultanée a eu lieu. Actualisez puis réessayez.",
      };
    // No raw database errors: they can include credentials from a failed insert.
    console.error(
      "Platform action failed",
      typeof code === "string" ? code : "UNKNOWN",
    );
    return {
      ok: false,
      message:
        "Impossible de confirmer l'enregistrement. Actualisez pour vérifier le résultat avant de réessayer.",
    };
  }
}
