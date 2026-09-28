import { createHash } from "node:crypto";
import { prisma } from "@/server/db/prisma";
const WINDOW_MS = 15 * 60_000;
export const LOGIN_ATTEMPT_LIMIT = 20;

export async function allowLoginAttempt(email: string): Promise<boolean> {
  const key = createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex");
  const now = new Date();
  const expires = new Date(now.getTime() + WINDOW_MS);
  const rows = await prisma.$queryRaw<Array<{ attempts: number }>>`
    INSERT INTO "login_throttles" ("key", "attempts", "expiresAt") VALUES (${key}, 1, ${expires})
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "login_throttles"."expiresAt" <= ${now} THEN 1 ELSE LEAST("login_throttles"."attempts" + 1, 1000000) END,
      "expiresAt" = CASE WHEN "login_throttles"."expiresAt" <= ${now} THEN ${expires} ELSE "login_throttles"."expiresAt" END
    RETURNING "attempts"`;
  // Indexed housekeeping; no cleartext email or password stored.
  await prisma.loginThrottle.deleteMany({
    where: { expiresAt: { lt: new Date(now.getTime() - 24 * 60 * 60_000) } },
  });
  return rows[0]?.attempts <= LOGIN_ATTEMPT_LIMIT;
}
