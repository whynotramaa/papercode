import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Static, Text, useApp, useInput, useStdout } from "ink";
import clipboard from "clipboardy";

import { ThemeProvider } from "./ui/themes/context.js";
import { THEMES, type ThemeName } from "./ui/themes/themes.js";
import { Editor } from "./ui/components/Editor.js";
import { Select } from "./ui/components/Select.js";
import { Spinner } from "./ui/components/Spinner.js";
import { Compacting } from "./ui/components/Compacting.js";
import { Header, StatusLine } from "./ui/components/Header.js";
import { proposedDiff } from "./ui/diff.js";
import { Banner } from "./ui/components/Banner.js";
import { ApprovalPrompt, type ApprovalRequest } from "./ui/components/ApprovalPrompt.js";
import {
  EntryView,
  ResponseFooter,
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
import { createClient, describeError, isAbort, isContextOverflow } from "./providers/client.js";
import { refreshModels } from "./providers/models.js";
import { detectCompat } from "./providers/compat.js";
import { contextWindow, modelInfo, refreshCatalog, usageCost } from "./providers/catalog.js";
import fs from "node:fs";
import { runTurn } from "./agent/loop.js";
import { withImages } from "./agent/images.js";
import { buildSystemPrompt, modeReminder, stripReminders } from "./agent/systemPrompt.js";
import { compact, estimateTokens, maskToolResults, shouldCompact, SUMMARY_MARKER } from "./agent/compact.js";
import { executeTool, getTool, isReadOnlyTool, registerTools, toolDefinitions, type AnyTool } from "./tools/index.js";
import { connectMcp } from "./tools/mcp.js";
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

export function App({ initialCwd }: { initialCwd: string }) {
  const { exit } = useApp();
  const { stdout } = useStdout();

  const [settings, setSettings] = useState(() => loadSettings());
  const [theme, setThemeName] = useState<ThemeName>(settings.theme);
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
  const [queued, setQueued] = useState<string[]>([]);
  const [draft, setDraft] = useState({ text: "", key: 0 });

  // History the API sees. A ref because the agent loop mutates it in place and
  // re-rendering on every token would be both slow and pointless.
  const messagesRef = useRef<ChatMessage[]>([]);
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

  
  const clearScreen = useCallback(() => {
    stdout?.write("\x1b[2J\x1b[3J\x1b[H");
  }, [stdout]);

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

  const replaceHistory = useCallback(
    (messages: ChatMessage[], summarized: number) => {
      persist();
      messagesRef.current = messages;
      appendCompaction(session, messages, summarized);
      persistedCount.current = messages.length;
    },
    [persist, session],
  );

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

  const compactNow = useCallback(
    async (opts: { focus?: string; auto?: boolean; signal?: AbortSignal }): Promise<boolean> => {
      const provider = settings.activeProvider ? getProvider(settings.activeProvider) : undefined;
      const model = settings.activeModel;
      if (!provider || !model) {
        notice("No model selected.", "error");
        return false;
      }
      const before = estimateTokens(messagesRef.current);

      if (opts.auto) {
        const window = contextWindow(modelInfo(detectCompat(provider.baseURL, model).kind, model));
        const masked = maskToolResults(messagesRef.current);
        if (masked.saved > 0 && before - masked.saved < window * 0.6) {
          replaceHistory(masked.messages, 0);
          setTokens(before - masked.saved);
          push({ kind: "compaction", summarized: 0, before, after: before - masked.saved });
          return true;
        }
      }

      setCompacting(true);
      try {
        const result = await compact({
          client: createClient(provider),
          model,
          messages: messagesRef.current,
          focus: opts.focus,
          signal: opts.signal,
        });
        if (result.summarized === 0) {
          if (!opts.auto) notice("Nothing to compact.", "info");
          return false;
        }
        replaceHistory(result.messages, result.summarized);
        const after = estimateTokens(result.messages);
        setTokens(after);
        push({ kind: "compaction", summarized: result.summarized, before, after });
        return true;
      } finally {
        setCompacting(false);
      }
    },
    [notice, push, replaceHistory, settings.activeModel, settings.activeProvider],
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
      const window = contextWindow(turnInfo);
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
        try {
          await go();
        } catch (err) {
          if (!isContextOverflow(err) || controller.signal.aborted) throw err;
          notice("The context window overflowed. Compacting and retrying.", "info");
          if (!(await compactNow({ signal: controller.signal }))) throw err;
          await go();
        }
        const used = measured ?? estimateTokens(messagesRef.current);
        if (!controller.signal.aborted && shouldCompact(used, window)) {
          await compactNow({ auto: true, signal: controller.signal });
        }
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
    [compactNow, mode, notice, persist, push, requestApproval, session.cwd, session.id, settings.activeModel, settings.activeProvider, settings.maxSteps, settings.thinking],
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
    [copyLast, doCompact, exit, notice, persist, send, startNew],
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

  // Esc, Ctrl+Y and Ctrl+T must work while a response streams, which is exactly
  // when the editor's own input handler is disabled.
  useInput(
    (input, key) => {
      if (key.escape && busy) {
        abortRef.current?.abort();
        return;
      }
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

  const width = stdout?.columns ?? 80;

  const last = entries[entries.length - 1];
  const hasResponse =
    last?.kind === "assistant" || (last?.kind === "thinking" && entries.some((e) => e.kind === "assistant"));
  const showFooter = view === "chat" && !busy && !approval && !streaming && hasResponse;

  return (
    <ThemeProvider name={theme}>
      <Box flexDirection="column" width={width} paddingX={1}>
        {/* Static keeps finished output out of the re-render path; Ink writes it
            once and the terminal owns the scrollback from then on.

            It is append-only: it remembers how many items it has emitted and
            renders only items.slice(thatCount). Replacing the list — which is
            exactly what /new and resuming a session do — would otherwise render
            nothing, leaving the previous session's transcript on screen under
            the new session's name. Keying it to the session id forces a remount
            so the counter resets. The key also carries the thinking toggle, so
            Ctrl+T can reprint the transcript expanded or collapsed, and the
            epoch, which /compact bumps when it swaps the transcript for its
            receipt. */}
        <Static key={`${session.id}:${epoch}:${settings.showThinking}`} items={entries}>
          {(entry, i) => <EntryView key={i} entry={entry} showThinking={settings.showThinking} />}
        </Static>

        {showFooter && <ResponseFooter thinkingShown={settings.showThinking} />}

        {view === "chat" && entries.length === 0 && !busy && <Banner cwd={session.cwd} />}

        {view === "chat" && (
<Header cwd={session.cwd} />
        )}

        {thinking && <ThinkingBlock text={thinking} seconds={0} collapsed={false} />}
        {streaming && <StreamingMessage text={streaming} />}

        {liveOutput && !approval && (
          <Box flexDirection="column" paddingLeft={4}>
            {liveOutput
              .trimEnd()
              .split("\n")
              .slice(-5)
              .map((line, i) => (
                <Text key={i} color={THEMES[theme].faint} wrap="truncate-end">
                  {line || " "}
                </Text>
              ))}
          </Box>
        )}

        {approval && <ApprovalPrompt request={approval} />}

        {busy && !approval && (compacting ? <Compacting elapsed={elapsed} /> : <Spinner elapsed={elapsed} tokens={tokens} />)}

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
            title={`${activeProvider ? `Models · ${activeProvider.name}` : "Models"}   ✻ thinking ${settings.thinking} ←→`}
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
              detail: THEMES[name].dark ? "dark" : "light",
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
              { key: "Enter", action: "remove provider and its stored key" },
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

        {view === "chat" && !approval && (
          <Editor
            key={draft.key}
            initialText={draft.text}
            mode={mode}
            cwd={session.cwd}
            skills={skills.skills}
            busy={busy}
            onSubmit={submit}
            onPalette={onPalette}
            onToggleMode={() => setMode((m) => (m === "build" ? "plan" : "build"))}
          />
        )}

        {view === "chat" && queued.length > 0 && (
          <Box flexDirection="column" paddingX={1}>
            {queued.map((q, i) => (
              <Text key={i} color={THEMES[theme].faint} wrap="truncate-end">
                {`↳ queued  ${q.replace(/\s+/g, " ")}`}
              </Text>
            ))}
          </Box>
        )}

        {view === "chat" && (
          <StatusLine
            thinking={settings.thinking}
            mode={mode}
            model={settings.activeModel}
            provider={settings.activeProvider}
            tokens={tokens}
            contextLimit={contextLimit}
            cacheRate={cacheRate}
            cost={cost}
          />
        )}

        {view === "chat" && tokens > contextLimit * COMPACT_AT && (
          <Box paddingX={1}>
            <Text color={THEMES[theme].warning}>Context is filling up — run /compact to summarize and free space.</Text>
          </Box>
        )}
      </Box>
    </ThemeProvider>
  );
}
