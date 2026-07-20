import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `next/font/google` only exists as a build-time transform; see the mock.
      "next/font/google": path.resolve(__dirname, "./src/test/next-font-mock.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
