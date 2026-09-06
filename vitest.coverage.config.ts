import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },

  test: {
    environment: "node",

    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],

    /*
     * Les tests d'intégration partagent actuellement la même DB de test
     * et utilisent cleanDatabase().
     *
     * On reste volontairement séquentiel pour éviter les tests flaky.
     */
    fileParallelism: false,

    testTimeout: 15_000,
    hookTimeout: 15_000,

    coverage: {
      provider: "v8",

      reporter: ["text", "html", "json-summary"],

      include: ["server/**/*.ts", "features/**/*.ts", "lib/**/*.ts"],

      exclude: [
        "**/*.d.ts",
        "app/generated/**",

        /*
         * Infrastructure Prisma.
         */
        "server/db/prisma.ts",

        /*
         * Barrel files et types.
         */
        "**/index.ts",
        "**/*-index.ts",
        "**/types.ts",

        /*
         * Adaptateurs Server Actions Next.js.
         */
        "features/**/server/actions/**",

        /*
         * Read-models principalement exercés par l'interface/E2E.
         */
        "features/dashboard/server/**",
        "features/employees/server/get-employees.ts",
        "features/services/server/get-service-catalog.ts",
        "features/appointments/new/server/get-new-appointment-options.ts",

        /*
         * Infrastructure Next.js.
         */
        "features/appointments/server/revalidate-appointment-views.ts",

        /*
         * Présentation.
         */
        "features/**/components/**",
      ],

      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
