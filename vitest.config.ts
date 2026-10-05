import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // "server-only" throws outside a React Server build. Tests import route handlers directly.
      "server-only": fileURLToPath(new URL("./tests/support/empty.ts", import.meta.url)),
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: { include: ["tests/**/*.test.ts"] },
});
