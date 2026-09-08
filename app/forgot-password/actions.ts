"use server";

import { forgotPasswordSchema } from "@/features/auth/schemas/password-reset-schemas";
import {
  PASSWORD_RESET_GENERIC_MESSAGE,
  requestPasswordReset,
} from "@/server/auth/password-reset";

export type ForgotPasswordActionState = {
  success: boolean;
  message: string | null;
  error: string | null;
};

export async function forgotPasswordAction(
  _previousState: ForgotPasswordActionState,
  formData: FormData,
): Promise<ForgotPasswordActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: null,
      error:
        parsed.error.flatten().fieldErrors.email?.[0] ??
        "Saisissez une adresse email valide.",
    };
  }

  await requestPasswordReset(parsed.data.email);

  return {
    success: true,
    message: PASSWORD_RESET_GENERIC_MESSAGE,
    error: null,
  };
}
