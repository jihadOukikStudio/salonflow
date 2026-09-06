import { ZodError } from "zod";

import { AuthenticationRequiredError } from "@/server/auth/authentication-error";
import { PermissionDeniedError } from "@/server/permissions/errors";
import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

export type ActionFieldErrors = Record<string, string[]>;

export type ActionSuccess<TData = undefined> = {
  ok: true;
  data: TData;
};

export type ActionFailure = {
  ok: false;
  code:
    | "VALIDATION_ERROR"
    | "AUTHENTICATION_REQUIRED"
    | "PERMISSION_DENIED"
    | "NOT_FOUND"
    | "BUSINESS_RULE"
    | "INTERNAL_ERROR";
  message: string;
  fieldErrors?: ActionFieldErrors;
};

export type ActionResult<TData = undefined> =
  ActionSuccess<TData> | ActionFailure;

export function actionSuccess<TData>(data: TData): ActionSuccess<TData> {
  return {
    ok: true,
    data,
  };
}

export function mapActionError(error: unknown): ActionFailure {
  if (error instanceof ZodError) {
    const flattened = error.flatten();

    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Certaines informations sont invalides.",
      fieldErrors: flattened.fieldErrors as ActionFieldErrors,
    };
  }

  if (error instanceof AuthenticationRequiredError) {
    return {
      ok: false,
      code: "AUTHENTICATION_REQUIRED",
      message: error.message,
    };
  }

  if (error instanceof PermissionDeniedError) {
    return {
      ok: false,
      code: "PERMISSION_DENIED",
      message: error.message,
    };
  }

  if (error instanceof ResourceNotFoundError) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: error.message,
    };
  }

  if (error instanceof BusinessRuleError) {
    return {
      ok: false,
      code: "BUSINESS_RULE",
      message: error.message,
    };
  }

  console.error("Unexpected SalonFlow server action error", error);

  return {
    ok: false,
    code: "INTERNAL_ERROR",
    message: "Une erreur inattendue est survenue. Veuillez réessayer.",
  };
}
