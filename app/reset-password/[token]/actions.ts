"use server";

import { resetPasswordSchema } from "@/features/auth/schemas/password-reset-schemas";
import { resetPasswordWithToken } from "@/server/auth/password-reset";
import { BusinessRuleError } from "@/server/services/errors";

export type ResetPasswordActionState = {
  success: boolean;
  error: string | null;
};

export async function resetPasswordAction(
  _previousState: ResetPasswordActionState,
  formData: FormData,
): Promise<ResetPasswordActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    const error =
      flattened.fieldErrors.password?.[0] ??
      flattened.fieldErrors.passwordConfirmation?.[0] ??
      flattened.fieldErrors.token?.[0] ??
      "Certaines informations sont invalides.";

    return { success: false, error };
  }

  try {
    await resetPasswordWithToken({
      token: parsed.data.token,
      password: parsed.data.password,
    });
    return { success: true, error: null };
  } catch (error) {
    if (error instanceof BusinessRuleError) {
      return { success: false, error: error.message };
    }
    console.error("SalonFlow password reset failed", error);
    return {
      success: false,
      error: "Impossible de réinitialiser le mot de passe. Veuillez réessayer.",
    };
  }
}
