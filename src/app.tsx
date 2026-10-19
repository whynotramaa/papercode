import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import clipboard from "clipboardy";

import { ThemeProvider } from "./ui/themes/context.js";
import { THEMES, type ThemeName } from "./ui/themes/themes.js";
import { Editor } from "./ui/components/Editor.js";
import { Select } from "./ui/components/Select.js";
import { Spinner } from "./ui/components/Spinner.js";
import { Compacting } from "./ui/components/Compacting.js";
import { Header, StatusLine } from "./ui/components/Header.js";
import { proposedDiff } from "./ui/diff.js";
import { useViewport } from "./ui/useViewport.js";
import { ContextPanel } from "./ui/components/ContextPanel.js";
import { ScrollArea } from "./ui/components/ScrollArea.js";
import { Banner } from "./ui/components/Banner.js";
import { ApprovalPrompt, type ApprovalRequest } from "./ui/components/ApprovalPrompt.js";
import {
  EntryView,
  StreamingMessage,
  ThinkingBlock,
  type Entry,
  type ToolItem,
} from "./ui/components/Messages.js";
import { Connect } from "./ui/views/Connect.js";
import { Help } from "./ui/views/Help.js";
import { Skills } from "./ui/views/Skills.js";
import { resolveCommand, type PaletteEntry } from "./ui/commands.js";

import { loadSettings, updateSettings } from "./config/settings.js";
import { listProviders, getProvider, removeProvider } from "./config/auth.js";
import { loadSkills } from "./config/skills.js";
import { createClient, describeError, isAbort } from "./providers/client.js";
import { refreshModels } from "./providers/models.js";
import { detectCompat } from "./providers/compat.js";
import { contextWindow, modelInfo, refreshCatalog, usageCost } from "./providers/catalog.js";
import fs from "node:fs";
import { runTurn } from "./agent/loop.js";
import { withImages } from "./agent/images.js";
import { buildSystemPrompt, modeReminder, stripReminders } from "./agent/systemPrompt.js";
import { estimateTokens, prepareContext, SUMMARY_MARKER, type ContextOptions } from "./agent/compact.js";
import { createHistory } from "./agent/history.js";
import { executeTool, getTool, isReadOnlyTool, registerTools, toolDefinitions, type AnyTool } from "./tools/index.js";
import { connectMcp, mcpServers } from "./tools/mcp.js";
import { ApprovalStore, type Mode } from "./tools/permissions.js";
import { textOf, type ChatMessage } from "./agent/messages.js";
import {
  appendCompaction,
  appendInfo,
  appendMessages,
  branchTo,
  createSession,
  deleteSession,
  listSessions,
  loadSession,
  pathTo,
  relativeTime,
  sessionMessages,
  treeEntries,
  type Session,
} from "./sessions/store.js";

type View = "chat" | "connect" | "sessions" | "models" | "theme" | "skills" | "help" | "disconnect" | "tree";

const THINKING_LEVELS = ["off", "low", "medium", "high"] as const;

const COMPACT_AT = 0.8;

function transcriptOf(messages: ChatMessage[]): Entry[] {
  const rebuilt: Entry[] = [];
  let toolRun = 0;
  const flush = () => {
    if (toolRun > 0) {
      rebuilt.push({ kind: "notice", text: `  ${toolRun} tool call${toolRun === 1 ? "" : "s"}`, tone: "info" });
      toolRun = 0;
    }
  };

  for (const m of messages) {
    if (m.role === "user") {
      flush();
      const text = textOf(m);
      if (text.startsWith(SUMMARY_MARKER)) rebuilt.push({ kind: "notice", text: "Earlier conversation summarized.", tone: "info" });
      else rebuilt.push({ kind: "user", text: stripReminders(text) });
    } else if (m.role === "assistant") {
      if ("tool_calls" in m && m.tool_calls) toolRun += m.tool_calls.length;
      if (typeof m.content === "string" && m.content.trim()) {
        flush();
        rebuilt.push({ kind: "assistant", text: m.content });
      }
    }
  }
  flush();
  return rebuilt;
}

const MemoEntry = React.memo(EntryView);

export function App({ initialCwd, onThemeChange }: { initialCwd: string; onThemeChange?: (name: ThemeName) => void }) {
  const { exit } = useApp();
  const { columns, rows } = useViewport();
  const [completing, setCompleting] = useState(false);
  const [showContext, setShowContext] = useState(true);

  const [settings, setSettings] = useState(() => loadSettings());
  const [theme, setThemeName] = useState<ThemeName>(settings.theme);
  useLayoutEffect(() => onThemeChange?.(theme), [theme, onThemeChange]);
  const [view, setView] = useState<View>("chat");
  const [mode, setMode] = useState<Mode>("build");

  const [session, setSession] = useState<Session>(() => createSession(initialCwd));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [streaming, setStreaming] = useState("");
  const [thinking, setThinking] = useState("");
  const [liveOutput, setLiveOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [compacting, setCompacting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  
  const [epoch, setEpoch] = useState(0);
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const [tokens, setTokens] = useState(0);
  const [cost, setCost] = useState(0);
  const [cacheRate, setCacheRate] = useState<number | undefined>(undefined);
  const [catalogEpoch, setCatalogEpoch] = useState(0);
  const [mcp, setMcp] = useState<{ tools: AnyTool[]; errors: string[] } | null>(null);
  const [queued, setQueued] = useState<string[]>([]);
  const [draft, setDraft] = useState({ text: "", key: 0 });

  // History the API sees. A ref because the agent loop mutates it in place and
  // re-rendering on every token would be both slow and pointless.
  const messagesRef = useRef<ChatMessage[]>([]);
  const history = useMemo(() => createHistory(session.entries), [session]);
  const abortRef = useRef<AbortController | null>(null);
  const approvals = useRef(new ApprovalStore());
  const thinkStart = useRef(0);
  
  const toolPreviews = useRef(new Map<string, string>());
  const toolBatch = useRef<ToolItem[]>([]);
  const announcedMode = useRef<Mode | null>(null);
  const persistedCount = useRef(0);
  const queueRef = useRef<string[]>([]);
  const snapshots = useRef<Map<string, string | null>[]>([]);
  const sendRef = useRef<(text: string) => Promise<void>>(async () => {});

  const [skills, setSkills] = useState(() => loadSkills(initialCwd));
  const providers = listProviders();
  const activeProvider = settings.activeProvider ? getProvider(settings.activeProvider) : undefined;
  const compat = useMemo(
    () => detectCompat(activeProvider?.baseURL ?? "", settings.activeModel ?? ""),
    [activeProvider?.baseURL, settings.activeModel],
  );
  const info = useMemo(
    () => (settings.activeModel ? modelInfo(compat.kind, settings.activeModel) : undefined),
    [compat.kind, settings.activeModel, catalogEpoch],
  );
  const contextLimit = contextWindow(info);

  
  const clearScreen = useCallback(() => setEpoch((value) => value + 1), []);

  const push = useCallback((entry: Entry) => setEntries((e) => [...e, entry]), []);
  const notice = useCallback(
    (text: string, tone: "info" | "success" | "error" = "info") => push({ kind: "notice", text, tone }),
    [push],
  );

  // First run: no providers means nothing can work, so open /connect rather than
  // an input box that will fail on the first message.
  useEffect(() => {
    if (providers.length === 0) setView("connect");
    else if (!activeProvider) setView("connect");
  }, []);

  useEffect(() => {
    void refreshCatalog().then(() => setCatalogEpoch((e) => e + 1));
    void connectMcp(initialCwd).then(({ tools, errors }) => {
      registerTools(tools);
      setMcp({ tools, errors });
      for (const error of errors) notice(error, "error");
    });
  }, []);

  useEffect(() => {
    if (!busy) return setElapsed(0);
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  const persist = useCallback(() => {
    const pending = messagesRef.current.slice(persistedCount.current);
    if (pending.length === 0) return;
    appendInfo(session, settings.activeProvider, settings.activeModel);
    appendMessages(session, pending);
    persistedCount.current = messagesRef.current.length;
  }, [session, settings.activeProvider, settings.activeModel]);


  const requestApproval = useCallback(
    (tool: AnyTool, args: unknown): Promise<boolean | { denied: string }> => {
      const target = tool.target?.(args);
      if (approvals.current.has(tool.name, tool.permission, target)) return Promise.resolve(true);

      return new Promise((resolve) => {
        setApproval({
          tool,
          args,
          target,
          preview: tool.preview?.(args) ?? tool.name,
          diff: proposedDiff(tool.name, args, session.cwd),
          resolve: (choice, reason) => {
            setApproval(null);
            if (choice === "always") {
              if (tool.permission === "mutating") approvals.current.grantAllEdits();
              else approvals.current.grant(tool.name, target);
            }
            resolve(choice === "deny" ? { denied: reason ?? "" } : true);
          },
        });
      });
    },
    [session.cwd],
  );

  const context = useMemo<ContextOptions>(() => ({
    history,
    beforeCompact: persist,
    onCompacting: setCompacting,
    onCompact: (result) => {
      appendCompaction(session, result.messages, result.summarized);
      persistedCount.current = result.messages.length;
      setTokens(result.after);
      push({ kind: "compaction", summarized: result.summarized, before: result.before, after: result.after });
    },
  }), [history, persist, push, session]);

  const compactNow = useCallback(
    async (opts: { focus?: string; signal?: AbortSignal }): Promise<boolean> => {
      const provider = settings.activeProvider ? getProvider(settings.activeProvider) : undefined;
      const model = settings.activeModel;
      if (!provider || !model) {
        notice("No model selected.", "error");
        return false;
      }
      const compat = detectCompat(provider.baseURL, model);
      const changed = await prepareContext({
        ...context,
        client: createClient(provider), model, compat,
        info: modelInfo(compat.kind, model),
        messages: messagesRef.current, tools: toolDefinitions(),
        force: true, focus: opts.focus, signal: opts.signal,
      });
      if (!changed) notice("Nothing to compact.", "info");
      return changed;
    },
    [context, notice, settings.activeModel, settings.activeProvider],
  );

  const send = useCallback(
    async (text: string) => {
      const provider = settings.activeProvider ? getProvider(settings.activeProvider) : undefined;
      const model = settings.activeModel;

      if (!provider || !model) {
        notice("No model selected. Run /connect to add a provider.", "error");
        return;
      }

      push({ kind: "user", text });

      if (messagesRef.current.length === 0) {
        messagesRef.current.push({ role: "system", content: buildSystemPrompt(session.cwd) });
      }

      const reminder = announcedMode.current === mode ? "" : `\n\n${modeReminder(mode)}`;
      announcedMode.current = mode;
      messagesRef.current.push({ role: "user", content: withImages(text + reminder, session.cwd) } as ChatMessage);
      const snapshot = new Map<string, string | null>();
      snapshots.current.push(snapshot);
      const turnCompat = detectCompat(provider.baseURL, model);
      const turnInfo = modelInfo(turnCompat.kind, model);
      let measured: number | null = null;

      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      setStreaming("");
      setThinking("");
      thinkStart.current = Date.now();

      const go = () =>
        runTurn({
          client: createClient(provider),
          model,
          compat: turnCompat,
          sessionId: session.id,
          messages: messagesRef.current,
          context,
          tools: toolDefinitions(),
          isParallelSafe: isReadOnlyTool,
          maxSteps: settings.maxSteps,
          thinking: settings.thinking,
          steer: () => {
            const steered = queueRef.current;
            if (steered.length === 0) return [];
            queueRef.current = [];
            setQueued([]);
            setStreaming((current) => {
              if (current.trim()) push({ kind: "assistant", text: current });
              return "";
            });
            for (const t of steered) push({ kind: "user", text: t });
            return steered;
          },
          signal: controller.signal,
          executeTool: async (call) => {
            const result = await executeTool({
              name: call.function.name,
              rawArgs: call.function.arguments,
              mode,
              ctx: {
                root: session.cwd,
                readHistory: history.read,
                signal: controller.signal,
                onOutput: (chunk) => setLiveOutput((o) => (o + chunk).slice(-4000)),
                beforeWrite: (file) => {
                  if (snapshot.has(file)) return;
                  snapshot.set(file, fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null);
                },
              },
              requestApproval,
            });
            return { content: result.content, isError: Boolean(result.isError), display: result.display };
          },
          onEvent: (event) => {
            switch (event.type) {
              case "thinking":
                setThinking((t) => t + event.delta);
                break;

              case "text":
                setStreaming((t) => t + event.delta);
                break;

              case "usage":
                measured = event.usage.input + event.usage.output;
                setTokens(measured);
                setCost((c) => c + usageCost(turnInfo, event.usage));
                if (event.usage.input > 0) setCacheRate(event.usage.cacheRead / event.usage.input);
                break;

              case "retry":
                notice(`${event.message} Retrying in ${Math.ceil(event.delayMs / 1000)}s (attempt ${event.attempt}).`, "info");
                break;

              case "tool_start": {
                // Flush whatever the model said before the call, so the
                // transcript reads in the order it happened.
                setStreaming((current) => {
                  if (current.trim()) push({ kind: "assistant", text: current });
                  return "";
                });
                const preview = getTool(event.name)?.preview?.(event.args) ?? "";
                toolPreviews.current.set(event.id, preview);
                break;
              }

              case "tool_end": {
                setLiveOutput("");
                toolBatch.current.push({
                  name: event.name,
                  preview: toolPreviews.current.get(event.id) ?? "",
                  result: event.result,
                  isError: event.isError,
                  display: event.display,
                });
                toolPreviews.current.delete(event.id);
                if (toolPreviews.current.size > 0) break;
                const batch = toolBatch.current;
                toolBatch.current = [];
                push(batch.length === 1 ? { kind: "tool", ...batch[0]! } : { kind: "tools", items: batch });
                break;
              }

              case "turn_end":
                setStreaming((current) => {
                  if (current.trim()) push({ kind: "assistant", text: current });
                  return "";
                });
                setThinking((current) => {
                  if (current.trim()) {
                    const secs = Math.max(1, Math.round((Date.now() - thinkStart.current) / 1000));
                    setEntries((e) => [...e, { kind: "thinking", text: current, seconds: secs }]);
                  }
                  return "";
                });
                if (event.reason === "aborted") notice("Interrupted.", "info");
                if (event.reason === "max_steps") notice("Stopped after too many tool calls.", "error");
                if (event.reason === "length") notice("The response hit the model's output limit and was cut off.", "error");
                break;
            }
          },
        });

      try {
        await go();
      } catch (err) {
        if (!isAbort(err)) notice(describeError(err), "error");
      } finally {
        setBusy(false);
        abortRef.current = null;
        if (measured === null) setTokens(estimateTokens(messagesRef.current));
        persist();
        if (snapshot.size === 0) snapshots.current = snapshots.current.filter((s) => s !== snapshot);
        if (queueRef.current.length > 0) {
          const next = queueRef.current.join("\n\n");
          queueRef.current = [];
          setQueued([]);
          setTimeout(() => void sendRef.current(next), 0);
        }
      }
    },
    [context, history, mode, notice, persist, push, requestApproval, session.cwd, session.id, settings.activeModel, settings.activeProvider, settings.maxSteps, settings.thinking],
  );
  sendRef.current = send;

  const startNew = useCallback(() => {
    persist();
    messagesRef.current = [];
    persistedCount.current = 0;
    announcedMode.current = null;
    approvals.current.clear();
    clearScreen();
    setEntries([]);
    setTokens(0);
    setCost(0);
    setCacheRate(undefined);
    setSession(createSession(initialCwd));
    setView("chat");
    notice("Started a new session.", "success");
  }, [clearScreen, initialCwd, notice, persist]);

  const resume = useCallback(
    (id: string) => {
      const loaded = loadSession(id);
      if (!loaded) return notice("Could not load that session.", "error");

      messagesRef.current = sessionMessages(loaded);
      persistedCount.current = messagesRef.current.length;
      announcedMode.current = null;
      approvals.current.clear();
      setCost(0);
    setCacheRate(undefined);
      clearScreen();
      setSession(loaded);
      setTokens(estimateTokens(messagesRef.current));
      const rebuilt = transcriptOf(messagesRef.current);
      setEntries(rebuilt);
      setView("chat");
    },
    [clearScreen, notice],
  );

  const doCompact = useCallback(
    async (focus?: string) => {
      if (messagesRef.current.length < 4) return notice("Not enough history to compact.", "info");
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      try {
        await compactNow({ focus, signal: controller.signal });
        persist();
      } catch (err) {
        if (!isAbort(err)) notice(describeError(err), "error");
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [compactNow, notice, persist],
  );

  
  const toggleThinking = useCallback(() => {
    const next = updateSettings({ showThinking: !settings.showThinking });
    clearScreen();
    setSettings(next);
  }, [clearScreen, settings.showThinking]);

  const copyLast = useCallback(async () => {
    const last = [...entries].reverse().find((e) => e.kind === "assistant");
    if (!last || last.kind !== "assistant") return notice("Nothing to copy yet.", "info");
    try {
      await clipboard.write(last.text);
      notice("Copied the last response to the clipboard.", "success");
    } catch {
      notice("Could not access the clipboard on this system.", "error");
    }
  }, [entries, notice]);

  const onPalette = useCallback(
    (entry: PaletteEntry, args = "") => {
      if (busy) return notice("Commands wait until the current response finishes.", "info");
      if (entry.kind === "skill") {
        void send(entry.skill.prompt);
        return;
      }

      switch (entry.name) {
        case "new":
          return startNew();
        case "sessions":
          return setView("sessions");
        case "models":
          return setView("models");
        case "connect":
          return setView("connect");
        case "disconnect":
          return setView("disconnect");
        case "skills":
          return setView("skills");
        case "theme":
          return setView("theme");
        case "help":
          return setView("help");
        case "compact":
          return void doCompact(args);
        case "tree":
          persist();
          return setView("tree");
        case "mcp": {
          const names = Object.keys(mcpServers(initialCwd));
          if (names.length === 0) return notice("No MCP servers configured. Add them to ~/.papercode/mcp.json or .mcp.json.", "info");
          if (!mcp) return notice("MCP servers are still connecting.", "info");
          const lines = names.map((name) => {
            const failed = mcp.errors.find((e) => e.startsWith(`MCP server ${name}:`));
            if (failed) return `✗ ${failed.slice(11)}`;
            const tools = mcp.tools.filter((t) => t.name.startsWith(`mcp__${name}__`)).map((t) => t.name.split("__")[2]);
            return `✓ ${name} · ${tools.length} tools: ${tools.join(", ")}`;
          });
          return notice(lines.join("\n"), "info");
        }
        case "undo": {
          const last = snapshots.current.pop();
          if (!last) return notice("Nothing to undo.", "info");
          for (const [file, content] of last) {
            if (content === null) fs.rmSync(file, { force: true });
            else fs.writeFileSync(file, content);
          }
          return notice(`Restored ${last.size} file${last.size === 1 ? "" : "s"}.`, "success");
        }
        case "copy":
          return void copyLast();
        case "prompt":
          return notice(
            `Edit the system prompt by setting "systemPrompt" in ~/.papercode/settings.json.`,
            "info",
          );
        case "exit":
          persist();
          return exit();
      }
    },
    [busy, copyLast, doCompact, exit, initialCwd, mcp, notice, persist, send, startNew],
  );

  const submit = useCallback(
    (text: string) => {
      if (busy) {
        if (text.startsWith("/")) return notice("Commands wait until the current response finishes.", "info");
        queueRef.current = [...queueRef.current, text];
        return setQueued(queueRef.current);
      }
      const match = text.match(/^\/(\S+)\s*([\s\S]*)$/);
      if (match) {
        const command = resolveCommand(match[1]!);
        if (command) {
          return onPalette(
            { kind: "command", name: command.name, label: `/${command.name}`, description: command.description },
            match[2],
          );
        }
        const skill = skills.skills.find((s) => s.name.toLowerCase() === match[1]!.toLowerCase());
        if (skill) return void send(match[2] ? `${skill.prompt}\n\n${match[2]}` : skill.prompt);
      }
      void send(text);
    },
    [busy, notice, onPalette, send, skills.skills],
  );

  // Global actions stay available while the editor accepts queued messages.
  useInput(
    (input, key) => {
      if (key.escape && busy) {
        abortRef.current?.abort();
        return;
      }
      if (key.ctrl && input === "b") return setShowContext((value) => !value);
      if (key.ctrl && input === "y") return void copyLast();
      if (key.ctrl && input === "t") return toggleThinking();
    },
    { isActive: view === "chat" && !approval },
  );

  const jumpTo = useCallback(
    (id: string) => {
      const entry = treeEntries(session).find((e) => e.id === id);
      if (!entry || entry.type !== "message") return;
      branchTo(session, entry.parentId);
      messagesRef.current = sessionMessages(session);
      persistedCount.current = messagesRef.current.length;
      announcedMode.current = null;
      clearScreen();
      setEntries(transcriptOf(messagesRef.current));
      setEpoch((e) => e + 1);
      setTokens(estimateTokens(messagesRef.current));
      setDraft({ text: typeof entry.message.content === "string" ? stripReminders(entry.message.content) : "", key: Date.now() });
      setView("chat");
    },
    [clearScreen, session],
  );

  const treeItems = useMemo(() => {
    if (view !== "tree") return [];
    const all = treeEntries(session);
    const byId = new Map(all.map((e) => [e.id, e]));
    const children = new Map<string | null, number>();
    for (const e of all) children.set(e.parentId, (children.get(e.parentId) ?? 0) + 1);
    const onPath = new Set(pathTo(session).map((e) => e.id));
    return all.flatMap((e) => {
      if (e.type !== "message" || e.message.role !== "user" || typeof e.message.content !== "string") return [];
      let depth = 0;
      for (let p: (typeof all)[number] | undefined = e; p; p = p.parentId ? byId.get(p.parentId) : undefined) {
        if ((children.get(p.parentId) ?? 0) > 1) depth++;
      }
      const text = stripReminders(e.message.content).replace(/\s+/g, " ").trim();
      return [
        {
          value: e.id,
          label: `${"  ".repeat(depth)}${onPath.has(e.id) ? "●" : "○"} ${relativeTime(e.ts)}`,
          detail: text.length > 70 ? `${text.slice(0, 67)}...` : text,
        },
      ];
    });
  }, [session, view]);

  const rail = showContext && columns >= 110 && rows >= 26;
  const paneWidth = columns - (rail ? 29 : 0);
  const composerWidth = Math.max(20, Math.min(88, paneWidth - 4));
  const welcome = !busy && !entries.some((entry) => ["user", "assistant", "tool", "tools", "thinking"].includes(entry.kind));

  return (
    <ThemeProvider name={theme}>
      <Box flexDirection="column" width={columns} height={Math.max(8, rows - 1)} overflow="hidden">
        <Header cwd={session.cwd} busy={busy} />
        <Box flexGrow={1} minHeight={0}>
          <Box flexGrow={1} minWidth={0} width={paneWidth} paddingX={2} flexDirection="column">
            {view === "chat" ? (
              <Box flexGrow={1} minHeight={0} flexDirection="column" justifyContent={welcome ? "center" : "flex-start"}>
                {approval ? (
                  <ScrollArea key="approval" follow={false}><ApprovalPrompt request={approval} /></ScrollArea>
                ) : (
                  <>
                    {welcome ? (
                      <Box alignSelf="center" width={composerWidth} flexDirection="column">
                        <Box display={completing ? "none" : "flex"} flexDirection="column"><Banner compact={rows < 22} /></Box>
                        {entries.slice(-2).map((entry, i) => <MemoEntry key={i} entry={entry} />)}
                      </Box>
                    ) : (
                      <ScrollArea key={`${session.id}:${epoch}`}>
                        {entries.map((entry, i) => <MemoEntry key={i} entry={entry} showThinking={settings.showThinking} />)}
                        {thinking && <ThinkingBlock text={thinking} seconds={0} collapsed={!settings.showThinking} />}
                        {streaming && <StreamingMessage text={streaming} />}
                        {liveOutput && <Box flexDirection="column" paddingLeft={2}>{liveOutput.trimEnd().split("\n").slice(-4).map((line, i) => <Text key={i} color={THEMES[theme].faint} wrap="truncate-end">{line || " "}</Text>)}</Box>}
                      </ScrollArea>
                    )}
                    {busy && <Box flexShrink={0} paddingY={rows >= 26 ? 1 : 0}>{compacting ? <Compacting elapsed={elapsed} /> : <Spinner elapsed={elapsed} tokens={tokens} />}</Box>}
                    <Box alignSelf="center" width={welcome ? composerWidth : "100%"} flexDirection="column" flexShrink={0}>
                      <Editor key={draft.key} initialText={draft.text} mode={mode} cwd={session.cwd} skills={skills.skills} busy={busy}
                        width={welcome ? composerWidth : paneWidth - 4} onSuggestionsChange={setCompleting} onSubmit={submit} onPalette={onPalette}
                        onToggleMode={() => setMode((m) => m === "build" ? "plan" : "build")} />
                      {queued.length > 0 && <Text color={THEMES[theme].accent} wrap="truncate-end">↳ {queued.length} queued · {queued.at(-1)?.replace(/\s+/g, " ")}</Text>}
                      {tokens > contextLimit * COMPACT_AT && <Text color={THEMES[theme].warning} wrap="truncate-end">Context is filling up · /compact to summarize</Text>}
                    </Box>
                  </>
                )}
              </Box>
            ) : (
              <Box flexGrow={1} minHeight={0} justifyContent="center" flexDirection="column" alignItems="center">
                <Box width={Math.max(20, Math.min(80, paneWidth - 4))} height={Math.max(4, rows - 5)} flexDirection="column" minHeight={0}>
                  <ScrollArea key={view} follow={false}>
                    <Box flexDirection="column" paddingTop={Math.max(0, Math.floor((rows - 27) / 2))}>
        {view === "connect" && (
          <Connect
            onCancel={() => setView(providers.length > 0 ? "chat" : "connect")}
            onDone={({ provider, model }) => {
              setSettings(updateSettings({ activeProvider: provider, activeModel: model }));
              setView("chat");
              notice(`Connected to ${provider} · ${model}`, "success");
            }}
          />
        )}

        {view === "sessions" && (
          <Select
            title="Sessions"
            items={listSessions().map((s) => ({
              value: s.id,
              label: s.title,
              detail: `${relativeTime(s.updatedAt)}${s.cwd === initialCwd ? "" : ` · ${s.cwd}`}`,
            }))}
            emptyMessage="No past sessions yet."
            hints={[
              { key: "↑↓", action: "move" },
              { key: "Enter", action: "resume" },
              { key: "type", action: "search" },
              { key: "Ctrl+D", action: "delete" },
              { key: "Esc", action: "cancel" },
            ]}
            onSelect={resume}
            onCancel={() => setView("chat")}
            onDelete={(id) => {
              if (deleteSession(id)) notice("Session deleted.", "success");
              // Re-render the list by bouncing the view.
              setView("chat");
              setView("sessions");
            }}
          />
        )}

        {view === "models" && (
          <Select
            title={`Models · thinking ${settings.thinking}`}
            hints={[
              { key: "↑↓", action: "move" },
              { key: "Enter", action: "select" },
              { key: "Esc", action: "cancel" },
              { key: "←→", action: "thinking" },
            ]}
            items={(activeProvider?.models ?? []).map((m) => {
              const meta = modelInfo(compat.kind, m);
              const detail = meta
                ? [
                    `${Math.round(meta.context / 1000)}k ctx`,
                    meta.cost ? `$${meta.cost.input}/$${meta.cost.output}` : "",
                    meta.reasoning ? "reasoning" : "",
                    meta.vision ? "vision" : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : undefined;
              return { value: m, label: m, detail, badge: m === settings.activeModel ? "current" : undefined };
            })}
            emptyMessage="No models cached. Run /connect to fetch them."
            onArrow={(dir) => {
              const i = THINKING_LEVELS.indexOf(settings.thinking);
              const next = THINKING_LEVELS[(i + dir + THINKING_LEVELS.length) % THINKING_LEVELS.length]!;
              setSettings(updateSettings({ thinking: next }));
            }}
            onCancel={() => setView("chat")}
            onSelect={(model) => {
              setSettings(updateSettings({ activeModel: model }));
              setView("chat");
              notice(`Model set to ${model}.`, "success");
            }}
          />
        )}

        {view === "theme" && (
          <Select
            title="Theme"
            items={(Object.keys(THEMES) as ThemeName[]).map((name) => ({
              value: name,
              label: THEMES[name].label,
              detail: THEMES[name].description,
              badge: name === settings.theme ? "current" : undefined,
            }))}
            hints={[
              { key: "↑↓", action: "preview" },
              { key: "Enter", action: "keep" },
              { key: "Esc", action: "revert" },
            ]}
            onHighlight={(name) => setThemeName(name)}
            onCancel={() => {
              setThemeName(settings.theme);
              setView("chat");
            }}
            onSelect={(name) => {
              setSettings(updateSettings({ theme: name }));
              setThemeName(name);
              setView("chat");
            }}
          />
        )}

        {view === "disconnect" && (
          <Select
            title="Remove a provider"
            items={providers.map((p) => ({ value: p.name, label: p.name, detail: p.baseURL }))}
            emptyMessage="No providers configured."
            hints={[
              { key: "Enter", action: "remove provider" },
              { key: "Esc", action: "cancel" },
            ]}
            onCancel={() => setView("chat")}
            onSelect={(name) => {
              removeProvider(name);
              if (settings.activeProvider === name) {
                setSettings(updateSettings({ activeProvider: undefined, activeModel: undefined }));
              }
              setView("chat");
              notice(`Removed ${name} and deleted its stored key.`, "success");
            }}
          />
        )}

        {view === "skills" && (
          <Skills
            skills={skills.skills}
            errors={skills.errors}
            cwd={initialCwd}
            onClose={() => setView("chat")}
            onChanged={(message) => {
              setSkills(loadSkills(initialCwd));
              notice(message, "success");
            }}
          />
        )}

        {view === "help" && <Help onClose={() => setView("chat")} />}

        {view === "tree" && (
          <Select
            title="Conversation tree"
            items={treeItems}
            emptyMessage="No messages in this session yet."
            hints={[
              { key: "↑↓", action: "move" },
              { key: "Enter", action: "branch from here" },
              { key: "Esc", action: "cancel" },
            ]}
            onSelect={jumpTo}
            onCancel={() => setView("chat")}
          />
        )}

                    </Box>
                  </ScrollArea>
                </Box>
              </Box>
            )}
          </Box>
          {rail && <ContextPanel cwd={session.cwd} title={session.title} model={settings.activeModel} provider={settings.activeProvider}
            tokens={tokens} contextLimit={contextLimit} cost={cost} cacheRate={cacheRate} thinking={settings.thinking}
            skills={skills.skills.length} servers={Object.keys(mcpServers(initialCwd)).length} mcpErrors={mcp?.errors.length ?? 0}
            tools={toolDefinitions().length} messages={messagesRef.current} compact={rows < 34} queued={queued.length} />}
        </Box>
        <StatusLine thinking={settings.thinking} mode={mode} model={settings.activeModel} provider={settings.activeProvider}
          tokens={tokens} contextLimit={contextLimit} cacheRate={cacheRate} cost={cost} />
      </Box>
    </ThemeProvider>
  );
}
