import "dotenv/config";

import { assertProductionRuntimeSecurity } from "../server/config/security-env";

if (process.env.NODE_ENV !== "production") {
  throw new Error(
    "SECURITY: run this check with NODE_ENV=production and production environment variables.",
  );
}

assertProductionRuntimeSecurity();

console.log("✓ Production environment security checks passed.");
console.log(
  "✓ DATABASE_URL is configured and does not target localhost/test/demo.",
);
console.log("✓ AUTH_SECRET is configured with a minimum secure length.");
