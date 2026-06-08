import { $ } from "bun"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("Error: DATABASE_URL env var is required for build")
  console.error("Usage: DATABASE_URL=<neon_url> bun run build")
  process.exit(1)
}

console.log("→ Generating Prisma client...")
await $`bunx prisma generate`.cwd("packages/database")

console.log("→ Building server...")
const serverResult = await Bun.build({
  entrypoints: ["packages/server/src/index.ts"],
  outdir: "dist",
  naming: "server.js",
  target: "bun",
  define: {
    "process.env.DATABASE_URL": JSON.stringify(databaseUrl),
  },
})
if (!serverResult.success) {
  console.error("Server build failed:", serverResult.logs)
  process.exit(1)
}

console.log("→ Building CLI...")
const cliResult = await Bun.build({
  entrypoints: ["packages/cli/src/index.tsx"],
  outdir: "dist",
  naming: "cli.js",
  target: "bun",
  external: [
    "@opentui/core-darwin-x64",
    "@opentui/core-darwin-arm64",
    "@opentui/core-linux-x64",
    "@opentui/core-linux-x64-musl",
    "@opentui/core-linux-arm64",
    "@opentui/core-linux-arm64-musl",
    "@opentui/core-win32-x64",
    "@opentui/core-win32-arm64",
  ],
})
if (!cliResult.success) {
  console.error("CLI build failed:", cliResult.logs)
  process.exit(1)
}

console.log("✓ Build complete → dist/server.js, dist/cli.js")
