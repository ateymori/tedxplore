import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `next/font/google` only exists as a build-time transform; see the mock.
      "next/font/google": path.resolve(__dirname, "./src/testing/next-font-mock.ts"),
    },
  },
  test: {
    environment: "node",
    // `.tsx` too: the template's fallback rules (FR-38 vs BR-13) are assertions
    // about rendered output, so they are tested by rendering the real renderer
    // through `react-dom/server` rather than by testing the predicate alone.
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
