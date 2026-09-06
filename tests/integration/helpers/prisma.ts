import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/app/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for integration tests.");
}

if (!connectionString.includes("salonflow_test")) {
  throw new Error(
    "SECURITY: Integration tests can only run against the salonflow_test database.",
  );
}

const adapter = new PrismaPg({
  connectionString,
});

export const testPrisma = new PrismaClient({
  adapter,
});
