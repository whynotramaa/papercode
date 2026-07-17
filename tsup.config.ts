import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.tsx"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  clean: true,
  sourcemap: true,
  // Ink + React must stay external: bundling React breaks its single-instance
  // invariant and Ink's reconciler silently renders nothing.
  external: ["react", "ink", "yoga-wasm-web"],
  banner: { js: "#!/usr/bin/env node" },
});
