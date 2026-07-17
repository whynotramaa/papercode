import os from "node:os";
import path from "node:path";
import fs from "node:fs";


export function configDir(): string {
  const override = process.env.PAPERCODE_HOME?.trim();
  return override ? override : path.join(os.homedir(), ".papercode");
}

export function authPath(): string {
  return path.join(configDir(), "auth.json");
}

export function settingsPath(): string {
  return path.join(configDir(), "settings.json");
}

export function globalSkillsPath(): string {
  return path.join(configDir(), "skills.json");
}

export function sessionsDir(): string {
  return path.join(configDir(), "sessions");
}

export function sessionPath(id: string): string {
  return path.join(sessionsDir(), `${id}.json`);
}


export function projectSkillsPath(cwd = process.cwd()): string {
  return path.join(cwd, ".papercode", "skills.json");
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}
