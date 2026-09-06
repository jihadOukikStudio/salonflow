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
         * Infrastructure de connexion :
         * pas de logique métier à couvrir.
         */
        "server/db/prisma.ts",

        /*
         * Fichiers barrel / types sans comportement métier exécutable.
         */
        "**/index.ts",
        "**/types.ts",
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
