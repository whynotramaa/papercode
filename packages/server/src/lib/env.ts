import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, "../../../.env"), override: true });

if (!process.env.OPENCODE_ZEN_API_KEY && !process.env.OPENCODE_API_KEY) {
  throw new Error("OPENCODE_ZEN_API_KEY is not set. Add it to the root .env file.");
}
