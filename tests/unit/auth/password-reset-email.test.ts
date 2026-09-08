import { afterEach, describe, expect, it, vi } from "vitest";

import { sendPasswordResetEmail } from "@/server/email/password-reset-email";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("sendPasswordResetEmail", () => {
  it("does not call the network without configuration outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("PASSWORD_RESET_EMAIL_FROM", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    await sendPasswordResetEmail({
      to: "gerante@example.com",
      resetUrl: "http://localhost/reset-password/token",
      firstName: "Amina",
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends through the Resend HTTP API when configured", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("PASSWORD_RESET_EMAIL_FROM", "SalonFlow <test@example.com>");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await sendPasswordResetEmail({
      to: "gerante@example.com",
      resetUrl: "https://salon.test/reset-password/a&b",
      firstName: '<Amina & "Co">',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer re_test" });
    expect(String(init?.body)).toContain("gerante@example.com");
    expect(String(init?.body)).toContain("&lt;Amina &amp; &quot;Co&quot;&gt;");
    expect(String(init?.body)).toContain("a&amp;b");
  });

  it("throws when Resend rejects the request", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("PASSWORD_RESET_EMAIL_FROM", "SalonFlow <test@example.com>");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("provider-error", { status: 500 }),
    );

    await expect(
      sendPasswordResetEmail({
        to: "gerante@example.com",
        resetUrl: "https://salon.test/reset-password/token",
        firstName: "Amina",
      }),
    ).rejects.toThrow(/Resend password reset email failed/);
  });
});
