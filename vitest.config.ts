import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },

  test: {
    environment: "node",

    include: ["tests/unit/**/*.test.ts"],

    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],

      include: ["server/**/*.ts", "features/**/*.ts", "lib/**/*.ts"],

      exclude: ["**/*.d.ts", "app/generated/**", "server/db/prisma.ts"],

      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
