import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../themes/context.js";
import { globalSkillsPath, projectSkillsPath } from "../../config/paths.js";
import { Select } from "../components/Select.js";
import { TextPrompt } from "../components/TextPrompt.js";
import { Panel } from "../components/Panel.js";
import { Hints } from "../components/Hints.js";
import {
  deleteSkill,
  importSkills,
  isReserved,
  parseSkillsJson,
  saveSkill,
  type Skill,
  type SkillScope,
} from "../../config/skills.js";

type Step =
  | { name: "list" }
  | { name: "detail"; skill: Skill }
  | { name: "scope"; then: "create" | "import" }
  | { name: "create-name"; scope: SkillScope }
  | { name: "create-description"; scope: SkillScope; skillName: string }
  | { name: "create-prompt"; scope: SkillScope; skillName: string; description: string }
  | { name: "import-json"; scope: SkillScope };

export type SkillsProps = {
  skills: Skill[];
  errors: string[];
  cwd: string;
  onClose: () => void;
  
  onChanged: (message: string) => void;
};


export function Skills({ skills, errors, cwd, onClose, onChanged }: SkillsProps) {
  const theme = useTheme();
  const [step, setStep] = useState<Step>({ name: "list" });

  const scopeSelect = (then: "create" | "import") => (
    <Select
      title={then === "create" ? "New skill · where does it live?" : "Import JSON · where does it live?"}
      items={[
        { value: "global" as SkillScope, label: "Global", detail: globalSkillsPath() },
        { value: "project" as SkillScope, label: "Project", detail: projectSkillsPath(cwd) },
      ]}
      onCancel={() => setStep({ name: "list" })}
      onSelect={(scope) =>
        setStep(then === "create" ? { name: "create-name", scope } : { name: "import-json", scope })
      }
    />
  );

  if (step.name === "scope") return scopeSelect(step.then);

  if (step.name === "create-name") {
    return (
      <TextPrompt
        key="skill-name"
        label="Skill name"
        hint="Becomes the slash command: “review” → /review. Letters, digits, dashes."
        onCancel={() => setStep({ name: "list" })}
        validate={(v) => {
          const name = v.trim();
          if (!name) return "A name is required.";
          if (!/^[a-z0-9][a-z0-9-]*$/i.test(name)) return "Letters, digits, and dashes only.";
          if (isReserved(name)) return `"/${name}" is a built-in command. Pick another name.`;
          return undefined;
        }}
        onSubmit={(v) => setStep({ name: "create-description", scope: step.scope, skillName: v.trim() })}
      />
    );
  }

  if (step.name === "create-description") {
    return (
      <TextPrompt
        key="skill-description"
        label={`Describe /${step.skillName}`}
        hint="One line, shown in the / palette. Optional — Enter to skip."
        onCancel={() => setStep({ name: "list" })}
        onSubmit={(v) =>
          setStep({
            name: "create-prompt",
            scope: step.scope,
            skillName: step.skillName,
            description: v.trim(),
          })
        }
      />
    );
  }

  if (step.name === "create-prompt") {
    return (
      <TextPrompt
        key="skill-prompt"
        label={`Prompt for /${step.skillName}`}
        hint="What gets sent when the command runs. Paste multi-line text freely."
        onCancel={() => setStep({ name: "list" })}
        validate={(v) => (v.trim() ? undefined : "A prompt is required.")}
        onSubmit={(v) => {
          saveSkill(
            { name: step.skillName, description: step.description, prompt: v.trim() },
            step.scope,
            cwd,
          );
          setStep({ name: "list" });
          onChanged(`Saved /${step.skillName} to ${step.scope} skills.`);
        }}
      />
    );
  }

  if (step.name === "import-json") {
    return (
      <TextPrompt
        key="skill-import"
        label="Paste skill JSON"
        hint={`One skill or an array: [{ "name": "review", "description": "…", "prompt": "…" }]`}
        onCancel={() => setStep({ name: "list" })}
        validate={(v) => {
          const parsed = parseSkillsJson(v);
          if (parsed.skills.length === 0) return parsed.errors[0] ?? "No skills found in that JSON.";
          return undefined;
        }}
        onSubmit={(v) => {
          const parsed = parseSkillsJson(v);
          importSkills(parsed.skills, step.scope, cwd);
          setStep({ name: "list" });
          const names = parsed.skills.map((s) => `/${s.name}`).join(", ");
          onChanged(
            parsed.errors.length > 0
              ? `Imported ${names}; skipped ${parsed.errors.length}: ${parsed.errors[0]}`
              : `Imported ${names} into ${step.scope} skills.`,
          );
        }}
      />
    );
  }

  if (step.name === "detail") {
    const s = step.skill;
    return (
      <SkillDetail
        skill={s}
        onBack={() => setStep({ name: "list" })}
        onDelete={() => {
          if (deleteSkill(s.name, s.source, cwd)) {
            setStep({ name: "list" });
            onChanged(`Deleted /${s.name} from ${s.source} skills.`);
          }
        }}
      />
    );
  }

  return (
    <Box flexDirection="column">
      <Select
        title="Skills"
        items={[
          { value: "__new__", label: "＋ New skill", detail: "guided: name, description, prompt" },
          { value: "__import__", label: "⇊ Import JSON", detail: "paste one skill or an array" },
          ...skills.map((s) => ({
            value: `skill:${s.source}:${s.name}`,
            label: `/${s.name}`,
            detail: s.description || "(no description)",
            badge: s.source === "project" ? "project" : undefined,
          })),
        ]}
        onCancel={onClose}
        onSelect={(value) => {
          if (value === "__new__") return setStep({ name: "scope", then: "create" });
          if (value === "__import__") return setStep({ name: "scope", then: "import" });
          const skill = skills.find((s) => `skill:${s.source}:${s.name}` === value);
          if (skill) setStep({ name: "detail", skill });
        }}
      />

      {errors.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.error}>
            Skipped {errors.length} invalid {errors.length === 1 ? "entry" : "entries"}:
          </Text>
          {errors.map((e) => (
            <Text key={e} color={theme.error}>
              · {e}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

function SkillDetail({ skill, onBack, onDelete }: { skill: Skill; onBack: () => void; onDelete: () => void }) {
  const theme = useTheme();

  useInput((input, key) => {
    if (key.escape || key.return) return onBack();
    if (key.ctrl && input === "d") return onDelete();
  });

  return (
    <Panel title={`/${skill.name}`} corner={skill.source}>
      {skill.description ? (
        <Text color={theme.muted}>{skill.description}</Text>
      ) : (
        <Text color={theme.faint}>(no description)</Text>
      )}
      <Box marginTop={1} paddingX={1} borderStyle="round" borderColor={theme.border}>
        <Text color={theme.text}>{skill.prompt}</Text>
      </Box>
      <Hints
        hints={[
          { key: "Esc", action: "back" },
          { key: "Ctrl+D", action: "delete this skill" },
        ]}
      />
    </Panel>
  );
}
