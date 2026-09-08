"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/auth";

export type LoginActionState = {
  error: string | null;
};

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const identifier = formData.get("identifier") ?? formData.get("email");
  const password = formData.get("password");

  if (typeof identifier !== "string" || typeof password !== "string") {
    return {
      error: "Téléphone, email ou mot de passe invalide.",
    };
  }

  try {
    await signIn("credentials", {
      identifier,
      password,
      redirectTo: "/",
    });

    return {
      error: null,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: "Téléphone, email ou mot de passe incorrect.",
      };
    }

    throw error;
  }
}
