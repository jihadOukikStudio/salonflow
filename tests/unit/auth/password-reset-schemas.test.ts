import { describe, expect, it } from "vitest";

import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/features/auth/schemas/password-reset-schemas";

describe("password reset schemas", () => {
  it("normalizes a valid email", () => {
    expect(
      forgotPasswordSchema.parse({ email: "  GERANTE@Example.COM " }).email,
    ).toBe("gerante@example.com");
  });

  it("rejects an invalid email", () => {
    expect(() =>
      forgotPasswordSchema.parse({ email: "not-an-email" }),
    ).toThrow();
  });

  it("accepts matching passwords of at least 12 characters", () => {
    const result = resetPasswordSchema.parse({
      token: "x".repeat(32),
      password: "NouveauMotDePasse!",
      passwordConfirmation: "NouveauMotDePasse!",
    });

    expect(result.password).toBe("NouveauMotDePasse!");
  });

  it("rejects a short password", () => {
    expect(() =>
      resetPasswordSchema.parse({
        token: "x".repeat(32),
        password: "Court!",
        passwordConfirmation: "Court!",
      }),
    ).toThrow();
  });

  it("rejects different confirmation", () => {
    expect(() =>
      resetPasswordSchema.parse({
        token: "x".repeat(32),
        password: "NouveauMotDePasse!",
        passwordConfirmation: "AutreMotDePasse!",
      }),
    ).toThrow();
  });
});
