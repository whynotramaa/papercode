import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      // Chalk and Ink strip color when stdout is not a TTY, which it never is
      // under a test runner. Forcing truecolor lets tests assert that theming
      // was applied at all — without it, every theme renders identically.
      FORCE_COLOR: "3",
    },
  },
});
