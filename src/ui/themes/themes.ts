
export type Theme = {
  label: string;
  dark: boolean;
  
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
  carbon: {
    label: "Carbon",
    dark: true,
    panel: "#161616",
    border: "#2e2e2e",
    text: "#e6e6e6",
    muted: "#8f8f8f",
    faint: "#616161",
    primary: "#8b9dff",
    accent: "#c4a7ff",
    success: "#5fb87a",
    warning: "#d4a55f",
    error: "#e5707b",
    code: "#8fc7d4",
    codeBg: "#161616",
    diffAdd: "#5fb87a",
    diffRemove: "#e5707b",
    heading: "#e6e6e6",
    link: "#8b9dff",
    quote: "#7d7d7d",
  },
  paper: {
    label: "Paper",
    dark: false,
    panel: "#f2f2f0",
    border: "#d9d9d6",
    text: "#1c1c1c",
    muted: "#5f5f5f",
    faint: "#8a8a8a",
    primary: "#3b5bdb",
    accent: "#7048e8",
    success: "#2b8a3e",
    warning: "#a06800",
    error: "#c92a2a",
    code: "#0b7285",
    codeBg: "#f2f2f0",
    diffAdd: "#2b8a3e",
    diffRemove: "#c92a2a",
    heading: "#1c1c1c",
    link: "#3b5bdb",
    quote: "#6b6b6b",
  },
  nord: {
    label: "Nord",
    dark: true,
    panel: "#2e3440",
    border: "#3b4252",
    text: "#e5e9f0",
    muted: "#8794ab",
    faint: "#616e88",
    primary: "#88c0d0",
    accent: "#b48ead",
    success: "#a3be8c",
    warning: "#ebcb8b",
    error: "#bf616a",
    code: "#8fbcbb",
    codeBg: "#2e3440",
    diffAdd: "#a3be8c",
    diffRemove: "#bf616a",
    heading: "#e5e9f0",
    link: "#88c0d0",
    quote: "#7b88a1",
  },
  ember: {
    label: "Ember",
    dark: true,
    panel: "#1a1614",
    border: "#332b26",
    text: "#ede0d4",
    muted: "#9c8a76",
    faint: "#6d5c4b",
    primary: "#e8a87c",
    accent: "#c38d9e",
    success: "#8fb98a",
    warning: "#e0b878",
    error: "#e07a5f",
    code: "#c9ada7",
    codeBg: "#1a1614",
    diffAdd: "#8fb98a",
    diffRemove: "#e07a5f",
    heading: "#ede0d4",
    link: "#e8a87c",
    quote: "#8a7968",
  },
} as const satisfies Record<string, Theme>;

export type ThemeName = keyof typeof THEMES;

export const THEME_NAMES = Object.keys(THEMES) as [ThemeName, ...ThemeName[]];

export const DEFAULT_THEME: ThemeName = "carbon";

export function getTheme(name: ThemeName): Theme {
  return THEMES[name];
}
