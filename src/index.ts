#!/usr/bin/env bun
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverPath = path.join(__dirname, "server.js")
const cliPath = path.join(__dirname, "cli.js")

const server = Bun.spawn({
  cmd: [process.execPath, serverPath],
  stdout: "ignore",
  stderr: "pipe",
  env: { ...process.env, PORT: "3000" },
})

const cleanup = () => {
  try { server.kill() } catch {}
}

process.on("exit", cleanup)
process.on("SIGINT", () => { cleanup(); process.exit(0) })
process.on("SIGTERM", () => { cleanup(); process.exit(0) })

await Bun.sleep(400)

const cli = Bun.spawn({
  cmd: [process.execPath, cliPath],
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
  env: { ...process.env },
})

await cli.exited

cleanup()
