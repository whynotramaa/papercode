import fs from "node:fs";
import path from "node:path";
import { ensureDir } from "./paths.js";


export function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}


export function writeJson(file: string, data: unknown, mode?: number): void {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", {
    encoding: "utf8",
    ...(mode === undefined ? {} : { mode }),
  });
  fs.renameSync(tmp, file);
}
