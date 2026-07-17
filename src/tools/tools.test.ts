import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveInRoot, checkMode, screenBashCommand, ApprovalStore } from "./permissions.js";
import { countOccurrences, editTool } from "./edit.js";
import { executeTool, toolDefinitions } from "./index.js";
import type { ToolContext } from "./types.js";

let root: string;
let ctx: ToolContext;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "papercode-test-"));
  ctx = { root, signal: new AbortController().signal };
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const approveAll = async () => true;
const denyAll = async () => false;

describe("resolveInRoot", () => {
  it("resolves a relative path inside the root", () => {
    const r = resolveInRoot(root, "src/app.ts");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.path).toBe(path.resolve(root, "src/app.ts"));
  });

  it("rejects traversal above the root", () => {
    expect(resolveInRoot(root, "../../etc/passwd").ok).toBe(false);
    expect(resolveInRoot(root, "..").ok).toBe(false);
  });

  it("rejects an absolute path pointing elsewhere", () => {
    const elsewhere = process.platform === "win32" ? "C:\\Windows\\System32\\config" : "/etc/passwd";
    expect(resolveInRoot(root, elsewhere).ok).toBe(false);
  });

  it("allows an absolute path that is inside the root", () => {
    expect(resolveInRoot(root, path.join(root, "a.txt")).ok).toBe(true);
  });

  it("is not fooled by a sibling directory sharing a name prefix", () => {
    // path.relative(root, root + "-evil") starts with ".." so this must fail —
    // a naive startsWith(root) check would wrongly allow it.
    expect(resolveInRoot(root, `${root}-evil/secret`).ok).toBe(false);
  });
});

describe("checkMode", () => {
  it("allows read-only tools in plan mode", () => {
    expect(checkMode("read-only", "plan").allow).toBe(true);
  });

  it("blocks mutating and dangerous tools in plan mode", () => {
    expect(checkMode("mutating", "plan").allow).toBe(false);
    expect(checkMode("dangerous", "plan").allow).toBe(false);
  });

  it("allows everything in build mode", () => {
    expect(checkMode("mutating", "build").allow).toBe(true);
    expect(checkMode("dangerous", "build").allow).toBe(true);
  });
});

describe("toolDefinitions", () => {
  it("hides mutating tools from the model in plan mode", () => {
    const names = toolDefinitions("plan").map((t) => t.function.name);
    expect(names).toContain("read");
    expect(names).toContain("grep");
    expect(names).not.toContain("write");
    expect(names).not.toContain("edit");
    expect(names).not.toContain("bash");
  });

  it("exposes every tool in build mode", () => {
    const names = toolDefinitions("build").map((t) => t.function.name);
    expect(names).toEqual(expect.arrayContaining(["read", "write", "edit", "ls", "glob", "grep", "bash"]));
  });

  it("emits a JSON Schema object for each tool", () => {
    for (const def of toolDefinitions("build")) {
      const params = def.function.parameters as { type?: string; properties?: unknown };
      expect(params.type).toBe("object");
      expect(params.properties).toBeTypeOf("object");
    }
  });
});

describe("screenBashCommand", () => {
  it("blocks recursive deletion of root", () => {
    expect(screenBashCommand("rm -rf /").allow).toBe(false);
  });

  it("blocks a fork bomb", () => {
    expect(screenBashCommand(":(){ :|:& };:").allow).toBe(false);
  });

  it("allows ordinary commands", () => {
    expect(screenBashCommand("npm test").allow).toBe(true);
    expect(screenBashCommand("rm -rf ./dist").allow).toBe(true);
    expect(screenBashCommand("git status").allow).toBe(true);
  });
});

describe("ApprovalStore", () => {
  it("scopes an approval to one tool and target", () => {
    const store = new ApprovalStore();
    store.grant("write", "a.ts");
    expect(store.has("write", "mutating", "a.ts")).toBe(true);
    expect(store.has("write", "mutating", "b.ts")).toBe(false);
    expect(store.has("bash", "dangerous", "a.ts")).toBe(false);
  });

  it("grantAllEdits covers mutating tools but not bash", () => {
    const store = new ApprovalStore();
    store.grantAllEdits();
    expect(store.has("write", "mutating", "anything.ts")).toBe(true);
    expect(store.has("bash", "dangerous", "rm -rf ./x")).toBe(false);
  });
});

describe("countOccurrences", () => {
  it("counts non-overlapping matches", () => {
    expect(countOccurrences("aaa", "a")).toBe(3);
    expect(countOccurrences("abab", "ab")).toBe(2);
    expect(countOccurrences("aaaa", "aa")).toBe(2);
    expect(countOccurrences("xyz", "a")).toBe(0);
  });
});

describe("edit tool", () => {
  it("replaces a unique match", async () => {
    const file = path.join(root, "a.ts");
    fs.writeFileSync(file, "const x = 1;\nconst y = 2;\n");

    const result = await editTool.run(
      { path: "a.ts", old_string: "const x = 1;", new_string: "const x = 42;" },
      ctx,
    );

    expect(result.isError).toBeFalsy();
    expect(fs.readFileSync(file, "utf8")).toBe("const x = 42;\nconst y = 2;\n");
  });

  it("refuses an ambiguous match rather than guessing", async () => {
    fs.writeFileSync(path.join(root, "a.ts"), "foo\nfoo\n");

    const result = await editTool.run({ path: "a.ts", old_string: "foo", new_string: "bar" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content).toContain("appears 2 times");
    // The file must be untouched when the edit is refused.
    expect(fs.readFileSync(path.join(root, "a.ts"), "utf8")).toBe("foo\nfoo\n");
  });

  it("replaces every occurrence with replace_all", async () => {
    fs.writeFileSync(path.join(root, "a.ts"), "foo\nfoo\n");

    const result = await editTool.run(
      { path: "a.ts", old_string: "foo", new_string: "bar", replace_all: true },
      ctx,
    );

    expect(result.isError).toBeFalsy();
    expect(fs.readFileSync(path.join(root, "a.ts"), "utf8")).toBe("bar\nbar\n");
  });

  it("reports a missing match without writing", async () => {
    fs.writeFileSync(path.join(root, "a.ts"), "hello\n");
    const result = await editTool.run({ path: "a.ts", old_string: "nope", new_string: "x" }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content).toContain("No match");
  });
});

describe("executeTool", () => {
  it("rejects an unknown tool name", async () => {
    const r = await executeTool({
      name: "nonexistent",
      rawArgs: "{}",
      mode: "build",
      ctx,
      requestApproval: approveAll,
    });
    expect(r.isError).toBe(true);
    expect(r.content).toContain("Unknown tool");
  });

  it("rejects malformed JSON arguments", async () => {
    const r = await executeTool({
      name: "read",
      rawArgs: "{not json",
      mode: "build",
      ctx,
      requestApproval: approveAll,
    });
    expect(r.isError).toBe(true);
    expect(r.content).toContain("valid JSON");
  });

  it("rejects arguments that fail schema validation", async () => {
    const r = await executeTool({
      name: "read",
      rawArgs: JSON.stringify({ wrong: "field" }),
      mode: "build",
      ctx,
      requestApproval: approveAll,
    });
    expect(r.isError).toBe(true);
    expect(r.content).toContain("Invalid arguments");
  });

  it("blocks a mutating tool in plan mode before touching the disk", async () => {
    const r = await executeTool({
      name: "write",
      rawArgs: JSON.stringify({ path: "new.txt", content: "hi" }),
      mode: "plan",
      ctx,
      requestApproval: approveAll,
    });
    expect(r.isError).toBe(true);
    expect(r.content).toContain("PLAN mode");
    expect(fs.existsSync(path.join(root, "new.txt"))).toBe(false);
  });

  it("does not run a tool the user denied", async () => {
    const r = await executeTool({
      name: "write",
      rawArgs: JSON.stringify({ path: "new.txt", content: "hi" }),
      mode: "build",
      ctx,
      requestApproval: denyAll,
    });
    expect(r.isError).toBe(true);
    expect(r.content).toContain("denied permission");
    expect(fs.existsSync(path.join(root, "new.txt"))).toBe(false);
  });

  it("never prompts for a read-only tool", async () => {
    fs.writeFileSync(path.join(root, "a.txt"), "hello\n");
    let asked = false;

    const r = await executeTool({
      name: "read",
      rawArgs: JSON.stringify({ path: "a.txt" }),
      mode: "build",
      ctx,
      requestApproval: async () => {
        asked = true;
        return true;
      },
    });

    expect(asked).toBe(false);
    expect(r.isError).toBeFalsy();
    expect(r.content).toContain("hello");
  });

  it("runs an approved mutating tool", async () => {
    const r = await executeTool({
      name: "write",
      rawArgs: JSON.stringify({ path: "new.txt", content: "hi" }),
      mode: "build",
      ctx,
      requestApproval: approveAll,
    });
    expect(r.isError).toBeFalsy();
    expect(fs.readFileSync(path.join(root, "new.txt"), "utf8")).toBe("hi");
  });
});
