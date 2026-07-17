import React, { createContext, useContext } from "react";
import { getTheme, DEFAULT_THEME, type Theme, type ThemeName } from "./themes.js";

const ThemeContext = createContext<Theme>(getTheme(DEFAULT_THEME));

export function ThemeProvider({ name, children }: { name: ThemeName; children: React.ReactNode }) {
  return <ThemeContext.Provider value={getTheme(name)}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
