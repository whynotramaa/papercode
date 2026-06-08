import type { KeyBinding, TextareaRenderable } from "@opentui/core";
import { TextAttributes } from "@opentui/core";
import { EmptyBorder } from "./border";
import { StatusBar } from "./status-bar";
import { CommandMenu } from "./command-menu";
import { FileMention } from "./file-mention";
import { useFileMention } from "./file-mention/use-file-mention";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRenderer } from "@opentui/react";
import { useCommandMenu } from "./command-menu/use-command-menu";
import type { Command } from "./command-menu/types";
import { useSkills } from "../providers/skills";
import { skillsToCommands } from "./command-menu/skill-commands";
import { useToast } from "../providers/toast";
import { useKeyboardLayer } from "../providers/keyboard-layer";
import { useDialog } from "../providers/dialog";
import { useTheme } from "../providers/theme";
import { useNavigate } from "react-router";

type Props = {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  onBlockedAction?: () => void;
  submitMessage?: (text: string, mode?: "BUILD" | "PLAN") => void;
}

export const TEXTAREA_KEY_BINDINGS: KeyBinding[] = [
  { name: "return", action: "submit" },
  { name: "enter", action: "submit" },
  { name: "return", shift: true, action: "newline" },
  { name: "enter", shift: true, action: "newline" },
]

// Extract all @mention tokens (file paths) from text
function parseMentions(text: string): string[] {
  const matches = text.match(/@([^\s]+)/g)
  if (!matches) return []
  return matches.map(m => m.slice(1)) // strip leading @
}

// Shorten a path to its last 2 segments for chip display
function shortPath(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/").filter(Boolean)
  return parts.slice(-2).join("/")
}

export function InputBar({ onSubmit, disabled, onBlockedAction, submitMessage }: Props) {
  const textareaRef = useRef<TextareaRenderable>(null);
  const onSubmitRef = useRef<() => void>(() => { });
  const renderer = useRenderer();
  const toast = useToast()
  const { isTopLayer, setResponder } = useKeyboardLayer()
  const { colors } = useTheme()
  const [mentions, setMentions] = useState<string[]>([])

  const dialog = useDialog()
  const navigate = useNavigate()
  const { skills } = useSkills()
  const skillCommands = useMemo(() => skillsToCommands(skills), [skills])
  const { showCommandMenu, commandQuery, selectedIndex: cmdIndex, scrollRef: cmdScrollRef, handleContentChange: cmdHandleContentChange, resolveCommand, setSelectedIndex: setCmdIndex } = useCommandMenu(skillCommands);
  const { showFileMention, fileMentionQuery, selectedIndex: fileIndex, scrollRef: fileScrollRef, entries, handleContentChange: fileHandleContentChange, resolveEntry, setSelectedIndex: setFileIndex } = useFileMention(process.cwd());

  const handleCommand = useCallback((command: Command | undefined) => {
    const textarea = textareaRef.current;
    if (!command || !textarea) return;

    textarea.setText("");

    if (command.action && !command.isSkill) {
      command.action({ exit: () => renderer.destroy(), toast, dialog, navigate, submitMessage });
    } else {
      textarea.insertText(command.value + " ");
    }
  }, [dialog, navigate, renderer, toast])

  const handleSubmit = useCallback(() => {
    if (disabled) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    const text = textarea.plainText.trim();
    if (text.length === 0) return;
    onSubmit(text);
    textarea.setText("");
    setMentions([])
  }, [disabled, onSubmit])

  const handleCommandExecute = useCallback((index: number) => {
    handleCommand(resolveCommand(index))
  }, [resolveCommand, handleCommand])

  const handleFileExecute = useCallback((index: number) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const result = resolveEntry(index)
    if (result === null) {
      // directory drilldown — update textarea text but keep picker open
      const currentText = textarea.plainText
      const updated = currentText.replace(/@([^\s@]*)$/, `@${entries[index]?.fullPath ?? ""}/`)
      textarea.setText(updated)
      fileHandleContentChange(updated)
      setMentions(parseMentions(updated))
    } else {
      // file selected — replace @query with @path so it shows as a chip
      const currentText = textarea.plainText
      const updated = currentText.replace(/@([^\s@]*)$/, `@${result} `)
      textarea.setText(updated)
      fileHandleContentChange(updated)
      setMentions(parseMentions(updated))
    }
  }, [resolveEntry, entries, fileHandleContentChange])

  const handleTextAreaContentChange = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const text = textarea.plainText
    cmdHandleContentChange(text)
    fileHandleContentChange(text)
    setMentions(parseMentions(text))
  }, [cmdHandleContentChange, fileHandleContentChange])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return;
    textarea.onSubmit = () => { onSubmitRef.current() }
  }, []);

  onSubmitRef.current = () => {
    if (disabled) {
      onBlockedAction?.();
      return;
    }

    if (showCommandMenu) {
      handleCommand(resolveCommand(cmdIndex))
      return
    }

    if (showFileMention) {
      handleFileExecute(fileIndex)
      return
    }

    handleSubmit()
  };

  useEffect(() => {
    setResponder("base", () => {
      if (disabled) return false
      const textarea = textareaRef.current
      if (textarea && textarea.plainText.length > 0) {
        textarea.setText("")
        setMentions([])
        return true
      }
      return false
    })
    return () => setResponder("base", null)
  }, [disabled, setResponder]);

  const showAnyMenu = showCommandMenu || showFileMention

  return (
    <box width="100%">
      <box border={["left"]} borderColor={colors.primary} width="100%" customBorderChars={{
        ...EmptyBorder, vertical: "┃", bottomLeft: "╹"
      }}>
        <box position="relative" justifyContent="center" paddingX={2} paddingY={1} backgroundColor={colors.surface} width="100%" gap={1}>
          {showAnyMenu && (
            <box position="absolute" bottom="100%" left={0} width="100%" backgroundColor={colors.surface} zIndex={10}>
              {showCommandMenu && (
                <CommandMenu
                  query={commandQuery}
                  selectedIndex={cmdIndex}
                  scrollRef={cmdScrollRef}
                  onSelect={setCmdIndex}
                  onExecute={handleCommandExecute}
                  skillCommands={skillCommands}
                />
              )}
              {showFileMention && (
                <FileMention
                  query={fileMentionQuery}
                  entries={entries}
                  selectedIndex={fileIndex}
                  scrollRef={fileScrollRef}
                  onSelect={setFileIndex}
                  onExecute={handleFileExecute}
                />
              )}
            </box>
          )}

          {/* @mention chips shown in theme color above textarea */}
          {mentions.length > 0 && (
            <box flexDirection="row" gap={1} width="100%">
              {mentions.map((m, i) => (
                <box key={i} flexDirection="row" gap={0}>
                  <text fg={colors.primary} attributes={TextAttributes.BOLD}>@</text>
                  <text fg={colors.primary}>{shortPath(m)}</text>
                </box>
              ))}
            </box>
          )}

          <textarea
            ref={textareaRef}
            width="100%"
            focused={isTopLayer("base") || isTopLayer("command") || isTopLayer("file-mention")}
            keyBindings={TEXTAREA_KEY_BINDINGS}
            onContentChange={handleTextAreaContentChange}
            placeholder="Ask anything...  @ to mention files"
          />
          <StatusBar />
        </box>
      </box>
    </box>
  );
}
