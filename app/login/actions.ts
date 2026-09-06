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
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    return {
      error: "Email ou mot de passe invalide.",
    };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/",
    });

    return {
      error: null,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: "Email ou mot de passe incorrect.",
      };
    }

    throw error;
  }
}
