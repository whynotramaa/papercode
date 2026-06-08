#!/usr/bin/env bun
import { resolve } from "path"
import { fileURLToPath } from "url"

const __dirname = fileURLToPath(new URL(".", import.meta.url))
const serverPath = resolve(__dirname, "../dist/server.js")
const cliPath = resolve(__dirname, "../dist/cli.js")

const server = Bun.spawn({
  cmd: [process.execPath, serverPath],
  stdout: "ignore",
  stderr: "pipe",
  env: { ...process.env, PORT: "3000" },
})

const cleanup = () => { try { server.kill() } catch {} }
process.on("exit", cleanup)
process.on("SIGINT", () => { cleanup(); process.exit(0) })
process.on("SIGTERM", () => { cleanup(); process.exit(0) })

// Forward server stderr in background so startup errors are visible
;(async () => {
  for await (const chunk of server.stderr) {
    process.stderr.write(chunk)
  }
})()

// Poll until server is ready (up to 10s)
const deadline = Date.now() + 10_000
let ready = false
while (Date.now() < deadline) {
  const exited = await Promise.race([
    server.exited.then(() => true),
    Bun.sleep(100).then(() => false),
  ])
  if (exited) {
    process.stderr.write("papercode server failed to start\n")
    process.exit(1)
  }
  try {
    const res = await fetch("http://localhost:3000/sessions", { signal: AbortSignal.timeout(500) })
    if (res.status < 500) { ready = true; break }
  } catch { /* not ready yet */ }
}

if (!ready) {
  process.stderr.write("papercode server did not become ready in time\n")
  process.exit(1)
}

const cli = Bun.spawn({
  cmd: [process.execPath, cliPath],
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
  env: { ...process.env },
})

await cli.exited
cleanup()
