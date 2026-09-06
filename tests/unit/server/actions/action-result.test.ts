import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { actionSuccess, mapActionError } from "@/server/actions/action-result";
import { AuthenticationRequiredError } from "@/server/auth/authentication-error";
import { PermissionDeniedError } from "@/server/permissions/errors";
import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

describe("action result", () => {
  it("creates a serializable success result", () => {
    expect(
      actionSuccess({
        appointmentId: "test",
      }),
    ).toEqual({
      ok: true,
      data: {
        appointmentId: "test",
      },
    });
  });

  it("maps validation errors without leaking internals", () => {
    const schema = z.object({
      appointmentId: z.string().uuid(),
    });

    try {
      schema.parse({
        appointmentId: "invalid",
      });

      throw new Error("Expected parse to fail");
    } catch (error) {
      const result = mapActionError(error);

      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.code).toBe("VALIDATION_ERROR");
        expect(result.fieldErrors?.appointmentId).toBeDefined();
      }
    }
  });

  it("maps authentication errors", () => {
    expect(mapActionError(new AuthenticationRequiredError())).toMatchObject({
      ok: false,
      code: "AUTHENTICATION_REQUIRED",
    });
  });

  it("maps permission errors", () => {
    expect(mapActionError(new PermissionDeniedError())).toMatchObject({
      ok: false,
      code: "PERMISSION_DENIED",
    });
  });

  it("maps not found errors", () => {
    expect(mapActionError(new ResourceNotFoundError("Introuvable"))).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Introuvable",
    });
  });

  it("maps business rules", () => {
    expect(mapActionError(new BusinessRuleError("Conflit"))).toEqual({
      ok: false,
      code: "BUSINESS_RULE",
      message: "Conflit",
    });
  });

  it("hides unexpected error details", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = mapActionError(new Error("secret database detail"));

    expect(result).toEqual({
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Une erreur inattendue est survenue. Veuillez réessayer.",
    });

    spy.mockRestore();
  });
});
