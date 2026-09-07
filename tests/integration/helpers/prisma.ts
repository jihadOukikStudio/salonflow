import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/app/generated/prisma/client";
import { assertTestDatabaseUrl } from "@/server/config/security-env";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for integration tests.");
}

assertTestDatabaseUrl(connectionString);

const adapter = new PrismaPg({
  connectionString,
});

export const testPrisma = new PrismaClient({
  adapter,
});
