import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["tests/**/*.test.ts"],
    watch: false,
    globals: true,
    setupFiles: ["tests/setup.ts"],
  },
});
