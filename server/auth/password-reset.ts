import { createHash, randomBytes } from "node:crypto";

import { hash } from "bcryptjs";

import { normalizeLoginEmail } from "@/lib/login-identifier";
import { prisma } from "@/server/db/prisma";
import { sendPasswordResetEmail } from "@/server/email/password-reset-email";
import { BusinessRuleError } from "@/server/services/errors";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 60 * 1000;

export const PASSWORD_RESET_GENERIC_MESSAGE =
  "Si un compte actif correspond à cet email, un lien de réinitialisation va être envoyé.";

export type PasswordResetEmailSender = typeof sendPasswordResetEmail;

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getBaseUrl(): string {
  const configured =
    process.env.APP_BASE_URL?.trim() ?? process.env.AUTH_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_BASE_URL (or AUTH_URL) is required in production.");
  }

  return "http://localhost:3000";
}

export async function requestPasswordReset(
  rawEmail: string,
  options: { sendEmail?: PasswordResetEmailSender; now?: Date } = {},
): Promise<void> {
  const email = normalizeLoginEmail(rawEmail);
  if (!email) return;

  const now = options.now ?? new Date();
  const sendEmail = options.sendEmail ?? sendPasswordResetEmail;

  // Comme le login n'a pas de sélecteur de salon, un email partagé par
  // plusieurs comptes est volontairement traité comme ambigu.
  const candidates = await prisma.user.findMany({
    where: {
      email: { equals: email, mode: "insensitive" },
      isActive: true,
      salon: { isActive: true },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
    },
    take: 2,
  });

  if (candidates.length !== 1) return;

  const user = candidates[0];
  if (!user?.email) return;
  const cooldownAfter = new Date(now.getTime() - REQUEST_COOLDOWN_MS);
  const recentToken = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      createdAt: { gte: cooldownAfter },
      usedAt: null,
    },
    select: { id: true },
  });

  // Anti-spam : au maximum une émission par minute et par compte.
  if (recentToken) return;

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const resetUrl = `${getBaseUrl()}/reset-password/${encodeURIComponent(token)}`;

  try {
    await sendEmail({
      to: user.email,
      resetUrl,
      firstName: user.firstName,
    });
  } catch (error) {
    // L'utilisateur reçoit toujours le même message générique afin de ne pas
    // révéler l'existence d'un compte. L'erreur reste visible côté serveur.
    console.error("SalonFlow password reset email delivery failed", error);
  }
}

export async function resetPasswordWithToken(input: {
  token: string;
  password: string;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  const tokenHash = hashResetToken(input.token);
  const passwordHash = await hash(input.password, 12);

  await prisma.$transaction(async (tx) => {
    const resetToken = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        usedAt: true,
        expiresAt: true,
        user: {
          select: {
            isActive: true,
            salon: { select: { isActive: true } },
          },
        },
      },
    });

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt <= now ||
      !resetToken.user.isActive ||
      !resetToken.user.salon.isActive
    ) {
      throw new BusinessRuleError(
        "Ce lien de réinitialisation est invalide ou a expiré.",
      );
    }

    // Le updateMany conditionnel rend l'usage unique robuste face à deux
    // requêtes concurrentes utilisant le même lien.
    const consumed = await tx.passwordResetToken.updateMany({
      where: {
        id: resetToken.id,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });

    if (consumed.count !== 1) {
      throw new BusinessRuleError(
        "Ce lien de réinitialisation est invalide ou a expiré.",
      );
    }

    await tx.user.update({
      where: { id: resetToken.userId },
      data: {
        passwordHash,
        sessionVersion: { increment: 1 },
      },
    });

    // Tous les autres liens encore actifs de ce compte deviennent inutilisables.
    await tx.passwordResetToken.updateMany({
      where: {
        userId: resetToken.userId,
        usedAt: null,
      },
      data: { usedAt: now },
    });
  });
}
