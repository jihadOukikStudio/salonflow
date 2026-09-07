const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function required(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`SECURITY: ${name} is required.`);
  }

  return value;
}

export function assertProductionRuntimeSecurity(): void {
  if (process.env.NODE_ENV !== "production") return;

  const databaseUrl = required("DATABASE_URL");
  const authSecret = required("AUTH_SECRET");

  if (authSecret.length < 32) {
    throw new Error(
      "SECURITY: AUTH_SECRET must contain at least 32 characters in production.",
    );
  }

  let database: URL;

  try {
    database = new URL(databaseUrl);
  } catch {
    throw new Error("SECURITY: DATABASE_URL is not a valid URL.");
  }

  if (LOCAL_HOSTS.has(database.hostname)) {
    throw new Error(
      "SECURITY: Production must not use a localhost PostgreSQL database.",
    );
  }

  const databaseName = database.pathname.replace(/^\//, "").toLowerCase();

  if (
    databaseName.includes("test") ||
    databaseName.includes("demo") ||
    databaseName === "salonflow_test"
  ) {
    throw new Error(
      "SECURITY: Production must not use a test or demo database.",
    );
  }
}

export function assertTestDatabaseUrl(databaseUrl: string): void {
  let database: URL;

  try {
    database = new URL(databaseUrl);
  } catch {
    throw new Error("SECURITY: Test DATABASE_URL is not a valid URL.");
  }

  const databaseName = database.pathname.replace(/^\//, "");

  if (databaseName !== "salonflow_test") {
    throw new Error(
      `SECURITY: Tests can only use database "salonflow_test" (received "${databaseName || "<empty>"}").`,
    );
  }
}
