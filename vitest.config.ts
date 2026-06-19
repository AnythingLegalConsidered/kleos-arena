import { defineConfig } from "vitest/config";

// Standalone test config: deliberately does NOT load the devvit Vite plugin.
// The sim is pure TS, so tests run in a plain Node environment. Test files live
// under test/ (outside src/) so they are ignored by `tsc --build` and `npm run lint`.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
