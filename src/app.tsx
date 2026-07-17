import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Static, Text, useApp, useInput, useStdout } from "ink";
import clipboard from "clipboardy";

import { ThemeProvider } from "./ui/themes/context.js";
import { THEMES, type ThemeName } from "./ui/themes/themes.js";
import { Editor } from "./ui/components/Editor.js";
import { Select } from "./ui/components/Select.js";
import { Spinner } from "./ui/components/Spinner.js";
import { Compacting } from "./ui/components/Compacting.js";
import { Header } from "./ui/components/Header.js";
import { Banner } from "./ui/components/Banner.js";
import { ApprovalPrompt, type ApprovalRequest } from "./ui/components/ApprovalPrompt.js";
import {
  EntryView,
  ResponseFooter,
  StreamingMessage,
  ThinkingBlock,
  type Entry,
} from "./ui/components/Messages.js";
import { Connect } from "./ui/views/Connect.js";
import { Help } from "./ui/views/Help.js";
import { Skills } from "./ui/views/Skills.js";
import type { PaletteEntry } from "./ui/commands.js";

import { loadSettings, updateSettings } from "./config/settings.js";
import { listProviders, getProvider, removeProvider } from "./config/auth.js";
import { loadSkills } from "./config/skills.js";
import { createClient, describeError } from "./providers/client.js";
import { refreshModels } from "./providers/models.js";
import { runTurn } from "./agent/loop.js";
import { buildSystemPrompt } from "./agent/systemPrompt.js";
import { compact, estimateTokens } from "./agent/compact.js";
import { executeTool, getTool, toolDefinitions, type AnyTool } from "./tools/index.js";
import { ApprovalStore, type Mode } from "./tools/permissions.js";
import type { ChatMessage } from "./agent/messages.js";
import {
  createSession,
  deleteSession,
  listSessions,
  loadSession,
  relativeTime,
  saveSession,
  type Session,
} from "./sessions/store.js";

type View = "chat" | "connect" | "sessions" | "models" | "theme" | "skills" | "help" | "disconnect";


const ASSUMED_CONTEXT = 128_000;
const COMPACT_AT = 0.8;

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
  const [busy, setBusy] = useState(false);
  const [compacting, setCompacting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  
  const [epoch, setEpoch] = useState(0);
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const [tokens, setTokens] = useState(0);

  // History the API sees. A ref because the agent loop mutates it in place and
  // re-rendering on every token would be both slow and pointless.
  const messagesRef = useRef<ChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const approvals = useRef(new ApprovalStore());
  const thinkStart = useRef(0);
  
  const toolPreviews = useRef(new Map<string, string>());

  const [skills, setSkills] = useState(() => loadSkills(initialCwd));
  const providers = listProviders();
  const activeProvider = settings.activeProvider ? getProvider(settings.activeProvider) : undefined;

  
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
    if (!busy) return setElapsed(0);
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  const persist = useCallback(() => {
    if (messagesRef.current.length === 0) return;
    const next: Session = {
      ...session,
      messages: messagesRef.current,
      provider: settings.activeProvider,
      model: settings.activeModel,
    };
    saveSession(next);
    setSession(next);
  }, [session, settings.activeProvider, settings.activeModel]);

  const requestApproval = useCallback(
    (tool: AnyTool, args: unknown): Promise<boolean> => {
      const target = tool.target?.(args);
      if (approvals.current.has(tool.name, tool.permission, target)) return Promise.resolve(true);

      return new Promise<boolean>((resolve) => {
        setApproval({
          tool,
          args,
          target,
          preview: tool.preview?.(args) ?? tool.name,
          resolve: (choice) => {
            setApproval(null);
            if (choice === "always") approvals.current.grant(tool.name, target);
            resolve(choice !== "deny");
          },
        });
      });
    },
    [],
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

      const system = buildSystemPrompt(mode, session.cwd);
      if (messagesRef.current.length === 0) messagesRef.current.push({ role: "system", content: system });
      else messagesRef.current[0] = { role: "system", content: system };

      messagesRef.current.push({ role: "user", content: text });

      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      setStreaming("");
      setThinking("");
      thinkStart.current = Date.now();

      try {
        await runTurn({
          client: createClient(provider),
          model,
          messages: messagesRef.current,
          tools: toolDefinitions(mode),
          signal: controller.signal,
          executeTool: async (call) => {
            const result = await executeTool({
              name: call.function.name,
              rawArgs: call.function.arguments,
              mode,
              ctx: { root: session.cwd, signal: controller.signal },
              requestApproval,
            });
            return { content: result.content, isError: Boolean(result.isError) };
          },
          onEvent: (event) => {
            switch (event.type) {
              case "thinking":
                setThinking((t) => t + event.delta);
                break;

              case "text":
                setStreaming((t) => t + event.delta);
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
                push({
                  kind: "tool",
                  name: event.name,
                  preview: toolPreviews.current.get(event.id) ?? "",
                  result: event.result,
                  isError: event.isError,
                });
                toolPreviews.current.delete(event.id);
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
                break;
            }
          },
        });
      } catch (err) {
        notice(describeError(err), "error");
      } finally {
        setBusy(false);
        abortRef.current = null;
        setTokens(estimateTokens(messagesRef.current));
        persist();
      }
    },
    [mode, notice, persist, push, requestApproval, session.cwd, settings.activeModel, settings.activeProvider],
  );

  const startNew = useCallback(() => {
    persist();
    messagesRef.current = [];
    approvals.current.clear();
    clearScreen();
    setEntries([]);
    setTokens(0);
    setSession(createSession(initialCwd));
    setView("chat");
    notice("Started a new session.", "success");
  }, [clearScreen, initialCwd, notice, persist]);

  const resume = useCallback(
    (id: string) => {
      const loaded = loadSession(id);
      if (!loaded) return notice("Could not load that session.", "error");

      messagesRef.current = loaded.messages;
      approvals.current.clear();
      clearScreen();
      setSession(loaded);
      setTokens(estimateTokens(loaded.messages));

      // Rebuild the transcript from history. Tool traffic is collapsed to a
      // count: replaying every result verbatim buries the conversation.
      const rebuilt: Entry[] = [];
      let toolRun = 0;
      const flush = () => {
        if (toolRun > 0) {
          rebuilt.push({ kind: "notice", text: `  ${toolRun} tool call${toolRun === 1 ? "" : "s"}`, tone: "info" });
          toolRun = 0;
        }
      };

      for (const m of loaded.messages) {
        if (m.role === "user" && typeof m.content === "string") {
          flush();
          rebuilt.push({ kind: "user", text: m.content });
        } else if (m.role === "assistant") {
          if ("tool_calls" in m && m.tool_calls) toolRun += m.tool_calls.length;
          if (typeof m.content === "string" && m.content.trim()) {
            flush();
            rebuilt.push({ kind: "assistant", text: m.content });
          }
        }
      }
      flush();

      setEntries(rebuilt);
      setView("chat");
    },
    [clearScreen, notice],
  );

  const doCompact = useCallback(async () => {
    const provider = settings.activeProvider ? getProvider(settings.activeProvider) : undefined;
    if (!provider || !settings.activeModel) return notice("No model selected.", "error");
    if (messagesRef.current.length < 4) return notice("Not enough history to compact.", "info");

    setBusy(true);
    setCompacting(true);
    try {
      const before = estimateTokens(messagesRef.current);
      const result = await compact({
        client: createClient(provider),
        model: settings.activeModel,
        messages: messagesRef.current,
      });

      if (result.summarized === 0) {
        notice("Nothing to compact.", "info");
      } else {
        messagesRef.current = result.messages;
        const after = estimateTokens(result.messages);
        setTokens(after);

        // The transcript above no longer matches the history the model sees, so
        // it goes — screen and scrollback both — and the receipt becomes the
        // whole transcript. Replacing the list needs the epoch bump to reprint.
        clearScreen();
        setEntries([{ kind: "compaction", summarized: result.summarized, before, after }]);
        setEpoch((e) => e + 1);
        persist();
      }
    } catch (err) {
      notice(describeError(err), "error");
    } finally {
      setBusy(false);
      setCompacting(false);
    }
  }, [clearScreen, notice, persist, settings.activeModel, settings.activeProvider]);

  
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
    (entry: PaletteEntry) => {
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
          return void doCompact();
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
          <Header
            cwd={session.cwd}
            mode={mode}
            model={settings.activeModel}
            provider={settings.activeProvider}
            tokens={tokens}
            contextLimit={ASSUMED_CONTEXT}
          />
        )}

        {thinking && <ThinkingBlock text={thinking} seconds={0} collapsed={false} />}
        {streaming && <StreamingMessage text={streaming} />}

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
            title={activeProvider ? `Models · ${activeProvider.name}` : "Models"}
            items={(activeProvider?.models ?? []).map((m) => ({
              value: m,
              label: m,
              badge: m === settings.activeModel ? "current" : undefined,
            }))}
            emptyMessage="No models cached. Run /connect to fetch them."
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

        {view === "chat" && !approval && (
          <Editor
            mode={mode}
            cwd={session.cwd}
            skills={skills.skills}
            busy={busy}
            onSubmit={(text) => void send(text)}
            onPalette={onPalette}
            onToggleMode={() => setMode((m) => (m === "build" ? "plan" : "build"))}
          />
        )}

        {view === "chat" && tokens > ASSUMED_CONTEXT * COMPACT_AT && (
          <Box paddingX={1}>
            <Text color={THEMES[theme].warning}>Context is filling up — run /compact to summarize and free space.</Text>
          </Box>
        )}
      </Box>
    </ThemeProvider>
  );
}
