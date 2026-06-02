import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_THEME, THEMES, type Theme, type ThemeColors } from '../../theme'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

const CONFIG_DIR = join(homedir(), '.papercode')
const THEME_PREFERENCES_PATH = join(CONFIG_DIR, 'preferences.json')

type ThemePreferences = {
    themeName: string
}

function getInitialTheme(): Theme {
  try {
    const preferences = JSON.parse(readFileSync(THEME_PREFERENCES_PATH, 'utf-8')) as Partial<ThemePreferences>
    const savedTheme = THEMES.find((theme) => theme.name === preferences.themeName)
    return savedTheme ?? DEFAULT_THEME
  }
  catch {
    return DEFAULT_THEME
  }
}


function persistTheme(theme: Theme) {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true })
    writeFileSync(THEME_PREFERENCES_PATH, JSON.stringify({ themeName: theme.name } satisfies ThemePreferences, null, 2 ), 'utf-8')
  }
  catch {
    // ignore so theme switching still works in this session. only this session.
  }
}


type themeContextValue = {
  colors: ThemeColors
  currentTheme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<themeContextValue | null>(null)

export const useTheme = (): themeContextValue => {
  const context = useContext(ThemeContext)
  if (context === null) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

type ThemeProviderProps = {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(getInitialTheme)
  const setTheme = useCallback((theme: Theme) => {
    setCurrentTheme(theme)
    persistTheme(theme)
  }, [])

  return (
    <ThemeContext.Provider value={{ colors: currentTheme.colors, currentTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

