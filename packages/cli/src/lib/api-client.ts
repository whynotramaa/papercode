import { hc } from "hono/client";
import type { AppType } from "@papercode/server";

let machineId = "anonymous"

export function setMachineId(id: string) {
  machineId = id
}

export const apiClient = hc<AppType>(
  process.env.API_URL ?? "http://localhost:3000",
  {
    headers: () => ({ "x-machine-id": machineId }),
  }
)
