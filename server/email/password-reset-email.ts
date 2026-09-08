type PasswordResetEmailInput = {
  to: string;
  resetUrl: string;
  firstName: string;
};

function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.PASSWORD_RESET_EMAIL_FROM?.trim();

  return { apiKey, from };
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
  firstName,
}: PasswordResetEmailInput): Promise<void> {
  const { apiKey, from } = getEmailConfig();

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "PASSWORD_RESET_EMAIL_FROM and RESEND_API_KEY are required in production.",
      );
    }

    // En local/test, aucun email réel n'est envoyé.
    console.info(`[SalonFlow] Reset password for ${to}: ${resetUrl}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Réinitialisation de votre mot de passe SalonFlow",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h2>SalonFlow</h2>
          <p>Bonjour ${escapeHtml(firstName)},</p>
          <p>Une demande de réinitialisation de votre mot de passe a été effectuée.</p>
          <p><a href="${escapeHtml(resetUrl)}">Choisir un nouveau mot de passe</a></p>
          <p>Ce lien expire dans 30 minutes et ne peut être utilisé qu'une seule fois.</p>
          <p>Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.</p>
        </div>
      `,
      text: [
        `Bonjour ${firstName},`,
        "",
        "Une demande de réinitialisation de votre mot de passe SalonFlow a été effectuée.",
        `Choisissez un nouveau mot de passe : ${resetUrl}`,
        "",
        "Ce lien expire dans 30 minutes et ne peut être utilisé qu'une seule fois.",
        "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Resend password reset email failed (${response.status})${body ? `: ${body.slice(0, 300)}` : ""}`,
    );
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
