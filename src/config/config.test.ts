import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { authPath, configDir, sessionsDir } from "./paths.js";
import { loadAuth, upsertProvider, removeProvider, getProvider, normalizeBaseURL } from "./auth.js";
import { loadSettings, updateSettings } from "./settings.js";
import {
  loadSkills,
  isReserved,
  RESERVED_NAMES,
  saveSkill,
  deleteSkill,
  parseSkillsJson,
  importSkills,
} from "./skills.js";
import { createSession, saveSession, loadSession, listSessions, deleteSession, deriveTitle } from "../sessions/store.js";
import type { ChatMessage } from "../agent/messages.js";

let home: string;
let project: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "papercode-home-"));
  project = fs.mkdtempSync(path.join(os.tmpdir(), "papercode-proj-"));
  process.env.PAPERCODE_HOME = home;
});

afterEach(() => {
  delete process.env.PAPERCODE_HOME;
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(project, { recursive: true, force: true });
});

describe("configDir", () => {
  it("honours PAPERCODE_HOME", () => {
    expect(configDir()).toBe(home);
  });

  it("treats an empty PAPERCODE_HOME as unset instead of resolving to the filesystem root", () => {
    process.env.PAPERCODE_HOME = "";
    expect(configDir()).toBe(path.join(os.homedir(), ".papercode"));
  });
});

describe("auth store", () => {
  const provider = { name: "openai", baseURL: "https://api.openai.com/v1", apiKey: "sk-test", models: ["gpt-4o"] };

  it("round-trips a provider", () => {
    upsertProvider(provider);
    expect(getProvider("openai")).toMatchObject({ name: "openai", apiKey: "sk-test" });
  });

  it("updates in place rather than duplicating on the same name", () => {
    upsertProvider(provider);
    upsertProvider({ ...provider, apiKey: "sk-new" });
    expect(loadAuth().providers).toHaveLength(1);
    expect(getProvider("openai")?.apiKey).toBe("sk-new");
  });

  it("removes a provider and reports whether it existed", () => {
    upsertProvider(provider);
    expect(removeProvider("openai")).toBe(true);
    expect(removeProvider("openai")).toBe(false);
    expect(getProvider("openai")).toBeUndefined();
  });

  it("returns an empty list when auth.json is corrupt instead of throwing", () => {
    fs.writeFileSync(authPath(), "{ garbage");
    expect(loadAuth().providers).toEqual([]);
  });

  it.skipIf(process.platform === "win32")("writes auth.json owner-only", () => {
    upsertProvider(provider);
    const mode = fs.statSync(authPath()).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("does not leave the temp file behind after an atomic write", () => {
    upsertProvider(provider);
    const strays = fs.readdirSync(home).filter((f) => f.includes(".tmp"));
    expect(strays).toEqual([]);
  });
});

describe("normalizeBaseURL", () => {
  it("strips trailing slashes and a pasted /chat/completions suffix", () => {
    expect(normalizeBaseURL("https://api.openai.com/v1/")).toBe("https://api.openai.com/v1");
    expect(normalizeBaseURL("https://api.openai.com/v1/chat/completions")).toBe("https://api.openai.com/v1");
    expect(normalizeBaseURL("  https://x.dev/v1  ")).toBe("https://x.dev/v1");
  });
});

describe("settings", () => {
  it("defaults the theme and persists an update", () => {
    expect(loadSettings().theme).toBe("carbon");
    updateSettings({ theme: "nord", activeModel: "m" });
    expect(loadSettings()).toMatchObject({ theme: "nord", activeModel: "m" });
  });

  it("falls back to the default theme when the stored one no longer exists", () => {
    fs.writeFileSync(path.join(home, "settings.json"), JSON.stringify({ theme: "theme-that-was-removed" }));
    expect(loadSettings().theme).toBe("carbon");
  });
});

describe("skills", () => {
  function writeSkills(dir: string, skills: unknown) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "skills.json"), JSON.stringify(skills));
  }

  it("loads global skills", () => {
    writeSkills(home, [{ name: "review", description: "d", prompt: "p" }]);
    const { skills } = loadSkills(project);
    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({ name: "review", source: "global" });
  });

  it("lets a project skill override a global one of the same name", () => {
    writeSkills(home, [{ name: "review", description: "global", prompt: "g" }]);
    writeSkills(path.join(project, ".papercode"), [{ name: "review", description: "project", prompt: "p" }]);

    const { skills } = loadSkills(project);
    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({ prompt: "p", source: "project" });
  });

  it("merges distinct skills from both scopes", () => {
    writeSkills(home, [{ name: "a", prompt: "p", description: "" }]);
    writeSkills(path.join(project, ".papercode"), [{ name: "b", prompt: "p", description: "" }]);
    expect(loadSkills(project).skills.map((s) => s.name)).toEqual(["a", "b"]);
  });

  it("rejects a skill that shadows a built-in command", () => {
    writeSkills(home, [{ name: "new", prompt: "p", description: "" }]);
    const { skills, errors } = loadSkills(project);
    expect(skills).toHaveLength(0);
    expect(errors[0]).toContain("built-in command name");
  });

  it("reserves login and logout even though the commands are named connect and disconnect", () => {
    // Claude Code users type these; a skill claiming the name would shadow the alias.
    expect(isReserved("login")).toBe(true);
    expect(isReserved("logout")).toBe(true);
    expect(RESERVED_NAMES).toContain("connect");
  });

  it("skips an invalid entry but keeps the valid ones", () => {
    writeSkills(home, [{ name: "ok", prompt: "p", description: "" }, { name: "bad" }]);
    const { skills, errors } = loadSkills(project);
    expect(skills.map((s) => s.name)).toEqual(["ok"]);
    expect(errors).toHaveLength(1);
  });

  it("reports a helpful error when the file is not an array", () => {
    writeSkills(home, { name: "oops" });
    const { errors } = loadSkills(project);
    expect(errors[0]).toContain("expected a JSON array");
  });

  it("returns nothing when no skills files exist", () => {
    expect(loadSkills(project)).toEqual({ skills: [], errors: [] });
  });

  it("saveSkill creates the file and replaces a same-name entry", () => {
    saveSkill({ name: "review", description: "v1", prompt: "p1" }, "global", project);
    saveSkill({ name: "review", description: "v2", prompt: "p2" }, "global", project);

    const { skills } = loadSkills(project);
    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({ description: "v2", prompt: "p2" });
  });

  it("saveSkill to the project scope creates .papercode and wins over global", () => {
    saveSkill({ name: "review", description: "global", prompt: "g" }, "global", project);
    saveSkill({ name: "review", description: "project", prompt: "p" }, "project", project);
    expect(loadSkills(project).skills[0]).toMatchObject({ source: "project", prompt: "p" });
  });

  it("deleteSkill removes only from its scope and reports whether it existed", () => {
    saveSkill({ name: "review", description: "", prompt: "p" }, "global", project);
    expect(deleteSkill("review", "project", project)).toBe(false);
    expect(deleteSkill("review", "global", project)).toBe(true);
    expect(loadSkills(project).skills).toEqual([]);
  });

  it("parseSkillsJson accepts one object or an array and reports bad entries", () => {
    const single = parseSkillsJson(`{ "name": "a", "prompt": "p" }`);
    expect(single.skills.map((s) => s.name)).toEqual(["a"]);

    const mixed = parseSkillsJson(`[{ "name": "b", "prompt": "p" }, { "name": "new", "prompt": "p" }, 42]`);
    expect(mixed.skills.map((s) => s.name)).toEqual(["b"]);
    expect(mixed.errors).toHaveLength(2);
    expect(mixed.errors[0]).toContain("built-in command name");
  });

  it("parseSkillsJson explains malformed JSON instead of throwing", () => {
    const result = parseSkillsJson("{ nope");
    expect(result.skills).toEqual([]);
    expect(result.errors[0]).toContain("Not valid JSON");
  });

  it("importSkills writes parsed skills into the chosen scope", () => {
    const parsed = parseSkillsJson(`[{ "name": "x", "prompt": "p" }, { "name": "y", "prompt": "q" }]`);
    importSkills(parsed.skills, "project", project);
    expect(loadSkills(project).skills.map((s) => s.name)).toEqual(["x", "y"]);
  });
});

describe("sessions", () => {
  const messages: ChatMessage[] = [
    { role: "system", content: "sys" },
    { role: "user", content: "Add a description field to package.json" },
    { role: "assistant", content: "Done." },
  ];

  it("saves and reloads a session", () => {
    const session = { ...createSession(project), messages };
    saveSession(session);

    const loaded = loadSession(session.id);
    expect(loaded?.messages).toHaveLength(3);
    expect(loaded?.cwd).toBe(project);
  });

  it("titles a session from its first user message", () => {
    expect(deriveTitle(messages)).toBe("Add a description field to package.json");
  });

  it("truncates a long title and collapses whitespace", () => {
    const long: ChatMessage[] = [{ role: "user", content: "a".repeat(200) }];
    expect(deriveTitle(long)).toHaveLength(60);
    expect(deriveTitle([{ role: "user", content: "one\n\ntwo   three" }])).toBe("one two three");
  });

  it("lists most-recently-updated first", () => {
    const a = { ...createSession(project), id: "aaa", messages, updatedAt: 1 };
    const b = { ...createSession(project), id: "bbb", messages, updatedAt: 2 };
    saveSession(a);
    saveSession(b);

    const ids = listSessions().map((s) => s.id);
    expect(ids).toHaveLength(2);
    // saveSession stamps updatedAt at write time, so b (written last) leads.
    expect(ids[0]).toBe("bbb");
  });

  it("hides empty sessions, which are just abandoned launches", () => {
    saveSession({ ...createSession(project), messages: [] });
    expect(listSessions()).toEqual([]);
  });

  it("deletes a session", () => {
    const session = { ...createSession(project), messages };
    saveSession(session);
    expect(deleteSession(session.id)).toBe(true);
    expect(loadSession(session.id)).toBeUndefined();
    expect(listSessions()).toEqual([]);
  });

  it("skips a corrupt session file instead of failing the whole list", () => {
    const good = { ...createSession(project), messages };
    saveSession(good);
    fs.writeFileSync(path.join(sessionsDir(), "broken.json"), "{ not json");

    const listed = listSessions();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(good.id);
  });

  it("returns undefined for a session that does not exist", () => {
    expect(loadSession("nope")).toBeUndefined();
  });

  it("gives each new session a unique id", () => {
    const ids = new Set(Array.from({ length: 50 }, () => createSession(project).id));
    expect(ids.size).toBe(50);
  });
});
