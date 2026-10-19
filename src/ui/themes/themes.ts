export type Theme = {
  label: string;
  description: string;
  dark: boolean;
  background: string;
  panel: string;
  border: string;
  text: string;
  muted: string;
  faint: string;
  primary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  code: string;
  codeBg: string;
  diffAdd: string;
  diffRemove: string;
  heading: string;
  link: string;
  quote: string;
};

export const THEMES = {
  signal: {
    label: "Signal", description: "Obsidian / signal yellow / steel blue", dark: true,
    background: "#101214", panel: "#191d21", border: "#343b43",
    text: "#eceff2", muted: "#a0aab5", faint: "#808c98",
    primary: "#e8d45b", accent: "#96bed5", success: "#a8c98a", warning: "#e9b86c", error: "#f08e8e",
    code: "#b3d0df", codeBg: "#191d21", diffAdd: "#a8c98a", diffRemove: "#f08e8e",
    heading: "#eceff2", link: "#96bed5", quote: "#a0aab5",
  },
  graphite: {
    label: "Graphite", description: "Graphite / orange / ice blue", dark: true,
    background: "#151619", panel: "#1e2025", border: "#3d4149",
    text: "#f2efeb", muted: "#b1aba5", faint: "#938e89",
    primary: "#f3a36d", accent: "#9fc9e5", success: "#adc992", warning: "#e9c77b", error: "#ef9694",
    code: "#b6d7e9", codeBg: "#1e2025", diffAdd: "#adc992", diffRemove: "#ef9694",
    heading: "#f2efeb", link: "#9fc9e5", quote: "#b1aba5",
  },
  midnight: {
    label: "Midnight", description: "Midnight / cyan / lime", dark: true,
    background: "#0d1720", panel: "#15232e", border: "#304754",
    text: "#e3edf2", muted: "#9eb5c2", faint: "#819ba9",
    primary: "#65d9e4", accent: "#bfdb83", success: "#bfdb83", warning: "#e6bd7c", error: "#f297a2",
    code: "#a5d7e8", codeBg: "#15232e", diffAdd: "#bfdb83", diffRemove: "#f297a2",
    heading: "#e3edf2", link: "#65d9e4", quote: "#9eb5c2",
  },
  paper: {
    label: "Paper", description: "Warm paper / ink / rust", dark: false,
    background: "#f3f0e8", panel: "#e7e2d8", border: "#b5aea0",
    text: "#252a2d", muted: "#5f605b", faint: "#6d6c64",
    primary: "#984b2c", accent: "#315d71", success: "#45643c", warning: "#805a15", error: "#a13b3b",
    code: "#315d71", codeBg: "#e7e2d8", diffAdd: "#45643c", diffRemove: "#a13b3b",
    heading: "#252a2d", link: "#315d71", quote: "#5f605b",
  },
} as const satisfies Record<string, Theme>;

export type ThemeName = keyof typeof THEMES;
export const THEME_NAMES = Object.keys(THEMES) as [ThemeName, ...ThemeName[]];
export const DEFAULT_THEME: ThemeName = "signal";

export function getTheme(name: ThemeName): Theme { return THEMES[name]; }

export function migrateTheme(name: unknown): unknown {
  if (name === "carbon") return "graphite";
  if (name === "nord") return "midnight";
  if (name === "ember") return "signal";
  return name;
}
