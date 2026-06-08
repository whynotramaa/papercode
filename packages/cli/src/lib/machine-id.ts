import { homedir } from "os"
import { join } from "path"

const CONFIG_PATH = join(homedir(), ".papercode", "config.json")

let cached: string | null = null

export async function getMachineId(): Promise<string> {
  if (cached) return cached

  try {
    const file = Bun.file(CONFIG_PATH)
    if (await file.exists()) {
      const config = await file.json()
      if (typeof config.machineId === "string") {
        cached = config.machineId
        return cached!
      }
    }
  } catch {}

  const machineId = crypto.randomUUID()
  await Bun.write(CONFIG_PATH, JSON.stringify({ machineId }, null, 2))
  cached = machineId
  return machineId
}
